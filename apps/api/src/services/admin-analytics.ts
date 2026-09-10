import type { QueryResultRow } from "pg";
import { query } from "@bep-nha-minh/api/db/client";
import { getServerEnv } from "@bep-nha-minh/api/lib/env";

const revenueStatuses = [
  "APPROVED",
  "PREPARING",
  "READY",
  "DELIVERING",
  "COMPLETED"
];

export type AnalyticsInput = {
  range?: "1d" | "3d" | "7d";
  dateFrom?: string;
  dateTo?: string;
};

type AnalyticsWindow = {
  mode: "1d" | "3d" | "7d" | "custom";
  bucketUnit: "hour" | "day" | "week" | "month";
  bucketStep: string;
  dateFrom: string | null;
  dateTo: string | null;
};

type SummaryRow = QueryResultRow & {
  total_orders: string;
  pending_orders: string;
  approved_orders: string;
  completed_orders: string;
  rejected_orders: string;
  cancelled_orders: string;
  gross_revenue: string;
  average_order_value: string;
  approval_rate: string;
};

type SeriesRow = QueryResultRow & {
  bucket: string;
  order_count: string;
  approved_count: string;
  completed_count: string;
  gross_revenue: string;
};

export async function getOrderAnalytics(input: AnalyticsInput) {
  const timezone = getServerEnv().BUSINESS_TIMEZONE;
  const analyticsWindow = resolveAnalyticsWindow(input);

  const summaryValues = [
    analyticsWindow.mode,
    analyticsWindow.dateFrom,
    analyticsWindow.dateTo,
    timezone,
    analyticsWindow.bucketUnit
  ];
  const seriesValues = [
    analyticsWindow.mode,
    analyticsWindow.dateFrom,
    analyticsWindow.dateTo,
    timezone,
    analyticsWindow.bucketUnit,
    analyticsWindow.bucketStep
  ];

  const [summaryResult, seriesResult] = await Promise.all([
    query<SummaryRow>(summarySql, summaryValues),
    query<SeriesRow>(seriesSql, seriesValues)
  ]);

  const summary = summaryResult.rows[0];

  return {
    timezone,
    mode: analyticsWindow.mode,
    bucketUnit: analyticsWindow.bucketUnit,
    range: {
      dateFrom: analyticsWindow.dateFrom,
      dateTo: analyticsWindow.dateTo
    },
    revenueStatuses,
    summary: {
      totalOrders: Number(summary?.total_orders ?? 0),
      pendingOrders: Number(summary?.pending_orders ?? 0),
      approvedOrders: Number(summary?.approved_orders ?? 0),
      completedOrders: Number(summary?.completed_orders ?? 0),
      rejectedOrders: Number(summary?.rejected_orders ?? 0),
      cancelledOrders: Number(summary?.cancelled_orders ?? 0),
      grossRevenue: Number(summary?.gross_revenue ?? 0),
      averageOrderValue: Number(summary?.average_order_value ?? 0),
      approvalRate: Number(summary?.approval_rate ?? 0)
    },
    series: seriesResult.rows.map((row) => ({
      bucket: row.bucket,
      orderCount: Number(row.order_count),
      approvedCount: Number(row.approved_count),
      completedCount: Number(row.completed_count),
      grossRevenue: Number(row.gross_revenue)
    }))
  };
}

function resolveAnalyticsWindow(input: AnalyticsInput): AnalyticsWindow {
  if (input.dateFrom && input.dateTo) {
    const days = inclusiveDayCount(input.dateFrom, input.dateTo);

    return {
      mode: "custom",
      bucketUnit: days <= 31 ? "day" : days <= 120 ? "week" : "month",
      bucketStep: days <= 31 ? "1 day" : days <= 120 ? "1 week" : "1 month",
      dateFrom: input.dateFrom,
      dateTo: input.dateTo
    };
  }

  if (input.range === "1d") {
    return {
      mode: "1d",
      bucketUnit: "hour",
      bucketStep: "1 hour",
      dateFrom: null,
      dateTo: null
    };
  }

  if (input.range === "3d") {
    return {
      mode: "3d",
      bucketUnit: "hour",
      bucketStep: "1 hour",
      dateFrom: null,
      dateTo: null
    };
  }

  return {
    mode: "7d",
    bucketUnit: "day",
    bucketStep: "1 day",
    dateFrom: null,
    dateTo: null
  };
}

function inclusiveDayCount(dateFrom: string, dateTo: string) {
  const from = Date.parse(`${dateFrom}T00:00:00.000Z`);
  const to = Date.parse(`${dateTo}T00:00:00.000Z`);

  return Math.floor((to - from) / 86_400_000) + 1;
}

const filteredOrdersCte = `
  WITH resolved_bounds AS (
    SELECT
      CASE
        WHEN $1 = '1d' THEN date_trunc('hour', now() at time zone $4) - interval '23 hours'
        WHEN $1 = '3d' THEN date_trunc('hour', now() at time zone $4) - interval '71 hours'
        WHEN $1 = '7d' THEN date_trunc('day', now() at time zone $4) - interval '6 days'
        ELSE $2::date::timestamp
      END AS local_start,
      CASE
        WHEN $1 IN ('1d', '3d') THEN date_trunc('hour', now() at time zone $4) + interval '1 hour'
        WHEN $1 = '7d' THEN date_trunc('day', now() at time zone $4) + interval '1 day'
        ELSE ($3::date + interval '1 day')::timestamp
      END AS local_end
  ),
  filtered_orders AS (
    SELECT
      o.*,
      date_trunc($5, o.created_at AT TIME ZONE $4) AS bucket_local
    FROM orders o
    CROSS JOIN resolved_bounds b
    WHERE o.created_at >= (b.local_start AT TIME ZONE $4)
      AND o.created_at < (b.local_end AT TIME ZONE $4)
  )
`;

const summarySql = `
  ${filteredOrdersCte}
  SELECT
    count(*)::text AS total_orders,
    count(*) FILTER (WHERE status = 'PENDING')::text AS pending_orders,
    count(*) FILTER (WHERE status = 'APPROVED')::text AS approved_orders,
    count(*) FILTER (WHERE status = 'COMPLETED')::text AS completed_orders,
    count(*) FILTER (WHERE status = 'REJECTED')::text AS rejected_orders,
    count(*) FILTER (WHERE status = 'CANCELLED')::text AS cancelled_orders,
    COALESCE(sum(total_amount) FILTER (
      WHERE status = ANY(ARRAY['APPROVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED'])
    ), 0)::text AS gross_revenue,
    COALESCE(round(avg(total_amount) FILTER (
      WHERE status = ANY(ARRAY['APPROVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED'])
    )), 0)::text AS average_order_value,
    COALESCE(
      round(
        100.0
        * count(*) FILTER (
          WHERE status = ANY(ARRAY['APPROVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED'])
        )
        / nullif(count(*), 0),
        2
      ),
      0
    )::text AS approval_rate
  FROM filtered_orders
`;

const seriesSql = `
  ${filteredOrdersCte},
  buckets AS (
    SELECT generate_series(
      (SELECT local_start FROM resolved_bounds),
      (SELECT local_end FROM resolved_bounds) - $6::interval,
      $6::interval
    ) AS bucket_local
  ),
  grouped_orders AS (
    SELECT
      bucket_local,
      count(*) AS order_count,
      count(*) FILTER (
        WHERE status = ANY(ARRAY['APPROVED', 'PREPARING', 'READY', 'DELIVERING'])
      ) AS approved_count,
      count(*) FILTER (WHERE status = 'COMPLETED') AS completed_count,
      COALESCE(sum(total_amount) FILTER (
        WHERE status = ANY(ARRAY['APPROVED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED'])
      ), 0) AS gross_revenue
    FROM filtered_orders
    GROUP BY bucket_local
  )
  SELECT
    CASE
      WHEN $5 = 'hour' THEN to_char(b.bucket_local, 'YYYY-MM-DD"T"HH24:MI:SS')
      WHEN $5 = 'month' THEN to_char(b.bucket_local, 'YYYY-MM')
      ELSE to_char(b.bucket_local, 'YYYY-MM-DD')
    END AS bucket,
    COALESCE(g.order_count, 0)::text AS order_count,
    COALESCE(g.approved_count, 0)::text AS approved_count,
    COALESCE(g.completed_count, 0)::text AS completed_count,
    COALESCE(g.gross_revenue, 0)::text AS gross_revenue
  FROM buckets b
  LEFT JOIN grouped_orders g ON g.bucket_local = b.bucket_local
  ORDER BY b.bucket_local ASC
`;

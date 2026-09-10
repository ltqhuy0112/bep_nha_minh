"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatVnd } from "@/lib/admin/format";

type ChartPoint = {
  bucket: string;
  orderCount: number;
  approvedCount: number;
  completedCount: number;
  grossRevenue: number;
};

export function OrderChart({
  title,
  points,
  metric
}: {
  title: string;
  points: ChartPoint[];
  metric: "orders" | "revenue";
}) {
  const dataKey = metric === "orders" ? "orderCount" : "grossRevenue";
  const values = points.map((point) => point[dataKey]);
  const maxValue = Math.max(...values, 1);
  const totalValue = values.reduce((total, value) => total + value, 0);
  const gradientId = metric === "orders" ? "ordersGradient" : "revenueGradient";
  const strokeColor = metric === "orders" ? "#4f643d" : "#a06a2d";
  const fillColor = metric === "orders" ? "#7d925a" : "#d6a15c";

  return (
    <div className="overflow-hidden rounded-lg border border-olive-700/10 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-olive-700/10 bg-gradient-to-r from-beige-100 to-white p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-olive-900">{title}</h2>
          <p className="mt-1 text-xs text-muted">
            Tooltip và trục hiển thị đủ ngày/tháng/năm giờ:phút:giây
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-sm">
          <p className="rounded-lg border border-olive-700/10 bg-white px-3 py-2">
            <span className="block text-xs text-muted">Tổng</span>
            <span className="font-bold text-olive-900">
              {metric === "orders" ? totalValue : formatVnd(totalValue)}
            </span>
          </p>
          <p className="rounded-lg border border-olive-700/10 bg-white px-3 py-2">
            <span className="block text-xs text-muted">Đỉnh</span>
            <span className="font-bold text-olive-900">
              {metric === "orders" ? maxValue : formatVnd(maxValue)}
            </span>
          </p>
        </div>
      </div>
      <div className="h-[360px] px-2 pb-3 pt-5 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 8, right: 22, bottom: 52, left: 10 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={fillColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={fillColor} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e7dcc9" strokeDasharray="4 6" vertical={false} />
            <XAxis
              dataKey="bucket"
              minTickGap={26}
              tick={{ fill: "#6f715f", fontSize: 11 }}
              tickFormatter={formatFullDateTime}
              tickLine={false}
              axisLine={{ stroke: "#d8ccb8" }}
              angle={-20}
              textAnchor="end"
              height={76}
            />
            <YAxis
              width={72}
              tick={{ fill: "#6f715f", fontSize: 11 }}
              tickFormatter={(value) =>
                metric === "orders" ? String(value) : compactVnd(Number(value))
              }
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: strokeColor, strokeDasharray: "4 4" }}
              content={<ChartTooltip metric={metric} />}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              name={metric === "orders" ? "Số đơn" : "Doanh thu"}
              stroke={strokeColor}
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 6, strokeWidth: 3, stroke: "#ffffff" }}
              dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  label,
  payload,
  metric
}: {
  active?: boolean;
  label?: string;
  payload?: { value?: number }[];
  metric: "orders" | "revenue";
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = Number(payload[0]?.value ?? 0);

  return (
    <div className="rounded-lg border border-olive-700/10 bg-white px-4 py-3 text-sm shadow-lg">
      <p className="font-bold text-olive-900">{formatFullDateTime(label)}</p>
      <p className="mt-2 text-muted">
        {metric === "orders" ? "Số đơn" : "Doanh thu"}:{" "}
        <span className="font-bold text-olive-900">
          {metric === "orders" ? value : formatVnd(value)}
        </span>
      </p>
    </div>
  );
}

function formatFullDateTime(value: string | undefined) {
  if (!value) {
    return "-";
  }

  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(date);
}

function compactVnd(value: number) {
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}tr`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }

  return String(value);
}

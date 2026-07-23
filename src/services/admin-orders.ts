import "server-only";
import type { QueryResultRow } from "pg";
import { query, transaction, type TransactionClient } from "@/db/client";
import type { AdminPermission } from "@/lib/admin/permissions";
import { hasPermission } from "@/lib/admin/permissions";
import {
  canTransitionOrderStatus,
  type OrderStatus
} from "@/lib/order-status";

type AdminSession = {
  user: {
    id: string;
    role?: string | null;
  };
};

type OrderRow = QueryResultRow & {
  id: string;
  order_code: string;
  customer_id: string;
  status: OrderStatus;
  fulfillment_type: "DELIVERY" | "PICKUP";
  delivery_date: string | null;
  delivery_time_slot: string | null;
  subtotal_amount: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  customer_note: string | null;
  internal_note: string | null;
  approved_at: Date | null;
  approved_by: string | null;
  rejected_at: Date | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: Date;
  updated_at: Date;
  customer_full_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address_line: string | null;
  customer_ward: string | null;
  customer_district: string | null;
  customer_city: string | null;
  customer_notes: string | null;
};

type OrderItemRow = QueryResultRow & {
  id: string;
  order_id: string;
  item_name: string;
  item_snapshot: unknown;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: Date;
};

type OrderHistoryRow = QueryResultRow & {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  reason: string | null;
  changed_by: string | null;
  created_at: Date;
  changed_by_name: string | null;
  changed_by_email: string | null;
};

type ApprovalAdminRow = QueryResultRow & {
  approved_by_name: string | null;
  rejected_by_name: string | null;
  cancelled_by_name: string | null;
};

type OrderListRow = QueryResultRow & {
  id: string;
  order_code: string;
  status: OrderStatus;
  fulfillment_type: string;
  delivery_date: string | null;
  delivery_time_slot: string | null;
  total_amount: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
  customer_id: string;
  customer_full_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  total_count: string;
};

export class OrderApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "OrderApiError";
  }
}

export type OrderListInput = {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  sortBy: "createdAt" | "deliveryDate" | "orderCode" | "status" | "totalAmount";
  sortDirection: "asc" | "desc";
};

const sortColumnMap: Record<OrderListInput["sortBy"], string> = {
  createdAt: "o.created_at",
  deliveryDate: "o.delivery_date",
  orderCode: "o.order_code",
  status: "o.status",
  totalAmount: "o.total_amount"
};

export async function listAdminOrders(input: OrderListInput) {
  const values: unknown[] = [];
  const where: string[] = [];

  function addValue(value: unknown) {
    values.push(value);
    return `$${values.length}`;
  }

  if (input.status) {
    where.push(`o.status = ${addValue(input.status)}`);
  }

  if (input.customerId) {
    where.push(`o.customer_id = ${addValue(input.customerId)}`);
  }

  if (input.dateFrom) {
    where.push(`o.created_at >= ${addValue(input.dateFrom)}::date`);
  }

  if (input.dateTo) {
    where.push(`o.created_at < (${addValue(input.dateTo)}::date + interval '1 day')`);
  }

  if (input.search) {
    const searchParam = addValue(`%${input.search}%`);
    where.push(`(
      o.order_code ILIKE ${searchParam}
      OR c.full_name ILIKE ${searchParam}
      OR c.phone ILIKE ${searchParam}
      OR c.email ILIKE ${searchParam}
    )`);
  }

  const offset = (input.page - 1) * input.pageSize;
  const orderBy = sortColumnMap[input.sortBy];
  const direction = input.sortDirection.toUpperCase() === "ASC" ? "ASC" : "DESC";
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await query<OrderListRow>(
    `
      SELECT
        o.id,
        o.order_code,
        o.status,
        o.fulfillment_type,
        o.delivery_date,
        o.delivery_time_slot,
        o.total_amount,
        o.currency,
        o.created_at,
        o.updated_at,
        c.id AS customer_id,
        c.full_name AS customer_full_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        count(*) OVER()::text AS total_count
      FROM orders o
      INNER JOIN customers c ON c.id = o.customer_id
      ${whereSql}
      ORDER BY ${orderBy} ${direction}, o.id ${direction}
      LIMIT ${addValue(input.pageSize)}
      OFFSET ${addValue(offset)}
    `,
    values
  );

  const totalItems = Number(result.rows[0]?.total_count ?? 0);

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      orderCode: row.order_code,
      status: row.status,
      fulfillmentType: row.fulfillment_type,
      deliveryDate: row.delivery_date,
      deliveryTimeSlot: row.delivery_time_slot,
      totalAmount: row.total_amount,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customer: {
        id: row.customer_id,
        fullName: row.customer_full_name,
        phone: row.customer_phone,
        email: row.customer_email
      }
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / input.pageSize)
    }
  };
}

export type AdminOrderList = Awaited<ReturnType<typeof listAdminOrders>>;
export type AdminOrderListItem = AdminOrderList["items"][number];

export async function getAdminOrderDetail(orderId: string) {
  const order = await selectOrder(orderId);
  if (!order) {
    throw new OrderApiError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.", 404);
  }

  const [items, history, approvalAdmins] = await Promise.all([
    selectOrderItems(orderId),
    selectOrderHistory(orderId),
    selectApprovalAdmins(order)
  ]);

  return toOrderDetailDto(order, items, history, approvalAdmins);
}

export type AdminOrderDetail = Awaited<ReturnType<typeof getAdminOrderDetail>>;

export async function approveOrder(input: {
  orderId: string;
  adminSession: AdminSession;
  internalNote?: string;
  requestMeta: RequestMeta;
}) {
  return mutateOrderStatus({
    orderId: input.orderId,
    adminSession: input.adminSession,
    toStatus: "APPROVED",
    action: "orders.approve",
    reason: input.internalNote,
    internalNote: input.internalNote,
    requestMeta: input.requestMeta,
    validateBeforeUpdate: validateApprovalReadiness,
    updateFieldsSql: `
      status = $2,
      approved_at = now(),
      approved_by = $3,
      internal_note = COALESCE($4, internal_note)
    `,
    updateValues: (context) => [
      context.toStatus,
      context.adminId,
      context.internalNote ?? null
    ]
  });
}

export async function rejectOrder(input: {
  orderId: string;
  adminSession: AdminSession;
  reason: string;
  requestMeta: RequestMeta;
}) {
  return mutateOrderStatus({
    orderId: input.orderId,
    adminSession: input.adminSession,
    toStatus: "REJECTED",
    action: "orders.reject",
    reason: input.reason,
    requestMeta: input.requestMeta,
    updateFieldsSql: `
      status = $2,
      rejected_at = now(),
      rejected_by = $3,
      rejection_reason = $4
    `,
    updateValues: (context) => [
      context.toStatus,
      context.adminId,
      context.reason ?? null
    ]
  });
}

export async function cancelOrder(input: {
  orderId: string;
  adminSession: AdminSession;
  reason: string;
  requestMeta: RequestMeta;
}) {
  return mutateOrderStatus({
    orderId: input.orderId,
    adminSession: input.adminSession,
    toStatus: "CANCELLED",
    action: "orders.cancel",
    reason: input.reason,
    requestMeta: input.requestMeta,
    updateFieldsSql: `
      status = $2,
      cancelled_at = now(),
      cancelled_by = $3,
      cancellation_reason = $4
    `,
    updateValues: (context) => [
      context.toStatus,
      context.adminId,
      context.reason ?? null
    ]
  });
}

export async function updateOrderStatus(input: {
  orderId: string;
  adminSession: AdminSession;
  status: OrderStatus;
  reason?: string;
  requestMeta: RequestMeta;
}) {
  if (input.status === "REJECTED" || input.status === "CANCELLED") {
    throw new OrderApiError(
      "INVALID_ORDER_TRANSITION",
      "Vui lòng dùng workflow từ chối hoặc hủy đơn hàng.",
      409
    );
  }

  return mutateOrderStatus({
    orderId: input.orderId,
    adminSession: input.adminSession,
    toStatus: input.status,
    action: "orders.update_status",
    reason: input.reason,
    requestMeta: input.requestMeta,
    updateFieldsSql: "status = $2",
    updateValues: (context) => [context.toStatus]
  });
}

type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

type MutateOrderStatusInput = {
  orderId: string;
  adminSession: AdminSession;
  toStatus: OrderStatus;
  action: AdminPermission;
  reason?: string;
  internalNote?: string;
  requestMeta: RequestMeta;
  updateFieldsSql: string;
  updateValues: (context: {
    toStatus: OrderStatus;
    adminId: string;
    reason?: string;
    internalNote?: string;
  }) => unknown[];
  validateBeforeUpdate?: (
    order: OrderRow,
    items: OrderItemRow[]
  ) => void;
};

async function mutateOrderStatus(input: MutateOrderStatusInput) {
  return transaction(async (client) => {
    const order = await selectOrderForUpdate(client, input.orderId);
    if (!order) {
      throw new OrderApiError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.", 404);
    }

    const items = await selectOrderItems(input.orderId, client);

    if (!canTransitionOrderStatus(order.status, input.toStatus)) {
      throw new OrderApiError(
        "INVALID_ORDER_TRANSITION",
        "Đơn hàng không thể chuyển sang trạng thái này.",
        409
      );
    }

    if (
      order.status === "PREPARING" &&
      input.toStatus === "CANCELLED" &&
      !hasPermission(input.adminSession, "orders.cancel")
    ) {
      throw new OrderApiError(
        "FORBIDDEN_ORDER_TRANSITION",
        "Bạn không có quyền hủy đơn đang chuẩn bị.",
        403
      );
    }

    input.validateBeforeUpdate?.(order, items);

    const updatedResult = await client.query<OrderRow>(
      `
        UPDATE orders
        SET
          ${input.updateFieldsSql}
        WHERE id = $1
        RETURNING *
      `,
      [
        input.orderId,
        ...input.updateValues({
          toStatus: input.toStatus,
          adminId: input.adminSession.user.id,
          reason: input.reason,
          internalNote: input.internalNote
        })
      ]
    );

    const updatedOrder = await selectOrderForUpdate(client, updatedResult.rows[0].id);
    if (!updatedOrder) {
      throw new OrderApiError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.", 404);
    }

    await insertStatusHistory(client, {
      orderId: input.orderId,
      fromStatus: order.status,
      toStatus: input.toStatus,
      reason: input.reason ?? null,
      adminId: input.adminSession.user.id
    });

    await insertAuditLog(client, {
      actorAdminId: input.adminSession.user.id,
      action: input.action,
      entityType: "order",
      entityId: input.orderId,
      metadata: {
        orderCode: order.order_code,
        fromStatus: order.status,
        toStatus: input.toStatus,
        reason: input.reason ?? null
      },
      ipAddress: input.requestMeta.ipAddress,
      userAgent: input.requestMeta.userAgent
    });

    const history = await selectOrderHistory(input.orderId, client);
    const approvalAdmins = await selectApprovalAdmins(updatedOrder, client);

    return toOrderDetailDto(updatedOrder, items, history, approvalAdmins);
  });
}

function validateApprovalReadiness(order: OrderRow, items: OrderItemRow[]) {
  if (order.status !== "PENDING") {
    throw new OrderApiError(
      "INVALID_ORDER_TRANSITION",
      "Đơn hàng không thể được duyệt ở trạng thái hiện tại.",
      409
    );
  }

  if (items.length === 0) {
    throw new OrderApiError(
      "INVALID_ORDER_FOR_APPROVAL",
      "Đơn hàng cần có ít nhất một món trước khi duyệt.",
      422
    );
  }

  const subtotal = items.reduce((sum, item) => {
    if (item.quantity <= 0 || item.unit_price < 0 || item.line_total < 0) {
      throw new OrderApiError(
        "INVALID_ORDER_FOR_APPROVAL",
        "Thông tin món trong đơn hàng không hợp lệ.",
        422
      );
    }

    if (item.quantity * item.unit_price !== item.line_total) {
      throw new OrderApiError(
        "INVALID_ORDER_FOR_APPROVAL",
        "Tổng tiền từng món không khớp.",
        422
      );
    }

    return sum + item.line_total;
  }, 0);

  if (order.subtotal_amount !== subtotal) {
    throw new OrderApiError(
      "INVALID_ORDER_FOR_APPROVAL",
      "Tạm tính đơn hàng không khớp với danh sách món.",
      422
    );
  }

  const expectedTotal =
    order.subtotal_amount + order.delivery_fee - order.discount_amount;

  if (order.total_amount !== expectedTotal) {
    throw new OrderApiError(
      "INVALID_ORDER_FOR_APPROVAL",
      "Tổng tiền đơn hàng không hợp lệ.",
      422
    );
  }

  if (
    order.fulfillment_type === "DELIVERY" &&
    (!order.delivery_date ||
      !order.delivery_time_slot ||
      !order.customer_address_line ||
      !order.customer_district ||
      !order.customer_city)
  ) {
    throw new OrderApiError(
      "INVALID_ORDER_FOR_APPROVAL",
      "Đơn giao hàng cần đủ ngày, khung giờ và địa chỉ giao.",
      422
    );
  }
}

async function selectOrder(orderId: string, client?: TransactionClient) {
  const executor = client ?? { query };
  const result = await executor.query<OrderRow>(
    `
      SELECT
        o.*,
        c.full_name AS customer_full_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address_line AS customer_address_line,
        c.ward AS customer_ward,
        c.district AS customer_district,
        c.city AS customer_city,
        c.notes AS customer_notes
      FROM orders o
      INNER JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1
      LIMIT 1
    `,
    [orderId]
  );

  return result.rows[0] ?? null;
}

async function selectOrderForUpdate(client: TransactionClient, orderId: string) {
  const result = await client.query<OrderRow>(
    `
      SELECT
        o.*,
        c.full_name AS customer_full_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address_line AS customer_address_line,
        c.ward AS customer_ward,
        c.district AS customer_district,
        c.city AS customer_city,
        c.notes AS customer_notes
      FROM orders o
      INNER JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1
      FOR UPDATE OF o
    `,
    [orderId]
  );

  return result.rows[0] ?? null;
}

async function selectOrderItems(orderId: string, client?: TransactionClient) {
  const executor = client ?? { query };
  const result = await executor.query<OrderItemRow>(
    `
      SELECT
        id,
        order_id,
        item_name,
        item_snapshot,
        quantity,
        unit_price,
        line_total,
        created_at
      FROM order_items
      WHERE order_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [orderId]
  );

  return result.rows;
}

async function selectOrderHistory(orderId: string, client?: TransactionClient) {
  const executor = client ?? { query };
  const result = await executor.query<OrderHistoryRow>(
    `
      SELECT
        h.id,
        h.order_id,
        h.from_status,
        h.to_status,
        h.reason,
        h.changed_by,
        h.created_at,
        a.name AS changed_by_name,
        a.email AS changed_by_email
      FROM order_status_history h
      LEFT JOIN admin_users a ON a.id = h.changed_by
      WHERE h.order_id = $1
      ORDER BY h.created_at ASC, h.id ASC
    `,
    [orderId]
  );

  return result.rows;
}

async function selectApprovalAdmins(order: OrderRow, client?: TransactionClient) {
  const executor = client ?? { query };
  const result = await executor.query<ApprovalAdminRow>(
    `
      SELECT
        approved.name AS approved_by_name,
        rejected.name AS rejected_by_name,
        cancelled.name AS cancelled_by_name
      FROM orders o
      LEFT JOIN admin_users approved ON approved.id = o.approved_by
      LEFT JOIN admin_users rejected ON rejected.id = o.rejected_by
      LEFT JOIN admin_users cancelled ON cancelled.id = o.cancelled_by
      WHERE o.id = $1
      LIMIT 1
    `,
    [order.id]
  );

  return result.rows[0] ?? {
    approved_by_name: null,
    rejected_by_name: null,
    cancelled_by_name: null
  };
}

async function insertStatusHistory(
  client: TransactionClient,
  input: {
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    reason: string | null;
    adminId: string;
  }
) {
  await client.query(
    `
      INSERT INTO order_status_history (
        order_id,
        from_status,
        to_status,
        reason,
        changed_by
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      input.orderId,
      input.fromStatus,
      input.toStatus,
      input.reason,
      input.adminId
    ]
  );
}

async function insertAuditLog(
  client: TransactionClient,
  input: {
    actorAdminId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
    ipAddress: string | null;
    userAgent: string | null;
  }
) {
  await client.query(
    `
      INSERT INTO audit_logs (
        actor_admin_id,
        action,
        entity_type,
        entity_id,
        metadata,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.actorAdminId,
      input.action,
      input.entityType,
      input.entityId,
      JSON.stringify(input.metadata),
      input.ipAddress,
      input.userAgent
    ]
  );
}

function toOrderDetailDto(
  order: OrderRow,
  items: OrderItemRow[],
  history: OrderHistoryRow[],
  approvalAdmins: ApprovalAdminRow
) {
  return {
    id: order.id,
    orderCode: order.order_code,
    status: order.status,
    fulfillmentType: order.fulfillment_type,
    deliveryDate: order.delivery_date,
    deliveryTimeSlot: order.delivery_time_slot,
    currency: order.currency,
    customerNote: order.customer_note,
    internalNote: order.internal_note,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    customer: {
      id: order.customer_id,
      fullName: order.customer_full_name,
      phone: order.customer_phone,
      email: order.customer_email,
      addressLine: order.customer_address_line,
      ward: order.customer_ward,
      district: order.customer_district,
      city: order.customer_city,
      notes: order.customer_notes
    },
    items: items.map((item) => ({
      id: item.id,
      itemName: item.item_name,
      itemSnapshot: item.item_snapshot,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      createdAt: item.created_at
    })),
    pricing: {
      subtotalAmount: order.subtotal_amount,
      deliveryFee: order.delivery_fee,
      discountAmount: order.discount_amount,
      totalAmount: order.total_amount
    },
    approvals: {
      approvedAt: order.approved_at,
      approvedBy: order.approved_by
        ? { id: order.approved_by, name: approvalAdmins.approved_by_name }
        : null,
      rejectedAt: order.rejected_at,
      rejectedBy: order.rejected_by
        ? { id: order.rejected_by, name: approvalAdmins.rejected_by_name }
        : null,
      rejectionReason: order.rejection_reason,
      cancelledAt: order.cancelled_at,
      cancelledBy: order.cancelled_by
        ? { id: order.cancelled_by, name: approvalAdmins.cancelled_by_name }
        : null,
      cancellationReason: order.cancellation_reason
    },
    statusHistory: history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.from_status,
      toStatus: entry.to_status,
      reason: entry.reason,
      changedBy: entry.changed_by
        ? {
            id: entry.changed_by,
            name: entry.changed_by_name,
            email: entry.changed_by_email
          }
        : null,
      createdAt: entry.created_at
    }))
  };
}

export const orderStatuses = [
  "PENDING",
  "APPROVED",
  "PREPARING",
  "READY",
  "DELIVERING",
  "COMPLETED",
  "REJECTED",
  "CANCELLED"
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const terminalOrderStatuses: OrderStatus[] = [
  "COMPLETED",
  "REJECTED",
  "CANCELLED"
];

const transitionMap: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERING", "COMPLETED"],
  DELIVERING: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: []
};

export function isOrderStatus(value: string): value is OrderStatus {
  return orderStatuses.includes(value as OrderStatus);
}

export function canTransitionOrderStatus(
  fromStatus: OrderStatus,
  toStatus: OrderStatus
) {
  return transitionMap[fromStatus].includes(toStatus);
}

export function getAllowedOrderTransitions(status: OrderStatus) {
  return transitionMap[status];
}

import type { OrderStatus } from "@/lib/order-status";

export type PaginationDto = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AdminOrderListItemDto = {
  id: string;
  orderCode: string;
  status: OrderStatus;
  fulfillmentType: string;
  deliveryDate: string | null;
  deliveryTimeSlot: string | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  };
};

export type AdminOrderListDto = {
  items: AdminOrderListItemDto[];
  pagination: PaginationDto;
};

export type AdminCustomerListItemDto = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  district: string | null;
  city: string | null;
  createdAt: string;
  totalOrders: number;
  completedValue: number;
  latestOrderAt: string | null;
};

export type AdminCustomerListDto = {
  items: AdminCustomerListItemDto[];
  pagination: PaginationDto;
};

export type OrderAnalyticsDto = {
  timezone: string;
  mode: "1d" | "3d" | "7d" | "custom";
  bucketUnit: "hour" | "day" | "week" | "month";
  range: {
    dateFrom: string | null;
    dateTo: string | null;
  };
  revenueStatuses: string[];
  summary: {
    totalOrders: number;
    pendingOrders: number;
    approvedOrders: number;
    completedOrders: number;
    rejectedOrders: number;
    cancelledOrders: number;
    grossRevenue: number;
    averageOrderValue: number;
    approvalRate: number;
  };
  series: {
    bucket: string;
    orderCount: number;
    approvedCount: number;
    completedCount: number;
    grossRevenue: number;
  }[];
};

export function toClientDto<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export type {
  AdminCustomerListDto,
  AdminCustomerListItemDto,
  AdminOrderListDto,
  AdminOrderListItemDto,
  OrderAnalyticsDto,
  PaginationDto
} from "@bep-nha-minh/shared/types/admin";

export function toClientDto<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

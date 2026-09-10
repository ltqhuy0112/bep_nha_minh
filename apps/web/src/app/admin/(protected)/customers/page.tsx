import { requirePermission } from "@/lib/admin/session";
import { customerListQuerySchema } from "@bep-nha-minh/api/lib/admin/customer-validation";
import { listAdminCustomers } from "@bep-nha-minh/api/services/admin-customers";
import { CustomerListClient } from "@/components/admin/customer-list-client";
import { toClientDto } from "@/components/admin/client-types";
import type { AdminCustomerListDto } from "@bep-nha-minh/shared/types/admin";

type CustomersSearchParams = Promise<Record<string, string | undefined>>;

export default async function AdminCustomersPage({
  searchParams
}: {
  searchParams: CustomersSearchParams;
}) {
  await requirePermission("customers.view");
  const params = await searchParams;
  const parsed = customerListQuerySchema.safeParse(params);
  const filters = parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: 20,
        search: undefined,
        dateFrom: undefined,
        dateTo: undefined
      };
  const customers = await listAdminCustomers(filters);

  return (
    <CustomerListClient
      initialCustomers={toClientDto<AdminCustomerListDto>(customers)}
      initialFilters={{
        page: filters.page,
        pageSize: filters.pageSize,
        search: filters.search ?? "",
        dateFrom: filters.dateFrom ?? "",
        dateTo: filters.dateTo ?? ""
      }}
    />
  );
}

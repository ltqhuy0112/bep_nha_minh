import type { CustomerAddress, CustomerAddressInput } from "@bep-nha-minh/shared/schemas/customer-address";

export class AddressRequestError extends Error {
  constructor(public readonly status: number) { super("Address request failed."); }
}
async function request<T>(path: string, method: string, body?: object, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(`/api/customer-addresses${path}`, {
    method, cache: "no-store", credentials: "same-origin",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new AddressRequestError(response.status);
  return result.data;
}
export const listAddresses = (signal: AbortSignal) => request<{ items: CustomerAddress[] }>("", "GET", undefined, signal);
export const saveAddress = (input: CustomerAddressInput, id?: string) => request<CustomerAddress>(id ? `/${id}` : "", id ? "PUT" : "POST", input);
export const deleteAddress = (id: string) => request<{ accepted: boolean }>(`/${id}`, "DELETE", {});
export const defaultAddress = (id: string) => request<CustomerAddress>(`/${id}/default`, "PUT", {});

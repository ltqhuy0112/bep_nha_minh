import type { ApiEnvelope, AuthConfig, CustomerSession } from "./types";

export function getConfig(signal: AbortSignal) { return request<AuthConfig>("config", { method: "GET", signal }); }
export function getSession(signal: AbortSignal) { return request<CustomerSession>("session", { method: "GET", signal }); }
export function postCustomerAuth<T>(endpoint: string, body: object, signal: AbortSignal) { return request<T>(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal }); }

export class CustomerAuthRequestError extends Error {
  constructor(public readonly status: number) {
    super("Customer authentication request failed.");
  }
}

type InitialAuth = { config: AuthConfig; session: CustomerSession | null };
let initialRequest: Promise<InitialAuth> | null = null;

// Share only in-flight reads across effect remounts; never cache a settled session.
export function loadInitialAuth(): Promise<InitialAuth> {
  if (initialRequest) return initialRequest;
  const signal = AbortSignal.timeout(15_000);
  const pending = Promise.allSettled([
    getConfig(signal),
    getSession(signal).catch((error: unknown) => {
      if (error instanceof CustomerAuthRequestError && error.status === 401) return null;
      throw error;
    }),
  ]).then(([config, session]) => {
    if (config.status === "rejected") throw config.reason;
    if (session.status === "rejected") throw session.reason;
    return { config: config.value, session: session.value };
  });
  initialRequest = pending;
  const clear = () => { if (initialRequest === pending) initialRequest = null; };
  void pending.then(clear, clear);
  return pending;
}

async function request<T>(endpoint: string, init: RequestInit): Promise<T> {
  const response = await fetch(`/api/customer-auth/${endpoint}`, { ...init, cache: "no-store", credentials: "same-origin" });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || "error" in envelope) throw new CustomerAuthRequestError(response.status);
  return envelope.data;
}

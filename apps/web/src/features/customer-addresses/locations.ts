import type { LocationList } from "@bep-nha-minh/shared/types/locations";

const cache = new Map<string, { expires: number; data: LocationList }>();
const pending = new Map<string, Promise<LocationList>>();
export function loadLocations(provinceCode?: string, refresh = false): Promise<LocationList> {
  const key = provinceCode ?? "provinces";
  const existing = cache.get(key);
  if (!refresh && existing && existing.expires > Date.now()) return Promise.resolve(existing.data);
  const current = pending.get(key);
  if (current) return current;
  const request = (async () => {
    const response = await fetch(`/api/locations/provinces${provinceCode ? `/${provinceCode}/wards` : ""}`, {
      cache: refresh ? "reload" : "default", credentials: "omit", signal: AbortSignal.timeout(15000),
    });
    const envelope = await response.json();
    if (!response.ok || envelope.error || !Array.isArray(envelope.data?.items)) throw new Error("Location lookup failed");
    const data: LocationList = envelope.data;
    if (cache.size >= 128) cache.clear();
    cache.set(key, { expires: Date.now() + 300_000, data });
    return data;
  })();
  pending.set(key, request);
  const clear = () => { if (pending.get(key) === request) pending.delete(key); };
  void request.then(clear, clear);
  return request;
}

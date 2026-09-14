import "server-only";

export const privateResponseHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

export function isHttpOrigin(url: URL) {
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
    !url.search && !url.hash && url.pathname === "/";
}

export function forwardNumericRetryAfter(response: Response, headers: Headers) {
  const retry = response.headers.get("retry-after");
  if (retry && /^\d+$/.test(retry)) headers.set("retry-after", retry);
}

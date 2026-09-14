import "server-only";

// Cart and address mutations share the same 16 KiB / 5 second body policy.
export async function boundedBody(request: Pick<Request, "body">) {
  const reader = request.body?.getReader();
  if (!reader) return "{}";
  let expired = false;
  const timer = setTimeout(() => { expired = true; void reader.cancel().catch(() => undefined); }, 5_000);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (expired) throw new Error("Body timeout");
      if (done) return Buffer.concat(chunks).toString("utf8");
      size += value.length;
      if (size > 16_384) { await reader.cancel(); return undefined; }
      chunks.push(value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

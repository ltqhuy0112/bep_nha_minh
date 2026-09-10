const locale = { type: "string", enum: ["vi", "en"] };
const version = { type: "integer", minimum: 0, maximum: 2147483646 };
const command = (action: string, properties: Record<string, unknown>, required: string[]) => ({
  type: "object", additionalProperties: false, properties: { action: { const: action }, locale, ...properties }, required: ["action", "locale", ...required],
});
const item = { type: "object", properties: {
  slug: { type: "string" }, name: { type: "string" }, quantity: { type: "integer" }, unitPrice: { type: "integer" },
  currency: { const: "VND" }, priceVersion: { type: "integer" }, acceptingOrders: { type: "boolean" },
  fulfillmentBlocked: { type: "boolean" }, availableQuantity: { type: ["integer", "null"] },
} };
const cart = { type: "object", properties: {
  id: { type: ["string", "null"], format: "uuid" }, version, owner: { enum: ["guest", "account"] },
  businessDate: { type: ["string", "null"], format: "date" }, slotKey: { type: ["string", "null"] },
  items: { type: "array", items: item }, totalQuantity: { type: "integer" }, subtotal: { type: "integer" },
  limits: { type: "object", properties: { perProduct: { type: "integer" }, total: { type: "integer" } } },
} };
const responses = {
  "200": { description: "Current owner cart; prices and availability are advisory, no stock reserved. Reads never create carts.", content: { "application/json": { schema: {
    type: "object", properties: { version: { const: "v1" }, data: { ...cart, properties: { ...cart.properties, guestCart: { anyOf: [cart, { type: "null" }] } } } },
  } } } },
  "400": { description: "Strict schema/query validation failure" }, "401": { description: "Invalid/revoked session or malformed/duplicate cart cookie; never silently changes owner" },
  "403": { description: "Untrusted mutation Origin" }, "409": { description: "Stale version, quantity limit, unavailable product/slot or explicit merge slot decision needed. No partial mutation." },
  "413": { description: "Body exceeds 16 KiB" }, "429": { description: "Shared network mutation rate limit" }, "503": { description: "Required rate policy or account auth unavailable" },
};
export const cartOpenApiPaths = {
  "/api/v1/cart": {
    get: { tags: ["Cart"], summary: "Read current guest/account cart", parameters: [{ name: "locale", in: "query", required: true, schema: locale }], responses },
    post: { tags: ["Cart"], summary: "Initialize or mutate current cart", description: "Cookie-owned only. Guest initialization issues a random HttpOnly session cookie. Account merge requires both cookies; success consumes the guest cart. No client-supplied owner/cart ID or price.",
      requestBody: { required: true, content: { "application/json": { schema: { oneOf: [
        command("initialize", {}, []),
        command("set-item", { expectedVersion: version, slug: { type: "string", maxLength: 160 }, quantity: { type: "integer", minimum: 0 }, source: { enum: ["guest", "account"] } }, ["expectedVersion", "slug", "quantity"]),
        command("set-slot", { expectedVersion: version, businessDate: { type: "string", format: "date" }, slotKey: { type: "string", maxLength: 80 } }, ["expectedVersion", "businessDate", "slotKey"]),
        command("merge", { expectedVersion: version, guestVersion: version, slotSource: { enum: ["guest", "account"] } }, ["expectedVersion", "guestVersion"]),
      ] } } } }, responses },
  },
};

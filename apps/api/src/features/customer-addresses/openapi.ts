const properties = {
  recipientName: { type: "string", minLength: 1, maxLength: 120 },
  phone: { type: "string", pattern: "^\\+?[0-9][0-9 ()-]{6,23}$", description: "7-15 digits, with optional leading plus, spaces, parentheses or hyphens." },
  addressLine: { type: "string", minLength: 1, maxLength: 500 },
  provinceCode: { type: "string", pattern: "^[0-9]{2}$" },
  wardCode: { type: "string", pattern: "^[0-9]{5}$" },
  isDefault: { type: "boolean" },
};
const required = ["recipientName", "phone", "addressLine", "provinceCode", "wardCode", "isDefault"];
const address = { type: "object", required: [...required, "id", "createdAt", "updatedAt"], properties: {
  ...properties, id: { type: "string", format: "uuid" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
  provinceCode: { type: ["string", "null"] }, wardCode: { type: ["string", "null"] },
  city: { type: "string", readOnly: true }, ward: { type: ["string", "null"], readOnly: true },
  district: { type: ["string", "null"], readOnly: true, description: "Legacy addresses only; not accepted in write requests." },
  provinceNameEn: { type: ["string", "null"], readOnly: true }, wardNameEn: { type: ["string", "null"], readOnly: true },
  locationDatasetId: { type: ["string", "null"], readOnly: true },
} };
const body = (schema: object) => ({ required: true, content: { "application/json": { schema } } });
const success = (schema: object) => ({ description: "No-store v1 data envelope", content: { "application/json": { schema: {
  type: "object", required: ["version", "data"], properties: { version: { const: "v1" }, data: schema },
} } } });
const error = { description: "No-store v1 error envelope: {version:'v1',error:{code,message}}." };
const errors = { "400": error, "401": error, "403": error, "404": error, "405": error, "413": error, "415": error, "429": error, "500": error, "503": error };
const common = { tags: ["Customer addresses"], description: "Customer session cookie required (bnm_customer_session or __Host-bnm_customer_session on HTTPS). Mutations require exact PUBLIC_WEB_URL Origin and JSON. Ownership comes only from the session; foreign IDs return 404. Default changes and audit writes are atomic. No address data enters audit metadata. Production auth gate remains closed." };
const id = { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } };
export const customerAddressOpenApiPaths = {
  "/api/v1/customer-addresses": {
    get: { ...common, summary: "List own saved addresses", responses: { "200": success({ type: "object", properties: { items: { type: "array", items: address } }, required: ["items"] }), ...errors } },
    post: { ...common, summary: "Create a saved address", requestBody: body({ type: "object", additionalProperties: false, required, properties }), responses: { "201": success(address), ...errors } },
  },
  "/api/v1/customer-addresses/{id}": {
    put: { ...common, summary: "Replace own saved address", parameters: [id], requestBody: body({ type: "object", additionalProperties: false, required, properties }), responses: { "200": success(address), ...errors } },
    delete: { ...common, summary: "Delete own address without changing order snapshots or promoting another default", parameters: [id], requestBody: body({ type: "object", additionalProperties: false }), responses: { "200": success({ type: "object", properties: { accepted: { const: true } }, required: ["accepted"] }), ...errors } },
  },
  "/api/v1/customer-addresses/{id}/default": {
    put: { ...common, summary: "Select the default address", parameters: [id], requestBody: body({ type: "object", additionalProperties: false }), responses: { "200": success(address), ...errors } },
  },
};

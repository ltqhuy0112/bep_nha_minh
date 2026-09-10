const response = { description: "Reference list cached for 300 seconds. Official codes are zero-padded strings; English names are community translations.", content: {
  "application/json": { schema: { type: "object", required: ["version", "data"], properties: {
    version: { const: "v1" }, data: { type: "object", required: ["datasetId", "items"], properties: {
      datasetId: { type: "string", description: "Pinned source revision" }, items: { type: "array", items: {
        type: "object", required: ["code", "name", "nameEn"], properties: { code: { type: "string" }, name: { type: "string" }, nameEn: { type: "string" } },
      } },
    } },
  } } },
} };
const error = { description: "v1 error envelope; no-store. No external provider fallback." };
export const locationOpenApiPaths = {
  "/api/v1/locations/provinces": { get: {
    tags: ["Locations"], summary: "List Vietnamese provinces/cities in the active dataset", responses: { "200": response, "400": error, "405": error, "503": error },
  } },
  "/api/v1/locations/provinces/{provinceCode}/wards": { get: {
    tags: ["Locations"], summary: "List wards/communes/special zones directly under a province", parameters: [
      { in: "path", name: "provinceCode", required: true, schema: { type: "string", pattern: "^[0-9]{2}$" } },
    ], responses: { "200": response, "400": error, "404": error, "405": error, "503": error },
  } },
};

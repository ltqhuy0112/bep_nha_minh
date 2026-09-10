const error = { description: "v1 error envelope: {version:'v1',error:{code,message}}. No-store; no credentials in the response." };
const accepted = { description: "Generic accepted response; does not disclose whether an email is registered." };
const email = { type: "string", format: "email", maxLength: 255 };
const password = { type: "string", minLength: 12, maxLength: 72, description: "At least 12 characters; at most 72 UTF-8 bytes. Never logged." };
const token = { type: "string", pattern: "^[A-Za-z0-9_-]{43}$", writeOnly: true };
const locale = { type: "string", enum: ["vi", "en"], default: "vi" };
const bodies: Record<string, { properties: Record<string, unknown>; required: string[] }> = {
  register: { properties: { email, password, fullName: { type: "string", minLength: 1, maxLength: 120 }, locale }, required: ["email", "password", "fullName"] },
  login: { properties: { email, password: { ...password, minLength: 1 } }, required: ["email", "password"] },
  "forgot-password": { properties: { email, locale }, required: ["email"] },
  "reset-password": { properties: { token, password }, required: ["token", "password"] },
  "verify-email": { properties: { token }, required: ["token"] },
  "resend-verification": { properties: { locale }, required: [] },
  logout: { properties: {}, required: [] },
  "logout-all": { properties: {}, required: [] }
};

export const customerAuthOpenApiPaths = Object.fromEntries([
  ...["google", "facebook"].flatMap((provider) => [
    [`/api/v1/customer-auth/oauth/${provider}/start`, { get: {
      tags: ["Customer auth"], summary: `Start ${provider} sign-in`,
      description: "Enabled only by backend provider configuration. Creates a 10-minute single-use transaction and browser-binding HttpOnly cookie. No arbitrary return URL.",
      parameters: [{ in: "query", name: "locale", schema: locale }],
      responses: { "302": { description: "Redirect to the configured provider authorization endpoint; no-store." }, "400": error, "403": error, "429": error, "503": error }
    } }],
    [`/api/v1/customer-auth/oauth/${provider}/callback`, { get: {
      tags: ["Customer auth"], summary: `Handle ${provider} authorization callback`,
      description: "Browser-bound state is atomically consumed before server-side code exchange. Identity resolves by provider and subject only, never by matching email. Session secret is issued only in HttpOnly Set-Cookie. Callback URL is an environment-only allowlisted BFF URL.",
      parameters: [{ in: "query", name: "state", required: true, schema: token },
        { in: "query", name: "code", schema: { type: "string", maxLength: 4096 } },
        { in: "query", name: "error", schema: { type: "string", maxLength: 128 } }],
      responses: { "303": { description: "Fixed locale account destination, optionally oauth=error; never includes tokens or provider diagnostics." },
        "400": error, "405": error, "429": error, "503": error }
    } }]
  ]),
  ...["config", "session"].map((action) => [`/api/v1/customer-auth/${action}`, { get: {
    tags: ["Customer auth"], summary: action === "config" ? "Read feature availability" : "Read the customer session",
    description: "Admin cookies are not customer credentials. Session is stored as a hash and expires after 30 days without sliding renewal.",
    responses: { "200": { description: "v1 data envelope with availability or {account,expiresAt}. No-store." }, "401": error, "503": error }
  } }]),
  ...Object.entries(bodies).map(([action, schema]) => [`/api/v1/customer-auth/${action}`, { post: {
    tags: ["Customer auth"], summary: `Customer ${action}`,
    description: "Disabled by default; production gate remains closed. Exact PUBLIC_WEB_URL Origin and application/json required. Customer HttpOnly cookie only. No token query parameters. Reset and verification require explicit POST, not GET.",
    parameters: [{ in: "header", name: "Origin", required: true, schema: { type: "string", format: "uri" } }],
    requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, ...schema } } } },
    responses: { [action === "register" || action === "forgot-password" || action === "resend-verification" ? "202" : "200"]:
      action === "login" ? { description: "{version:'v1',data:{account,expiresAt}}; session secret is only in Set-Cookie." } : accepted,
      "400": error, "401": error, "403": error, "405": error, "413": error, "415": error, "429": error, "500": error, "503": error }
  } }])
]);

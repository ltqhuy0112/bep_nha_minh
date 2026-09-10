import assert from "node:assert/strict";
import { authPath, consumeOAuthReturn, isAuthMode, rememberOAuthReturn, safeReturnTo } from "../../apps/web/src/features/customer-auth/routes";

for (const locale of ["vi", "en"] as const) {
  for (const invalid of [undefined, null, ["/vi/menu"], "https://evil.test", "//evil.test", "javascript:alert(1)", "/admin", `/${locale}/account?next=//evil.test`, `/${locale}/../admin`, `/${locale}/menu#x`, `/${locale}/%63heckout`, "/\\evil.test"]) {
    assert.equal(safeReturnTo(invalid, locale), `/${locale}/account`);
  }
  assert.equal(safeReturnTo(`/${locale}/checkout`, locale), `/${locale}/checkout`);
  assert.equal(safeReturnTo(`/${locale}/account/addresses`, locale), `/${locale}/account/addresses`);
  assert.equal(safeReturnTo(`/${locale}/account/addresses?owner=other`, locale), `/${locale}/account`);
  assert.equal(authPath(locale, "register", `/${locale}/menu`), `/${locale}/auth/register?next=%2F${locale}%2Fmenu`);
  assert.equal(authPath(locale, "login"), `/${locale}/auth/login`);
}
assert.equal(safeReturnTo("/en/checkout", "vi"), "/vi/account");
assert.equal(isAuthMode("reset-password"), true);
assert.equal(isAuthMode("../admin"), false);

const entries = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
  getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => entries.set(key, value),
  removeItem: (key: string) => entries.delete(key)
} });
rememberOAuthReturn("vi", "/vi/menu");
assert.equal(consumeOAuthReturn("vi"), "/vi/menu");
assert.equal(consumeOAuthReturn("vi"), "/vi/account");
rememberOAuthReturn("vi", "//evil.test");
assert.equal(consumeOAuthReturn("vi"), "/vi/account");
entries.set("bnm_auth_return", JSON.stringify({ locale: "vi", target: "/vi/menu", expires: Date.now() - 1 }));
assert.equal(consumeOAuthReturn("vi"), "/vi/account");
entries.set("bnm_auth_return", "invalid-json");
assert.equal(consumeOAuthReturn("vi"), "/vi/account");
rememberOAuthReturn("vi", "/vi/menu");
assert.equal(consumeOAuthReturn("en"), "/en/account");
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("blocked"); } });
rememberOAuthReturn("vi", "/vi/menu");
assert.equal(consumeOAuthReturn("vi"), "/vi/account");
console.log("Auth route checks passed: modes, strict destination allowlist, locale isolation, single-use return hint, expiry, malformed/blocked storage.");

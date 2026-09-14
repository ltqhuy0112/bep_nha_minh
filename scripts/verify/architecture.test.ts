import assert from "node:assert/strict";
import { test } from "node:test";
import { createSiteContents } from "@bep-nha-minh/shared/content/site-content";
import { inspectSource, publicBoundaryViolations } from "./source-imports";
import { graphViolations } from "./source-graph";
import { formatPrice } from "../../apps/web/src/lib/money";
import { getProductPresentation } from "../../apps/web/src/lib/product-presentation";
import { authPath } from "../../apps/web/src/features/customer-auth/public";

test("content defaults and per-app overrides preserve both locales", () => {
  const defaults = createSiteContents();
  const custom = createSiteContents({ instagramUrl: "https://example.com/ig", facebookUrl: "" });
  for (const locale of ["vi", "en"] as const) {
    assert.equal(custom[locale].social.links[0].href, "https://example.com/ig");
    assert.equal(custom[locale].social.links[1].href, defaults[locale].social.links[1].href);
    assert.deepEqual(custom[locale].dishes, defaults[locale].dishes);
  }
  custom.vi.dishes[0].name = "Changed";
  assert.notEqual(custom.vi.dishes[0].name, createSiteContents().vi.dishes[0].name);
});

test("neutral presentation preserves currency, locale and fallback behavior", () => {
  for (const locale of ["vi", "en"] as const) {
    for (const currency of ["VND", "USD"]) {
      const expected = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
        style: "currency", currency, maximumFractionDigits: 0
      }).format(12345.6);
      assert.equal(formatPrice(12345.6, currency, locale), expected);
    }
    assert.equal(getProductPresentation("missing", locale).alt, "Bếp Nhà Mình");
    assert.equal(getProductPresentation("grilled-chicken-rice", locale).image, getProductPresentation("missing", locale).image);
    assert.match(getProductPresentation("salmon-rice", locale).image, /photo-1467003909585/);
    assert.equal(authPath(locale, "login", `/${locale}/cart`), `/${locale}/auth/login?next=${encodeURIComponent(`/${locale}/cart`)}`);
    assert.equal(authPath(locale, "login", "https://evil.example"), `/${locale}/auth/login`);
  }
});

test("feature guard handles relative imports, private types and reverse catalog edge", () => {
  const cart = "apps/web/src/features/cart/components/item.tsx";
  for (const specifier of ["../../catalog/presentation", "@/features/catalog/public", "@/features/customer-auth/types"]) {
    assert.equal(publicBoundaryViolations(cart, [specifier]).length, 1);
  }
  assert.deepEqual(publicBoundaryViolations(cart, ["../../customer-auth/public", "../types"]), []);
  assert.equal(publicBoundaryViolations("apps/web/src/features/other/page.ts", ["@/features/cart/public"]).length, 1);
});

test("graph catches feature cycles even through public entrypoints", () => {
  const sources = new Map([
    ["apps/web/src/features/a/public.ts", 'export { b } from "../b/public";'],
    ["apps/web/src/features/b/public.ts", 'export { c } from "../c/public";'],
    ["apps/web/src/features/c/public.ts", 'export { a } from "../a/public";']
  ]);
  assert.ok(graphViolations(sources).some((failure) => failure.startsWith("Feature cycle:")));
  sources.set("apps/web/src/features/c/public.ts", "export const c = 1;");
  assert.deepEqual(graphViolations(sources), []);
});

test("client graph follows aliases, relative imports and reexports into server modules", () => {
  const sources = new Map([
    ["apps/web/src/features/cart/public.ts", '/* comment */ "use client"; export { value } from "@/lib/bridge";'],
    ["apps/web/src/lib/bridge.ts", 'export { value } from "./secret.js";'],
    ["apps/web/src/lib/secret.ts", 'import "server-only"; export const value = 1;']
  ]);
  assert.ok(graphViolations(sources).some((failure) => failure.includes("server-only")));
  sources.set("apps/web/src/lib/secret.ts", 'export const value = import("node:fs");');
  assert.ok(graphViolations(sources).some((failure) => failure.includes("node:fs")));
  sources.set("apps/web/src/lib/bridge.ts", 'import type { Value } from "./secret"; export type { Value };');
  assert.deepEqual(graphViolations(sources), []);
});

test("source inspection recognizes directives, reexports and dynamic imports", () => {
  const result = inspectSource("fixture.ts", `// comment
    "use client";
    export { x } from "backend";
    import("dynamic");
    require("commonjs");
    // import("ignored")
  `);
  assert.equal(result.client, true);
  assert.deepEqual(result.imports, ["backend", "dynamic", "commonjs"]);
});

test("client may reference a module-level Server Action but not an inline directive", () => {
  const sources = new Map([
    ["apps/web/src/client.tsx", '"use client"; import { action } from "./action";'],
    ["apps/web/src/action.ts", '"use server"; import "server-only"; export async function action() {}']
  ]);
  assert.deepEqual(graphViolations(sources), []);
  sources.set("apps/web/src/action.ts", 'import "server-only"; export async function action() { "use server"; }');
  assert.equal(graphViolations(sources).length, 1);
});

test("public pages and catalog respect module boundaries; legacy admin is unchanged", () => {
  const backend = ["@bep-nha-minh/api/data/site-content"];
  assert.equal(publicBoundaryViolations("apps/web/src/app/[locale]/page.tsx", backend).length, 1);
  assert.equal(publicBoundaryViolations("apps/web/src/app/admin/page.tsx", backend).length, 0);
  const catalog = "apps/web/src/features/catalog/components/card.tsx";
  assert.equal(publicBoundaryViolations(catalog, ["@/features/cart/components/add-to-cart-button"]).length, 1);
  assert.deepEqual(publicBoundaryViolations(catalog, ["@/features/cart/public"]), []);
});

# Architecture Refactor — Phase 1.5 → Phase 3

Execute the following architecture refactor directly on the repository.

The current architecture, project conventions, skills and previous Phase 1 decisions are already available in repository documentation and agent memory.

Do not redesign the project from scratch.

Do not introduce unnecessary abstractions.

Preserve current behavior.

---

# Global execution rules

For every phase:

1. Inspect existing callers before moving or deleting anything.
2. Preserve existing UI behavior and API behavior.
3. Do not change database schema unless absolutely required.
4. Do not change authentication semantics.
5. Do not change cookie, CSRF, cache or authorization behavior.
6. Do not introduce new microservices.
7. Do not introduce Clean Architecture / DDD ceremony without a concrete need.
8. Prefer small functions/modules over classes and DI containers.
9. Update architecture verification tests whenever a new boundary becomes enforceable.
10. Remove obsolete code only after all callers have migrated.

After each logical batch run the available:

```sh
npm run verify:source
npx tsx --test scripts/verify/architecture.test.ts
npm run typecheck
npm run lint
npm run build
```

Also run relevant unit/integration tests for modified areas.

Do not stop at analysis.

Make the code changes.

---

# Phase 1.5 — Remove Feature-to-Feature Internal Coupling

## Goal

Feature modules must own their own implementation.

A feature may expose a small intentional public surface, but other features must not import its internal:

```text
components/
hooks/
service/
presentation/
internal schemas
internal types
```

The immediate target is the existing catalog/cart relationship and any similar feature-level coupling discovered during implementation.

---

## 1. Inventory feature dependencies

Inspect:

```text
apps/web/src/features/**
```

Build a dependency inventory between features.

Identify imports such as:

```text
features/A -> features/B/components/*
features/A -> features/B/hooks/*
features/A -> features/B/service/*
features/A -> features/B/presentation/*
```

Classify each dependency as:

```text
COMPOSITION
SHARED PRESENTATION
SHARED CONTRACT
FEATURE API
INVALID INTERNAL DEPENDENCY
```

Do not move files before understanding why the dependency exists.

---

# 2. Fix catalog/cart boundary

The target is to remove internal coupling between:

```text
catalog
cart
```

Generic product presentation utilities must not be owned by catalog if cart also depends on them.

Examples include:

```text
price formatting
currency formatting
product image selection
product display mapping
generic product presentation models
```

Move genuinely neutral frontend utilities to an appropriate neutral Web module, for example:

```text
apps/web/src/lib/money.ts

apps/web/src/lib/product-presentation.ts
```

or an equivalent existing neutral location.

Do not create a generic `common` dumping ground.

---

# 3. Prefer composition over feature dependency

Where Catalog currently needs to render Cart behavior, prefer composition from the page/container level.

Target concept:

```text
Page / Container
├── Catalog UI
└── Cart action
```

instead of:

```text
Catalog
└── Cart internal component
```

For example, prefer an API conceptually equivalent to:

```tsx
<ProductDetail
  product={product}
  action={<AddToCartButton productId={product.id} />}
/>
```

when this can be introduced without making the component API awkward.

If the existing design is materially simpler with:

```text
catalog -> cart/public
```

then a one-way dependency through:

```text
features/cart/public.ts
```

may remain temporarily.

If retained, enforce all of these:

```text
catalog -> cart/public.ts      allowed

catalog -> cart/components    forbidden
catalog -> cart/hooks         forbidden
catalog -> cart/service       forbidden

cart -> catalog/*             forbidden
```

There must never be a catalog/cart cycle.

---

# 4. Public feature entrypoints

For feature functionality intentionally consumed outside its owner, expose it through an explicit entrypoint such as:

```text
features/<feature>/public.ts
```

Keep this public surface minimal.

Do not re-export entire feature folders.

Good:

```ts
export { AddToCartButton } from "./components/add-to-cart-button";
```

Bad:

```ts
export * from "./components";
export * from "./hooks";
export * from "./service";
export * from "./internal";
```

Public entrypoints are architecture boundaries, not convenience barrels.

---

# 5. Architecture enforcement

Extend architecture verification so that feature imports can be checked.

At minimum detect:

```text
feature -> another feature internal module
feature cycles
cart -> catalog
client component -> server-only modules
```

If `catalog -> cart/public` remains intentionally allowed, encode it as an explicit exception.

Do not rely only on documentation.

Make the rule executable.

---

# Phase 1.5 completion criteria

Phase 1.5 is complete when:

```text
[x] cart no longer imports catalog internals
[x] catalog does not import cart internals
[x] generic product presentation logic has neutral ownership
[x] no catalog/cart cycle exists
[x] intentional cross-feature APIs use explicit public entrypoints
[x] architecture tests prevent regression
[x] typecheck passes
[x] lint passes
[x] build passes
[x] relevant tests pass
```

At completion, document all remaining feature-to-feature dependencies and why they are allowed.

---

# Phase 1.5 implementation record

Status: COMPLETE (local verification: source check, 8 architecture/presentation
tests, typecheck, lint and production build passed). No production deployment or
live auth/database verification was performed. Phase 2 has not started.

## Dependency inventory and decisions

| Previous dependency | Classification | Resolution |
| --- | --- | --- |
| cart -> catalog/presentation (2 components) | SHARED PRESENTATION; invalid ownership | Move price formatting to `lib/money.ts` and image mapping to `lib/product-presentation.ts`. All callers migrated; old catalog module removed. |
| catalog -> cart/public (card and detail) | FEATURE API | Retained intentionally as a one-way edge. Catalog fetches product state client-side and supplies slug/locale/disabled. Moving this to server pages would require another client container or render callback without reducing current complexity. |
| cart -> customer-auth/routes | FEATURE API through an internal path | Use `customer-auth/public.ts`, exporting only `authPath`. Redirect allowlist and auth behavior unchanged. |
| customer-addresses -> customer-auth/routes | FEATURE API through an internal path | Use the same explicit auth entrypoint. |
| customer-addresses -> customer-auth/types (Locale, 2 files) | SHARED CONTRACT | Import Locale directly from shared i18n contracts. |
| featured-catalog section -> catalog hook/types/presentation | COMPOSITION + SHARED PRESENTATION + SHARED CONTRACT | Hook through catalog/public; Locale from shared; display helpers from neutral lib. |

Remaining feature-to-feature edges (explicit allowlist in the source checker):

```text
catalog -> cart/public                 AddToCartButton
cart -> customer-auth/public           authPath
customer-addresses -> customer-auth/public  authPath
```

No reverse cart -> catalog edge is permitted, including public or type imports.
No other cross-feature edge is allowed without updating the inventory and tests.
Pages remain composition roots and may select their feature's screen component;
this phase does not require a barrel for every page or internal module.

## Executable enforcement

`verify:source` checks cross-feature imports including relative paths and aliases,
private type imports, explicit public API exceptions, feature-level cycles, and
transitive client imports into server-only modules through local helpers/barrels.
Type-only edges are checked for ownership but excluded from the client runtime graph.
Module-level `use server` files are valid Server Action boundaries; inline function
directives do not exempt a whole module. Existing admin actions are unchanged.

The resolver covers current repository aliases, relative TS/TSX modules and index
files (including `.js` specifiers targeting TS). Computed dynamic imports and
dependency-package internals are not resolved; Next build remains a separate gate.

Relevant tests cover both locales/currencies, image fallback, auth route contract,
private and reverse imports, cycles, transitive server imports, type-only imports,
and Server Action boundaries. No live auth, database or deploy flow is changed.

# Phase 2 — Consolidate Web/BFF Infrastructure

## Goal

Reduce duplicated Web/BFF infrastructure without accidentally merging routes that have different runtime semantics.

Do not optimize for DRY at the expense of correctness.

---

# 1. Inventory BFF routes

Inspect:

```text
apps/web/src/app/api/**
```

and related Web services.

Inventory repeated logic involving:

```text
API base URL resolution
fetch configuration
JSON parsing
request forwarding
response forwarding
error normalization
headers
cookies
authorization
CSRF handling
cache behavior
timeout handling
request IDs / tracing
```

Group duplication by behavior, not by text similarity.

---

# 2. Extract only safe shared HTTP infrastructure

Extract common helpers only when semantics are identical.

Potential examples:

```text
commerce API URL builder
safe JSON parser
generic server-side API request helper
standard internal error mapping
request ID propagation
common content-type
```

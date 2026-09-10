# Phase 2: Shared Package Extraction

Status: Completed

Goal: move shared domain constants, DTO types, validation schemas, and pure utilities into `packages/shared` while keeping the root app compatible.

## Scope

- Create source modules under `packages/shared/src`.
- Extract shared constants:
  - locale constants and helpers
  - order status constants and transition helpers
- Extract shared schemas:
  - waitlist Zod schema
- Extract shared types:
  - API response types
  - admin DTO types
- Extract pure utilities:
  - phone normalization
- Add TypeScript path aliases for `@bep-nha-minh/shared`.
- Keep root compatibility shims for current imports.

## Out Of Scope

- Moving frontend code into `apps/web`.
- Moving backend API code into `apps/api`.
- Moving database code.
- Changing API behavior.
- Changing Docker services.

## Compatibility Rules

- Compatibility files such as `apps/web/src/lib/order-status.ts`, `apps/web/src/lib/i18n.ts`, and `apps/web/src/lib/validation.ts` may re-export from `packages/shared` during migration.
- New shared imports should prefer `@bep-nha-minh/shared/*`.
- `packages/shared` must remain pure TypeScript: no React components, DB access, environment reads, or app imports.

## Acceptance Criteria

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build` passes.
- Existing app routes and APIs remain unchanged.

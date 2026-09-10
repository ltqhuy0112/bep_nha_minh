# Phase 6: Cleanup and Verification

Status: Completed

## Scope

Clean up phase naming, add source boundary verification, and run final checks for the split workspace structure.

## Implemented

- Renamed runtime verification script from `scripts/verify/phase-5.ts` to `scripts/verify/runtime.ts`.
- Renamed the older admin operations specification to `docs/phases/phase_5_admin_operations.md`.
- Added `scripts/verify/source-boundaries.ts`.
- Added `npm run verify:source`.
- Updated README and workspace docs for the current Phase 6 structure.

## Boundary Rules

- `apps/api` must not import frontend code.
- `packages/shared` must not import app, React, Next.js, PostgreSQL, or server-only modules.
- Client components must not import `@bep-nha-minh/api`.

## Verified

- `npm run verify:source`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `docker compose config`
- `docker compose up -d --no-build`
- `docker compose ps -a`
- `npm run verify`
- `GET /api/health` returned `200`

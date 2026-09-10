# Phase 4: API Workspace Extraction

Status: Completed

## Scope

Move backend DB/repository/service code into `apps/api` without changing the public URLs or breaking the existing NextAuth admin session flow.

## Implemented

- Created active `@bep-nha-minh/api` workspace exports.
- Added `apps/api/tsconfig.json`.
- Moved PostgreSQL client and query repositories into `apps/api/src/db`.
- Moved admin/public backend services into `apps/api/src/services`.
- Moved API validation, password, permissions, response, logger, env, and OpenAPI helpers into `apps/api/src/lib`.
- Updated web pages and route handlers to import backend code through `@bep-nha-minh/api`.
- Updated seed, verify, and create-admin scripts to use the backend workspace.
- Kept NextAuth and `requireSession()`/`requirePermission()` web adapters in `apps/web` because they depend on Next.js session/cookie behavior.
- Narrowed lint script to source directories so generated `.next` output is not linted.

## Deferred

- Standalone HTTP server/runtime for `apps/api`.
- Separate web and API containers.
- Moving route handlers out of `apps/web/src/app/api`.
- Full route/module folder reshaping under `apps/api/src/modules`.

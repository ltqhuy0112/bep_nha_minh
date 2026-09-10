# Phase 5: Docker Lifecycle Split

Status: Completed

## Scope

Split Docker build targets and Compose lifecycle so deployment has clear web, backend/tools, migrate, and seed responsibilities.

## Implemented

- Renamed Docker runtime target to `web`.
- Added Docker `api` target for backend/tools workflows.
- Migrate and seed services now use the `api` image target and no longer require frontend source.
- Added Compose anchors for shared app environment and API job configuration.
- Added `bep-nha-minh-api:${APP_IMAGE_TAG:-local}` and `bep-nha-minh-web:${APP_IMAGE_TAG:-local}` image tags.
- Added tools-profile `api` service for backend checks.
- Added npm snippets:
  - `docker:build:api`
  - `docker:build:web`
  - `docker:api:check`
- Moved seed/site-content data into backend/shared locations:
  - `apps/api/src/data/admin-seed-data.ts`
  - `apps/api/src/data/site-content.ts`
  - `packages/shared/src/types/site.ts`

## Verified

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `docker compose config`
- `docker:build:api`
- `docker:build:web`

## Deferred

- Standalone HTTP API server.
- Separate public API port.
- Production reverse proxy routing between independent web and API containers.

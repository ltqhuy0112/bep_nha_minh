# Source Split Architecture

This document defines the target source layout for splitting the current full-stack Next.js app into a professional monorepo.

Phase 1 created the destination structure and rules. Phase 2 moved shared pure TypeScript code into `packages/shared`. Phase 3 moved the active Next.js web app into `apps/web`. Phase 4 moved backend DB, validation, API helpers, and services into `apps/api`, while Next.js route handlers remain as adapters. Phase 5 split Docker build targets and lifecycle jobs for web, API/tools, migrate, and seed. Phase 6 added cleanup docs and source boundary verification.

## Target Layout

```text
bep-nha-minh/
  apps/
    web/                  Next.js/React frontend
    api/                  Backend API service
  packages/
    shared/               Shared types, schemas, constants, pure utils
    config/               Shared tooling config when needed
  docs/
  migrations/
  scripts/
```

## apps/web

Frontend workspace for public pages and admin screens.

Target layout:

```text
apps/web/src/
  app/                    Routing only
  features/
    home/
      components/
      hooks/
      services/
      types.ts
    waitlist/
      components/
      hooks/
      services/
      schemas.ts
      types.ts
    admin-orders/
    admin-customers/
    admin-analytics/
  components/
    ui/                   Pure shared UI
    layout/               Shell, header, footer, sidebar
    feedback/             Toast, empty/error/loading states
  hooks/                  Global client hooks
  services/               API client and fetch helpers
  store/                  Global client state only when needed
  types/                  Frontend-only types
  utils/                  Frontend-only helpers
  styles/
```

Rules:

- `app/` pages only route and compose feature components.
- `components/ui` must not import from `features`.
- Feature components may import shared UI, feature hooks, feature services, and `packages/shared`.
- Client services must not import React components.
- Frontend code must not import backend DB/repository modules.

## apps/api

Backend workspace for public and admin APIs.

Current transitional layout:

```text
apps/api/src/
  db/                    PostgreSQL client and query repositories
  lib/
    admin/               API/admin validation, password, permissions
    api-response.ts
    env.ts
    logger.ts
    openapi.ts
    site.ts
  services/              Admin and public business services
```

Target standalone layout:

```text
apps/api/src/
  main.ts
  app.ts
  config/
  db/
  modules/
    auth/
      auth.routes.ts
      auth.service.ts
      auth.repository.ts
      auth.schemas.ts
      auth.types.ts
    waitlist/
    orders/
    customers/
    analytics/
    audit-logs/
  middleware/
  utils/
  types/
```

Rules:

- HTTP flow is `route -> service -> repository -> db`.
- Routes parse request, validate input, and return responses.
- Services own business rules and transactions.
- Repositories own SQL and persistence mapping.
- Repositories must not import services or route handlers.
- Backend modules may import `packages/shared`, but shared must not import backend modules.

## packages/shared

Shared package for pure TypeScript code used by both apps.

Allowed:

- API DTO types.
- Zod schemas shared across frontend and backend.
- Domain constants such as order statuses and locales.
- Pure utilities such as phone normalization and formatting.

Forbidden:

- React components.
- Database access.
- Server environment reads.
- Imports from `apps/web` or `apps/api`.

Current extracted modules:

```text
packages/shared/src/constants/i18n.ts
packages/shared/src/constants/order-status.ts
packages/shared/src/schemas/waitlist.ts
packages/shared/src/types/admin.ts
packages/shared/src/types/api-response.ts
packages/shared/src/utils/phone.ts
```

## Import Direction

```text
apps/web  -> packages/shared
apps/api  -> packages/shared
packages/shared -> no app imports

apps/web features -> apps/web components/ui
apps/web components/ui -> no feature imports

apps/api routes -> apps/api services -> apps/api repositories -> apps/api db
```

## Phase Plan

```text
Phase 1: destination skeleton and architecture rules
Phase 2: extract shared constants, DTOs, schemas, and pure utils
Phase 3: move frontend into apps/web
Phase 4: extract backend API into apps/api
Phase 5: split Docker/deploy lifecycle into web, api/tools, migrate, seed
Phase 6: cleanup, tests, docs, and verification
```

## Current Compatibility

As of Phase 3, the active Next.js runtime lives in:

```text
apps/web/src/
apps/web/public/
apps/web/next.config.ts
apps/web/tsconfig.json
```

Root `package.json` scripts remain the public command entrypoint and delegate web build/dev/start to `@bep-nha-minh/web`.

Backend DB/repository/service modules now live under `apps/api/src/` and are imported through `@bep-nha-minh/api`.

Next.js route handlers still live under `apps/web/src/app/api/` for URL compatibility and call into `apps/api`. They should become standalone HTTP routes when the runtime/deploy lifecycle is split.

Docker uses two build targets:

```text
api   backend/tools image used by migrate, seed, and backend checks
web   production Next.js standalone runtime image
```

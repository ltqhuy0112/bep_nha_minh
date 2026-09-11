# Bếp Nhà Mình

Lightweight brand bio website for **Bếp Nhà Mình**, backed by PostgreSQL for waitlist leads, site content, demo admin users, customers, orders, order history, audit logs, and admin analytics.

The public website defaults to **pre-launch**: brand introduction, planned menu and opening notifications. Existing guest/account cart code is retained behind `NEXT_PUBLIC_ORDERING_ENABLED=true`. Checkout and payment collection remain disabled.

## Pre-launch Configuration

`NEXT_PUBLIC_ORDERING_ENABLED=false` is the safe default, including when absent. The header/catalog hide ordering actions and `/vi/cart` / `/en/cart` render the pre-launch screen without initializing or fetching a cart. The web BFF and standalone API also reject cart requests while disabled.

This is a Next.js **build-time** public flag: after changing it, restart local web/API; production requires rebuilding the web image and setting the same flag on the API. Docker Compose passes the flag and `NEXT_PUBLIC_SITE_URL` as build arguments. Do not put secrets in `NEXT_PUBLIC_*` variables.

Run `npm run verify:prelaunch` for the focused pre-launch guard checks. Free-hosting setup, GitHub Actions and manual deployment gates are described in [the deployment runbook](docs/operations/prelaunch-deployment.md). No production deploy is performed automatically by this change.

See the [commerce roadmap and approved decisions](docs/phases/ecommerce/README.md) before continuing a commerce phase.

For Phase 3.5, `npm run verify:cart` runs only isolated cart API and BFF checks, not email/OAuth/admin regressions. See the [cart implementation and remaining gates](docs/phases/ecommerce/phase_3_5_cart.md).

To seed the four healthy demo meals and enable adding them to carts locally, run `npm run db:seed:catalog -- --for-cart` and explicitly enable `NEXT_PUBLIC_ORDERING_ENABLED=true` in development. This preserves existing prices/translations, skips archived or fulfillment-blocked products, and does not create inventory/orders or enable checkout. Without the seed flag, newly seeded products remain disabled. Do not run demo seeds against production.

Customer authentication starts at `/vi/auth/login` or `/en/auth/login`; profiles live at `/{locale}/account`. Auth is disabled by default in the example configuration. Development acceptance is complete for local login, Google OAuth and Resend; Facebook is deferred/disabled and production remains gated. See [Phase 3.2](docs/phases/ecommerce/phase_3_2_customer_auth.md) for configuration and [Phase 3.3](docs/phases/ecommerce/phase_3_3_auth_navigation.md) for UI routes. Admin authentication is unchanged.

Registration and password-reset emails are queued, not sent by the web/API process. In an explicitly configured development environment, run `npm run email:dispatch:auth -- --watch` in a separate terminal. This command sends real email. Duplicate registration does not replace an existing password; Google-only accounts cannot reset a local password they do not have.

Signed-in customers can manage delivery addresses at `/vi/account/addresses` or `/en/account/addresses`. New addresses use the two-level province/ward model, without district. Run `npm run db:up` then `npm run locations:sync` before using the updated form. Location data is bundled and imported into PostgreSQL offline; see the [location data runbook](docs/operations/location-data.md) and [Phase 3.4](docs/phases/ecommerce/phase_3_4_customer_addresses.md). Restart the standalone API if it is not running in watch mode. Checkout is not yet enabled.

Current public features include Vietnamese/English pages, waitlist signup, SEO metadata, structured data, sitemap/robots, OpenAPI documentation, botanical brand styling, fixed hotline contact, and scroll-to-top controls.

## Commerce Catalog (Phase 3.1)

For local development, with PostgreSQL running and `.env` configured:

```powershell
npm run db:up
npm run db:seed:catalog
npm run api:dev
```

In a second terminal:

```powershell
npm run dev
```

If Docker already occupies port 3000, start local web on another port:

```powershell
npm --workspace @bep-nha-minh/web run dev -- --port 3002
```

Open `/vi/menu` or `/en/menu` on the web port printed by Next.js. The web server proxies catalog requests to the server-only `COMMERCE_API_URL` (default `http://127.0.0.1:3001`). API health and OpenAPI are at `/api/v1/health/ready` and `/api/v1/openapi.json` on port 3001. Do not expose this setting through `NEXT_PUBLIC_`.

`db:seed:catalog` is local-development-only and inserts four bilingual demo products without overwriting existing records. Demo prices are not approved production prices; products do not accept orders. It creates no fulfillment slots, stock, orders or accounts.

The four delivery slots are approved in [the business decisions](docs/phases/ecommerce/phase_1_review_decisions.md): LUNCH_1 10:30-12:00, LUNCH_2 12:00-13:30, DINNER_1 17:00-18:30, DINNER_2 18:30-20:00, all in Asia/Ho_Chi_Minh with a 120-minute cutoff. Apply this explicit configuration after migrations:

```powershell
npm run db:configure:slots
```

The command requires `DATABASE_URL`, is transactional and repeatable, preserves disabled/existing slots, and rejects conflicting hours for an existing key. It does not create inventory or enable product sales/checkout. It is not automatically run by Docker startup. For Docker, build the updated API image with `npm run docker:build:api`, then run `docker compose run --rm api npm run db:configure:slots` after migrations and checking the target database.

Docker mode starts an internal `commerce-api` service automatically; web reaches it at `http://commerce-api:3001`. The API port is not published to the host. Catalog demo seeding is not part of Docker production startup. Existing `db:seed` remains separate from the catalog seed.

```powershell
npm run verify:catalog
npm run verify:catalog:proxy
```

The verifier creates/drops its own random PostgreSQL database; the database user needs CREATE DATABASE permission. It never resets the application database. See [Phase 3.1](docs/phases/ecommerce/phase_3_1_catalog.md) for scope and verification results.

## Prerequisites

- Node.js 22+
- npm
- Docker Desktop, for Docker mode or Docker PostgreSQL
- PostgreSQL 16, only if running full local mode without Docker

## First Setup

```powershell
Copy-Item .env.example .env
npm install
```

Default development database values in `.env.example`:

```text
DATABASE_URL=postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh
POSTGRES_USER=bep_user
POSTGRES_PASSWORD=bep_password
POSTGRES_DB=bep_nha_minh
```

Recommended public metadata values for shared environments:

```text
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
NEXT_PUBLIC_CONTACT_EMAIL=hello@your-domain.example
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/your-profile
NEXT_PUBLIC_FACEBOOK_URL=https://facebook.com/your-page
NEXT_PUBLIC_TIKTOK_URL=https://tiktok.com/@your-profile
```

Keep secrets such as `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`, and database credentials server-only. Do not add `NEXT_PUBLIC_` to secret values.

## Mode 1: Full Docker

Use this mode when you want Docker to run PostgreSQL, migrations, seed data, and the production Next.js web/API server.

```powershell
npm run docker:up
```

Open:

```text
http://localhost:3000
http://localhost:3000/vi
http://localhost:3000/en
http://localhost:3000/admin/login
http://localhost:3000/api/docs
```

Check status:

```powershell
docker compose ps
curl.exe http://localhost:3000/api/health
```

Expected services:

```text
postgres  healthy
commerce-api healthy
migrate   exited 0
seed      exited 0
web       healthy
```

Useful Docker commands:

```powershell
npm run docker:build:api
npm run docker:build:web
npm run docker:api:check
npm run docker:logs
npm run docker:down
npm run docker:reset
```

`docker:reset` removes the PostgreSQL volume, rebuilds, reruns migrations, and reseeds demo data.

Docker lifecycle:

```text
postgres   PostgreSQL 16 with health check
migrate    one-off API/tools image job that runs migrations
seed       one-off API/tools image job that seeds demo data
web        production Next.js standalone image
api        tools-profile backend image for backend checks and future API runtime
commerce-api internal catalog HTTP runtime, using the API image
```

## Mode 2: Full Local

Use this mode when PostgreSQL is installed and running locally on `localhost:5432`.

Create the local database and user to match `.env`:

```text
database: bep_nha_minh
user: bep_user
password: bep_password
```

Then run migrations, seed data, and start the local Next.js dev server:

```powershell
npm run db:up
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:3000
```

Production local mode:

```powershell
npm run build
npm run start
```

The web workspace uses `output: "standalone"`, so production start runs `apps/web/.next/standalone/apps/web/server.js`. Do not use `next start` unless standalone output is removed.

## Local Web With Docker PostgreSQL

If PostgreSQL is not installed locally, run only PostgreSQL in Docker and run web/API locally from source. This is the best mode for UI work.

```powershell
npm run docker:down
docker compose up -d postgres
npm run db:up
npm run db:seed
npm run dev
```

In this mode:

```text
web/API    local Next.js on http://localhost:3000
database   Docker PostgreSQL on localhost:5432
```

## Seeded Login

Demo admin account:

```text
Email: admin@bepnhaminh.local
Password: Admin12345!@#
```

To override the demo password before seeding:

```powershell
$env:SEED_ADMIN_PASSWORD="Use-A-Local-Strong-Password123!"
npm run db:seed
```

Seed data includes site content, waitlist-ready schema, 2 demo admin users, 12 customers, 24 orders across all operational statuses, order items, status history, and audit logs.

## Create Admin

Interactive password prompt:

```powershell
npm run admin:create -- --email=admin@example.com --name="Admin Name" --role=SUPER_ADMIN
```

Non-interactive local setup:

```powershell
$env:ADMIN_PASSWORD="Admin12345!@#"
npm run admin:create -- --email=admin@example.com --name="Admin Name" --role=SUPER_ADMIN
```

Update an existing admin:

```powershell
npm run admin:create -- --email=admin@example.com --name="Admin Name" --role=ADMIN --update-existing
```

## Database Commands

```powershell
npm run db:create -- migration_name
npm run db:up
npm run db:down
npm run db:redo
npm run db:seed
```

`db:down` rolls back one applied migration. To roll back multiple migrations, pass a count after `--`:

```powershell
npm run db:down -- 3
```

Migration files use `node-pg-migrate` UTC filenames with milliseconds, for example:

```text
20260723000600000_create_admin_users.js
```

Keep the 17-digit prefix so `npm run db:up` can determine migration order without timestamp warnings.

## Verification

Source checks:

```powershell
npm run verify:source
npm run lint
npm run typecheck
npm run build
```

Runtime verification against whichever mode is currently running on `http://localhost:3000`:

```powershell
npm run verify
```

Health check:

```powershell
curl.exe http://localhost:3000/api/health
```

Expected admin protection:

```text
/admin redirects unauthenticated users to /admin/login
/api/admin/orders returns 401 without a session
```

## Useful URLs

```text
http://localhost:3000
http://localhost:3000/vi
http://localhost:3000/en
http://localhost:3000/admin/login
http://localhost:3000/admin
http://localhost:3000/admin/orders
http://localhost:3000/admin/customers
http://localhost:3000/admin/waitlist
http://localhost:3000/admin/audit-logs
http://localhost:3000/api/docs
http://localhost:3000/api/openapi.json
```

Admin APIs:

```text
GET   /api/admin/orders
GET   /api/admin/orders/[orderId]
POST  /api/admin/orders/[orderId]/approve
POST  /api/admin/orders/[orderId]/reject
POST  /api/admin/orders/[orderId]/cancel
PATCH /api/admin/orders/[orderId]/status
GET   /api/admin/customers
GET   /api/admin/analytics/orders?range=7d
GET   /api/admin/session
```

Public APIs and docs:

```text
GET  /api/health
GET  /api/site-content
POST /api/waitlist
GET  /api/docs
GET  /api/openapi.json
```

SEO routes:

```text
GET /sitemap.xml
GET /robots.txt
GET /site.webmanifest
```

`/admin`, `/api/admin`, `/api/auth`, `/api/docs`, and `/api/openapi.json` are configured to avoid search indexing.

## Project Structure

```text
apps/
  web/                active Next.js frontend and route adapter workspace
  api/                backend DB, validation, services, API helpers
docs/
  assets/             mockups and project images
  architecture/       source split and import boundary docs
  phases/             approved phase specs
  project/            original project prompt/context
migrations/           PostgreSQL migrations
packages/
  shared/             shared types, schemas, constants, pure utils
  config/             future shared tooling config
scripts/
  admin/              admin CLI commands
  db/                 migration and seed runners
  dev/                local repair utilities
  verify/             executable verification scripts
apps/web/src/
  app/                Next.js App Router pages and route handlers
  components/         UI components
  data/               seed data and public site content source
  lib/                NextAuth session guards, UI formatting, SEO metadata
apps/api/src/
  db/                 PostgreSQL client and query repositories
  lib/                server env, API responses, OpenAPI, API validation
  services/           admin order/customer/waitlist/analytics services
```

The source split is currently in Phase 6. Runtime web code lives in `apps/web/src/` and public assets live in `apps/web/public/`. Backend DB/repository/service code lives in `apps/api/src/` and is imported through `@bep-nha-minh/api`. Docker has separate web and API/tools build targets. Next.js route handlers remain in `apps/web/src/app/api` as thin adapters until a standalone HTTP API runtime is approved.

Notable public UI components:

```text
apps/web/src/components/layout/floating-actions.tsx   fixed hotline and scroll-to-top
apps/web/src/app/api/docs/route.ts                    Swagger UI
apps/web/src/app/api/openapi.json/route.ts            OpenAPI JSON
apps/api/src/lib/openapi.ts                           OpenAPI schema source
apps/web/src/lib/site.ts                              shared brand, SEO, hotline, social metadata
```

Source split architecture:

```text
docs/architecture/source-split.md
docs/phases/phase_1_source_split.md
docs/phases/phase_2_shared.md
docs/phases/phase_3_web.md
docs/phases/phase_4_api.md
docs/phases/phase_5_admin_operations.md
docs/phases/phase_5_docker_lifecycle.md
docs/phases/phase_6_cleanup_verification.md
```

## Troubleshooting

If port `3000` is busy:

```powershell
netstat -ano | findstr :3000
```

If Docker schema or seed data looks stale:

```powershell
npm run docker:reset
```

If local dependencies are broken:

```powershell
npm run repair:node-modules
```

If `npm run start` says `.next/standalone/apps/web/server.js` is missing:

```powershell
npm run build
npm run start
```

## Security Notes

- Server-side validation uses Zod.
- SQL uses parameterized queries.
- Raw database errors and stack traces are not returned to clients.
- Database credentials must never use `NEXT_PUBLIC_` prefixes.
- Demo admin credentials are development-only and should be replaced before shared use.
- Add rate limiting before public production launch.
- Do not expose PostgreSQL publicly in production.
- Keep `/admin` and internal API docs behind private operational access for real production.

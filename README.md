# Bếp Nhà Mình

Lightweight brand bio website for **Bếp Nhà Mình**, backed by PostgreSQL for waitlist leads, site content, demo admin users, customers, orders, order history, audit logs, and admin analytics.

This is not a public e-commerce system. It has no public cart, checkout, payment, inventory, customer accounts, accounting, payroll, delivery-driver app, or payment reconciliation.

Current public features include Vietnamese/English pages, waitlist signup, SEO metadata, structured data, sitemap/robots, OpenAPI documentation, botanical brand styling, fixed hotline contact, and scroll-to-top controls.

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
migrate   exited 0
seed      exited 0
web       healthy
```

Useful Docker commands:

```powershell
npm run docker:logs
npm run docker:down
npm run docker:reset
```

`docker:reset` removes the PostgreSQL volume, rebuilds, reruns migrations, and reseeds demo data.

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

`next.config.ts` uses `output: "standalone"`, so production start is `node .next/standalone/server.js`. Do not use `next start` unless standalone output is removed.

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

Migration files use `node-pg-migrate` UTC filenames with milliseconds, for example:

```text
20260723000600000_create_admin_users.js
```

Keep the 17-digit prefix so `npm run db:up` can determine migration order without timestamp warnings.

## Verification

Source checks:

```powershell
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
docs/
  assets/             mockups and project images
  phases/             approved phase specs
  project/            original project prompt/context
migrations/           PostgreSQL migrations
scripts/
  admin/              admin CLI commands
  db/                 migration and seed runners
  dev/                local repair utilities
  verify/             executable verification scripts
src/
  app/                Next.js App Router pages and route handlers
  components/         UI components
  data/               seed data and public site content source
  db/                 database client and queries
  lib/                validation, auth/session, formatting, env helpers
  services/           admin order/customer/analytics services
```

Notable public UI components:

```text
src/components/layout/floating-actions.tsx   fixed hotline and scroll-to-top
src/app/api/docs/route.ts                    Swagger UI
src/app/api/openapi.json/route.ts            OpenAPI JSON
src/lib/openapi.ts                           OpenAPI schema source
src/lib/site.ts                              shared brand, SEO, hotline, social metadata
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

If `npm run start` says `.next/standalone/server.js` is missing:

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

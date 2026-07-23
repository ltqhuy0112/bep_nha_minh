# Project Context

## Product

`Bếp Nhà Mình` is a Vietnamese healthy food brand bio website with a PostgreSQL-backed waitlist form.

The intended product remains lightweight:

- Single-page brand bio site
- Dish previews
- Pre-order workflow explanation
- Social links
- Waitlist lead capture
- PostgreSQL storage for waitlist and seeded site content

Avoid adding e-commerce capabilities unless the user explicitly changes scope.

## Current Stack

- Next.js App Router
- TypeScript strict mode
- React Server Components by default
- Tailwind CSS
- `motion/react`
- Zod
- PostgreSQL
- `pg`
- `node-pg-migrate`
- Docker Compose
- npm

## Important Paths

- `src/app/page.tsx`: homepage composition
- `src/app/api/*/route.ts`: Route Handlers
- `src/components/`: UI and section components
- `src/data/site-content.ts`: typed mock/seed content source
- `src/db/`: PostgreSQL pool and queries
- `src/lib/validation.ts`: shared waitlist validation
- `migrations/`: database migrations
- `scripts/db/seed.ts`: idempotent seed runner
- `src/data/admin-seed-data.ts`: demo admin operations seed data
- `scripts/dev/repair-node-modules.ps1`: dependency repair workflow
- `docker-compose.yml`: local full-stack runtime
- `Dockerfile`: production and tooling images

## Phase Discipline

When a user says "phase" or asks to continue:

- Confirm the approved phase/scope.
- Do not implement future-scope features early.
- Report verification outcomes and any skipped checks.

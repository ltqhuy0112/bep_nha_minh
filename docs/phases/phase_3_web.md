# Phase 3: Web Workspace Migration

Status: Completed

## Scope

Move the active Next.js application into `apps/web` while preserving the current root command experience.

## Implemented

- `src/`, `public/`, `next.config.ts`, `postcss.config.mjs`, and `next-env.d.ts` moved into `apps/web`.
- Root `package.json` `dev`, `build`, and `start` scripts delegate to `@bep-nha-minh/web`.
- Root TypeScript config covers `apps/web`, `packages/shared`, and `scripts`.
- `apps/web/tsconfig.json` owns Next.js compiler settings and local `@/*` imports.
- Script imports for seed, admin creation, and verification now point to `apps/web/src`.
- Dockerfile is updated for the workspace layout.

## Deferred

- Extract standalone backend API service into `apps/api`.
- Split Docker runtime into separate web, api, migrate, and seed images.
- Move backend DB/repository/service modules out of the Next.js workspace.

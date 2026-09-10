# Phase 1: Source Split Skeleton

Status: Completed

Goal: create the professional monorepo destination shape without moving runtime code.

## Scope

- Add npm workspaces for future `apps/*` and `packages/*`.
- Create placeholder workspaces:
  - `apps/web`
  - `apps/api`
  - `packages/shared`
  - `packages/config`
- Document import boundaries and target folder responsibilities.
- Keep the current root-level Next.js app working unchanged.

## Out Of Scope

- Moving `src/` into `apps/web`.
- Moving Route Handlers or DB services into `apps/api`.
- Changing Docker services.
- Changing runtime ports.
- Changing production deployment behavior.

## Acceptance Criteria

- Existing commands still work:
  - `npm run typecheck`
  - `npm run lint`
- Git status only includes Phase 1 skeleton/documentation changes.
- A future agent can read `docs/architecture/source-split.md` and continue Phase 2 safely.

---
name: bep-nha-minh-phase-runner
description: Project-local workflow skill for continuing Bep Nha Minh phases, backend/frontend/Docker work, code review, debugging, or deployment tasks in this repository. Use when Codex works on this project and should optimize with CodeGraph, RTK shell commands, Context7 current docs, Docker verification, and tool_search/plugin management for missing MCP capabilities.
---

# Bep Nha Minh Phase Runner

Use this skill for project work in this repository.

## Core Rules

- Keep the product scope as a lightweight brand bio website with a waitlist form.
- Use `Bếp Nhà Mình` consistently in user-facing Vietnamese copy.
- Avoid e-commerce scope unless explicitly approved: no cart, checkout, payment, auth, inventory, order management, or admin dashboard.
- Before code understanding in this indexed repo, use CodeGraph first:
  - MCP: search/load `codegraph_explore` with `tool_search` if deferred.
  - Shell fallback: `rtk codegraph explore "<question or symbol>"`.
- Use RTK for shell commands:
  - Native commands: `rtk npm run build`, `rtk docker compose ps`.
  - PowerShell cmdlets: `rtk proxy powershell -NoProfile -Command "..."`.
- Use Context7 for current library/API docs before changing Next.js, React, Tailwind, Docker Compose, `pg`, `node-pg-migrate`, Zod, or Motion APIs.
- Use `tool_search` before assuming a missing MCP/app/plugin is unavailable.
- Use Plugin Management only for installing/uninstalling plugins; ask before installing broad or risky capabilities.

## Project Workflow

1. Read the user's newest requested phase/scope.
2. Run `scripts/check-project-state.ps1` if present, or inspect equivalent state manually.
3. Use CodeGraph for code navigation when `.codegraph/` exists.
4. Read only the files needed for the task.
5. Make scoped edits with `apply_patch`.
6. Verify with the smallest meaningful command set, usually:
   - `rtk npm run lint`
   - `rtk npm run typecheck`
   - `rtk npm run build`
7. For full-stack behavior, run Docker verification:
   - `rtk docker compose up -d --build`
   - `rtk docker compose ps -a`
   - health/API checks from `references/verification.md`
8. Stop containers when the user asks to clean up:
   - `rtk docker compose down`

## Reference Routing

- For architecture, scope, and phase boundaries, read `references/project-context.md`.
- For command recipes and verification checks, read `references/verification.md`.
- For MCP/plugin selection, read `references/mcp-tooling.md`.

## Failure Handling

- If `eslint`, `next`, or `tsc` is missing, run:
  - `rtk proxy powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/repair-node-modules.ps1 -Verify`
- If Docker port `3000` or `5432` is busy, identify the owning process before stopping anything.
- If a command fails due sandbox/network/download restrictions and is necessary, rerun with approval/escalation.

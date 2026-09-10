# apps/web

Active Next.js workspace for the Bếp Nhà Mình public website, admin screens, and current Next.js route handlers.

Root npm scripts delegate here, so most development commands should be run from the repository root.

Target responsibilities:

- Route-only `app/` pages.
- Feature-first public and admin UI.
- Shared UI components under `components/`.
- Client API services that currently talk to internal Next.js route handlers.
- Frontend-only hooks, store, types, schemas, and utils.
- Public assets under `public/`.

Current compatibility:

- Next.js route handlers still live under `src/app/api` to preserve current URLs.
- Route handlers and server pages import backend logic through `@bep-nha-minh/api`.
- DB/repository/service modules live in `apps/api`.

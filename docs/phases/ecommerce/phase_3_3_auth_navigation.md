# Phase 3.3 - Customer Auth Navigation

Scope: dedicated authentication UI and route integration before cart/checkout.
No checkout, order, inventory, admin or provider protocol changes are included.

Status: implemented and verified for this routing/UI scope, not a checkout release.

## Routes

- `/{locale}/auth` redirects to login.
- `/{locale}/auth/login`, `register`, `forgot-password`, `reset-password`,
  and `verify-email` have separate URLs, VI/EN labels and noindex metadata.
- `/{locale}/account` displays the authenticated profile; unauthenticated users
  are sent to login. API/session checks remain authoritative for access control.
- Unknown locales/modes return 404.

The auth screen uses the existing brand image, a compact menu/language header
and a white form surface on a soft sage background. Navigation between forms uses the Next.js router.
Token screens omit language switching to avoid losing or copying an active
verification/reset token into navigation links.

## Compatibility and Return Destinations

Email generation now uses `/{locale}/auth/{verify-email|reset-password}#token=...`.
Legacy `/account?mode=...#token=...` links still forward to the dedicated route.
Tokens stay in URL fragments until captured into memory, then are removed from
the address bar; opening a link never consumes it without the explicit form POST.

Provider callback URLs, OAuth transactions, BFF redirect allowlists and the API's
fixed `/account` callback destination are unchanged. The account client forwards
OAuth errors to login and successful callbacks to an optional local return hint.

`next` accepts only literal same-locale `/account`, `/menu`, or `/checkout` paths.
No arbitrary URL, query, hash, cross-locale path or encoded alternate is accepted.
`/checkout` is a reserved return contract for the future checkout feature, not a
checkout implementation or current entry point. The default is `/account`.
OAuth uses a tab-scoped sessionStorage hint with a 10-minute expiry, consumed once
and revalidated. It carries no credentials and never grants authorization. If
storage is unavailable or invalid, navigation falls back to `/account`.

## Focused Verification

Initial config/session reads share only an in-flight request across effect remounts,
with a 15-second timeout and an explicit retry control on failure. Settled sessions
are not cached. Only session HTTP 401 means unauthenticated; upstream failures
remain errors rather than triggering a misleading login redirect.

- `rtk npx tsx scripts/verify/customer-auth-routes.ts`: route/destination safety,
  locale boundaries, one-use return hints and invalid/expired/blocked storage.
- `rtk npm run verify:customer-email`: generated email link compatibility using
  the existing isolated/fake-provider verifier. No real email is sent.
- Scoped ESLint, TypeScript and browser checks of the changed auth UI.
- `rtk npx tsx scripts/verify/customer-auth-loading.ts`: in-flight deduplication,
  fresh session reads, config retry, session failures and bounded timeout.

Recorded results: route-helper and fake-provider email verifiers passed; scoped
ESLint and project typecheck passed. HTTP checks returned 307 for `/vi/auth`,
200 for valid VI/EN auth pages, and 404 for unknown modes/locales. Browser checks
confirmed register/forgot-password navigation, unauthenticated account redirect,
and legacy email-link migration with a synthetic token (fragment removed, explicit
submit still required; no token consumption performed). Desktop and 390px mobile
screenshots showed the logo and form, with no horizontal overflow in English.
The `lucide-react` dependency supplies the navigation icon.

Do not rerun live provider login or unrelated admin/catalog/order workflows for
this routing-only change. The live email verifier was updated for the new URL
format but must not be run without an explicit real-send request.

Phase 3.2 remains COMPLETE / PRODUCTION GATED; Facebook remains disabled/deferred.
Guest checkout must remain optional-auth when implemented in its own phase.

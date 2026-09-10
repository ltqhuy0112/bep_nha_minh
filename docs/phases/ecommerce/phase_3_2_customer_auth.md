# Phase 3.2 - Customer Authentication

Status: **PHASE 3.2 COMPLETE / PRODUCTION GATED**.
Development acceptance for local authentication, Google OAuth and Resend email
flows is complete by user sign-off. Facebook OAuth is explicitly deferred and
remains disabled. This is not production deployment approval.
[Approved decisions](phase_1_review_decisions.md) remain authoritative.

## Integration

Customer authentication belongs to the independent API under
`apps/api/src/features/customer-auth`. The Next.js BFF only forwards allowlisted
auth requests and the customer cookie. Existing admin NextAuth, admin sessions,
public catalog, waitlist and legacy orders are unchanged.

The account UI is available at `/vi/account` and `/en/account`, with noindex
metadata. It reads availability before showing enabled actions. There is no cart,
checkout, guest claim or new order-writing behavior in this phase.

## Implemented Core

- Registration creates a new customer profile and account atomically. Duplicate
  normalized email returns the same accepted response and rolls back the new
  profile. It never merges guest/legacy profiles by email or phone.
- Passwords use the existing bcrypt library at cost 12, minimum 12 characters,
  maximum 72 UTF-8 bytes. Missing-account login still performs bcrypt comparison.
- Session secrets use 32 random bytes; only SHA-256 hashes enter the database.
  HttpOnly, SameSite=Lax, Path=/ cookies have a 30-day lifetime. HTTPS uses Secure
  and the `__Host-` prefix. Admin cookies never authorize customer operations.
- Verification tokens last 24 hours; reset tokens last 30 minutes. Both are
  purpose-bound, single-use, target-email-bound and stored as hashes.
- Account-row locks serialize login, reset, resend and logout-all. Token expiry
  and consumed/revoked state are rechecked under lock; reset consumes the token,
  replaces the password and revokes sessions in one transaction.
- Logout clears the current cookie. Logout-all revokes all customer sessions.
  Account disable and expiry are checked on every session read.
- Successful registration/login/verification/reset/logout-all write audit entries
  without password, token, raw email or cookie data.
- JSON body size is bounded to 16 KiB. Mutations require the configured Origin.
  Responses are no-store; 401, 403, 429 and generic failures are explicit.

The fixed session lifetime without renewal and revoke-all-on-reset behavior is a
**local implementation candidate**, not a newly approved production business rule.

## Email

An encrypted `CUSTOMER_AUTH_EMAIL` event is inserted into `outbox_events` inside
the account/token transaction. AES-256-GCM protects the email address and raw token
needed by the sender; the encryption key is backend-only. The provider is called
only after commit, never within the account transaction.

`dispatchAuthEmails()` claims bounded batches with row locks and lease tokens.
It checks token validity, fences completion/retry and supports expired lease
reclaim. A provider failure does not roll back the account. Dispatch policy must
be supplied explicitly; no scheduler, RabbitMQ or Redis integration is enabled.
The optional Resend adapter is an available implementation, not a selected
production provider. Provider implementations must honor event idempotency keys;
delivery is at-least-once, not an exactly-once network operation.

`npm run email:dispatch:auth` runs one bounded batch. Add `-- --watch` for the
opt-in polling dispatcher with graceful SIGINT/SIGTERM handling. It refuses
production and requires explicit local dispatch enablement,
provider credentials and every `CUSTOMER_AUTH_EMAIL_*` batch/retry/lease setting
shown in `.env.example`. It can send real email when configured with Resend;
the regular verification scripts use a fake provider and never send external email.
The exception is `scripts/verify/customer-email-live.ts`: it requires `--send`,
development mode and `TEST_EMAIL_RECIPIENT` set locally to an explicitly approved
mailbox. It sends two real messages against an isolated temporary database;
its token links are automatically consumed and are not manual account recovery.

Email links use `#token=...`, not query parameters. The UI removes the fragment,
keeps the token only in memory and requires a submit action to consume it. Opening
an email link or a mail-scanner GET cannot reset a password or verify an account.
Refreshing after fragment removal requires reopening the original email link.

### Operational Dispatcher

```powershell
npm run email:dispatch:auth
npm run email:dispatch:auth -- --watch
```

Both commands can send real mail with configured Resend credentials; neither is
a dry run. Unknown CLI flags must fail before dispatch. Watch mode polls without
overlapping batches and stops claiming work on SIGINT/SIGTERM. The current send
is bounded by its timeout; unsent claimed events remain reclaimable after lease
expiry. No automatic daemon or production container is started by these commands.

Configure the existing batch/event retry/lease settings plus:

| Setting | Purpose |
| --- | --- |
| CUSTOMER_AUTH_EMAIL_WORKER_ID | Stable, unique logical worker ID; failure alerts are scoped by its hash |
| CUSTOMER_AUTH_EMAIL_POLL_SECONDS | Healthy watch polling interval |
| CUSTOMER_AUTH_EMAIL_FAILURE_BASE_SECONDS / FAILURE_CAP_SECONDS | Bounded exponential retry for dispatcher/database failures |
| CUSTOMER_AUTH_EMAIL_FAILURE_MAX_CONSECUTIVE | Exit nonzero after repeated operational failure; deployment supervisor must alert/restart |
| CUSTOMER_AUTH_EMAIL_CLEANUP_BATCH_SIZE | Bounded expired OAuth/rate-state cleanup |
| CUSTOMER_AUTH_EMAIL_BACKLOG_WARNING_COUNT / BACKLOG_URGENT_COUNT | Unsent queue count thresholds |
| CUSTOMER_AUTH_EMAIL_BACKLOG_WARNING_AGE_SECONDS / BACKLOG_URGENT_AGE_SECONDS | Age thresholds measured from event creation, including scheduled retries |
| CUSTOMER_AUTH_EMAIL_DISPATCHER_FAILURE_ALERT_THRESHOLD | Consecutive worker failures before raising its alert |

Values in `.env.example` are intentionally empty: they are not approved
production defaults. Urgent thresholds must be at least warning thresholds;
retry caps must be at least base delays. Every replica uses a different worker
ID but the same shared encryption/rate-limit keys and policy.

Monitoring writes deduplicated `AUTH_EMAIL_BACKLOG`, `AUTH_EMAIL_QUARANTINED` and
worker-scoped `AUTH_EMAIL_DISPATCHER_FAILURE` rows to existing `admin_alerts`.
Details contain counts/ages only, not email addresses, tokens or payloads.
Advisory locking serializes aggregate monitor updates; recovery preserves alert
history and acknowledgement metadata. A healthy worker cannot resolve another
worker's failure alert. Expected expired/replaced-token quarantine is not urgent;
delivery exhaustion and unreadable payloads require operator triage.

Operators must distinguish invalid-token discard from delivery/key failures.
Never blindly clear lease/quarantine flags or replay expired reset/verification
links. Reissue a fresh token through the authenticated/generic recovery flow when
appropriate. Quarantine acknowledgement/recovery policy, external alert routing,
supervisor restart behavior, key rotation and a real provider-outage drill must
be agreed and verified before production. Existing admin pages are not changed;
persisted alert rows and sanitized dispatcher output are not proof that an
on-call operator actually receives notifications.

## Configuration Gates

Default `CUSTOMER_AUTH_ENABLED=false` preserves existing behavior. Production
startup still rejects enabled customer auth until OAuth and the remaining
security/operational policies are implemented/approved; this cannot be bypassed with an approval
boolean. Do not change NODE_ENV to evade this gate.

Local tests use `CUSTOMER_AUTH_SESSION_POLICY=fixed-revoke-on-password-reset` and a
random test email key. PostgreSQL now enforces a shared fixed-window limiter per
action and normalized-email/session/proof identity, plus an aggregate peer cap of
10 times the identity limit. Keys are HMAC-SHA-256 with a separate backend-only
`CUSTOMER_AUTH_RATE_LIMIT_KEY`, identical on every replica. The old
`CUSTOMER_AUTH_LOCAL_RATE_*` settings are replaced by `CUSTOMER_AUTH_RATE_LIMIT`
and `CUSTOMER_AUTH_RATE_WINDOW_SECONDS`; their example values are local defaults,
not approved production thresholds. Behind the BFF, the peer cap is shared across
visitors; arbitrary X-Forwarded-For remains untrusted. This aggregate cap is not a
per-visitor IP limiter. A concrete ingress trust policy remains a production gate.

Before enabling production: approve renewal/revocation behavior, login/reset/resend
rate limits and shared enforcement, provider/sender/public URL, retry/backoff,
quarantine recovery, alerting and the operational dispatcher. Redis/RabbitMQ
integration must be Java as previously approved. Never put email keys or tokens in
NEXT_PUBLIC variables, logs or Git.

## Approved Auth State Schemas

Google/Facebook controls are enabled only when their backend provider settings
are complete and customer auth is explicitly enabled in a non-production environment.
Both additive tables below are **APPROVED** by the user on 2026-09-10.
Approval permits new migrations, not rewriting previously applied migrations or
enabling production auth. Application-database application and test evidence are
recorded separately below.

| Field / constraint | Purpose |
| --- | --- |
| id UUID PK | Transaction identifier |
| provider text CHECK IN ('GOOGLE','FACEBOOK') | Server-selected provider |
| state_hash char(64) UNIQUE NOT NULL, CHECK lowercase hex length 64 | Hash of independent random state |
| browser_binding_hash char(64) NOT NULL, CHECK lowercase hex length 64 | Hash of the separate HttpOnly browser-binding cookie |
| pkce_ciphertext jsonb nullable | Encrypted verifier where supported; no raw verifier in logs |
| redirect_uri text NOT NULL | Exact server allowlisted callback snapshot |
| locale text CHECK IN ('vi','en') | Fixed post-callback account destination |
| created_at, expires_at timestamptz NOT NULL | 10-minute TTL; CHECK created_at < expires_at <= created_at + 10 minutes |
| consumed_at timestamptz nullable | Atomic single-use consumption before exchange |
| index(expires_at) | Bounded expiry cleanup |

The shared limiter uses the following approved table. PostgreSQL avoids introducing a Redis service in this
phase; future Redis/RabbitMQ integrations still use Java.

| `customer_auth_rate_limits` field / constraint | Purpose |
| --- | --- |
| action varchar(64) NOT NULL, CHECK uppercase action format | Server-controlled action/bucket namespace, never arbitrary client input |
| key_hash char(64) NOT NULL, CHECK lowercase hexadecimal length 64 | HMAC of the subject; no raw email, IP, session or proof in storage |
| PRIMARY KEY(action, key_hash, window_started_at) | One shared counter per action/subject/fixed window across API replicas |
| window_started_at timestamptz NOT NULL | Database-time start of the current window |
| window_expires_at timestamptz NOT NULL, CHECK window_expires_at > window_started_at | Database-time end of the window; not a customer session TTL |
| attempt_count integer NOT NULL, CHECK attempt_count >= 1 | Atomically incremented counter, saturated at configured limit + 1 |
| index(window_expires_at) | Bounded expired-bucket cleanup |

Counter updates must use one atomic UPSERT with database time and recheck the
current window under the row lock. Reject requests once the configured limit is
exceeded, cap counter growth, and fail closed if the database is unavailable.
Limits/window lengths are explicit deployment configuration, not newly approved
production defaults. All replicas must share the same HMAC key and policy.
Forwarded client-IP headers are untrusted until a concrete ingress trust policy
is configured; never turn an arbitrary browser header into a limiter identity.

Schema approval is closed; do not request it again for these two tables.
Rollback must refuse to drop live OAuth transactions or active limiter windows;
existing migrations and application/customer records must remain untouched.

Migration: `migrations/20260910000500000_create_customer_auth_transaction_state.js`.
Its down method locks both tables before checking live rows. It refuses active
unconsumed OAuth transactions or unexpired rate windows; consumed/expired state
is ephemeral and can be removed, never used as a replacement for audit history.
No `blocked_until` policy is introduced: fixed-window rejection is the only
implemented limiter behavior. Counts saturate at limit + 1, so they are not exact
attempt analytics. Fixed windows can admit two window budgets around a boundary;
production thresholds must account for this rather than assuming sliding windows.

`OAuthTransactionStore` implements durable state creation and single-use consume.
State and independent browser binding use random 32-byte secrets stored as hashes.
PKCE uses AES-256-GCM with provider/state/binding/callback/locale authenticated as
additional data. Consume locks the row, rechecks wall-clock expiry after the lock,
and commits before the provider exchange. A removed callback allowlist
entry, wrong binding, wrong provider or failed decryption cannot consume the state.
These storage primitives are now used by the server-side Google/Facebook callback
routes. Provider adapters never choose the customer account by email. Keys, client
credentials and the exact callback allowlist are read only from backend environment
configuration; no arbitrary return-URL parameter is exposed.

Invalid/expired/consumed state returns 400; database, lock and decryption failures
return a generic 503 without revealing details. Failures before commit roll back;
a lost commit acknowledgement can leave state consumed, so restart authorization
rather than assuming that a 503 makes the old state reusable. The database CHECK only validates basic callback shape;
the service enforces exact allowlist membership and HTTPS (local loopback HTTP
only), both when creating and consuming a transaction.

`cleanupOAuthTransactions()` and `cleanupAuthRateLimits()` delete only expired rows
in bounded SKIP LOCKED batches. They do not delete customer/session/audit records.
The opt-in email dispatcher runs bounded cleanup after each batch. It is not
started automatically by the API or web server. Key rotation, deployed monitoring
and coordinated policy rollouts across replicas remain operational work.

No arbitrary return URL or automatic email-based linking is permitted. Provider
identity resolves via `(provider, provider_subject)`. New provider identities with
an existing account email are refused; the attempted new profile rolls back.
An existing provider subject continues to resolve to its original account even
when provider email changes. Missing email cannot create a new profile. Explicit
account-linking UI is not implemented. Disabled accounts cannot receive sessions.
New Google accounts require `email_verified=true`; this is not required for a
previously linked subject to retain its identity. Facebook never upgrades an email
to verified merely because `/me` includes it. The reservation/recovery policy for
unverified local/Facebook email addresses remains a production security decision.

## OAuth Callback Flow

1. The account page opens `/api/customer-auth/oauth/google/start?locale=vi` (or
   Facebook). The BFF rejects cross-site start requests and unexpected parameters.
2. The API creates an independent state/binding pair and encrypted transaction.
   Binding cookies are HttpOnly, SameSite=Lax, Path=/, Max-Age=600; HTTPS uses
   Secure and `__Host-`. Admin/session cookies cannot substitute for the binding.
3. Google receives PKCE S256 and a nonce derived from the transaction's verifier.
   `oauth4webapi` verifies the signed ID token using Google's JWKS, issuer,
   audience, expiry and nonce. Provider token exchange is outside DB transactions.
4. Callback consumes browser-bound state atomically, then resolves the provider
   subject under a transaction-level identity lock and an account row lock.
   First login creates profile/account/identity/session/audit atomically; repeated
   first-login callbacks cannot create duplicate identities or orphan profiles.
5. Only a customer-session cookie is issued. Tokens are never put in redirect
   URLs. The destination is the transaction's `/vi/account` or `/en/account`;
   failures use only `?oauth=error`. Callback has no locale query parameter.

The BFF checks redirect destinations and cookie attributes before forwarding.
POST auth still requires an exact Origin. OAuth callbacks may be cross-site GETs
because state + browser binding are verified server-side. Callback upstream time
is bounded to 45 seconds to accommodate the bounded provider requests; ingress
timeouts must not be shorter. Provider-denied callbacks consume state without
creating a session. A failed exchange requires a fresh authorization start.

Facebook is a separate adapter using an explicitly configured Graph API version.
It verifies token validity, app ID, user ID and expiration, then checks `/me` ID
against the debug result and sends `appsecret_proof`. It does not assume that
Facebook email is verified. PKCE is not advertised for the selected Meta server
code flow without documented provider support; state/browser binding and the
confidential-client exchange remain mandatory. Never log provider request URLs,
which can contain Meta token inspection parameters.
Next.js development request logging excludes customer-auth URLs. Deployment
ingress/access logs must similarly omit callback query strings, and egress/APM
instrumentation must redact `client_secret`, `access_token`, `input_token`,
`state`, `code`, cookie and Authorization values. Meta's documented query-based
exchange/inspection is retained until an alternative transport is confirmed for
the configured app/version. This redaction must be tested at the actual deployment
boundary, not inferred from application code having no console.log calls.

### Development Provider Configuration

Use a dedicated dev database and registered provider applications/test users.
Do not repoint these commands at production. The test scripts below already
create/drop their own isolated databases and perform migration up/down/up.

- Set `CUSTOMER_AUTH_ENABLED=true` only with the approved local session candidate
  `CUSTOMER_AUTH_SESSION_POLICY=fixed-revoke-on-password-reset` and independent
  shared `CUSTOMER_AUTH_RATE_LIMIT_KEY` / `CUSTOMER_AUTH_OAUTH_KEY` values.
- `PUBLIC_WEB_URL` must be the actual web origin, for example
  `http://localhost:3002` when Docker already owns port 3000. HTTPS is required
  outside local loopback. Never change NODE_ENV to bypass the production gate.
- Google: configure `CUSTOMER_AUTH_GOOGLE_ENABLED`, `..._CLIENT_ID`,
  `..._CLIENT_SECRET`, `..._REDIRECT_URI` in backend env/secret only.
- Register the exact Google callback `${PUBLIC_WEB_URL}/api/customer-auth/oauth/google/callback`
  in the provider console, set the same value in `CUSTOMER_AUTH_GOOGLE_REDIRECT_URI`,
  and include it in the JSON array `CUSTOMER_AUTH_OAUTH_REDIRECT_URIS`.
- Facebook uses the equivalent `CUSTOMER_AUTH_FACEBOOK_*` settings and callback
  `/api/customer-auth/oauth/facebook/callback`, plus explicit
  `CUSTOMER_AUTH_FACEBOOK_GRAPH_VERSION`. App mode, permitted users, permissions,
  provider review and the supported API version must be verified with that app.
- No wildcard callback, secret in `NEXT_PUBLIC_*`, credentials in committed
  `.env.example`, or account email-based auto-linking is permitted.

Provider settings are configuration gates, not fake defaults. Automated signed
fixtures exercise the callback code but do not prove that either provider console
or a real browser login is correctly configured.

## Verification

Run from the repository root with PostgreSQL available:

```powershell
npm run verify:customer-auth:schema
npm run verify:customer-auth:state
npm run verify:customer-oauth:provider
npm run verify:customer-oauth:google
npm run verify:customer-oauth
npm run verify:customer-oauth:facebook
npm run verify:customer-oauth:facebook:e2e
npm run verify:customer-auth
npm run verify:customer-auth:proxy
npm run verify:customer-email
npm run verify:customer-email:operations
npm run lint
npm run typecheck
npm run build
```

Database verifiers create/drop random isolated databases, never reset application
data. Auth checks cover normalization, duplicate signup rollback, password/cookie
isolation, token-purpose rejection, concurrent single-use consumption, expiry,
reset-session revocation, disabled accounts and production gating. BFF checks cover
CSRF, route/method allowlists, cookie stripping, oversized bodies and upstream
failure. Email verification covers encrypted queueing and retry/lease behavior.

Passing these automated checks alone does not prove real-provider verification.
The following historical evidence predates the development acceptance sign-off
at the end of this report; production gates remain separate.

Verification recorded on 2026-09-10: lint, typecheck, local production build,
source boundaries, API foundation, catalog (37 HTTP checks), customer auth
(37 HTTP checks plus assertions), customer BFF and isolated email tests passed.
No application database reset, real email send or OAuth-provider login was run.

Security follow-up on 2026-09-10 upgraded Next.js from 16.2.11 to 16.3.4 and
updated affected compatible transitive packages (`sharp`, `postcss`, `nanoid`,
`brace-expansion`, `js-yaml`). Full `npm audit --json` then reported zero known
vulnerabilities. No forced major-version update or blanket `audit fix` was used.
This is a point-in-time advisory check, not proof that production is secure.

Additional auth regression checks cover expired reset tokens, verification bound
to an obsolete email address, and revocation of active access when an account is
disabled. OAuth provider and production configuration gates remain open; the two
supplemental schema approvals have since been closed as recorded above.

Docker follow-up: rebuilt web/API images and recreated only `commerce-api` and
`web` with `--no-deps --wait`; both and the unchanged PostgreSQL container were
healthy. The web container reports Next.js 16.3.4, `/api/health` reports database
connected, and `/api/customer-auth/config` correctly remains disabled. No seed,
migration, real email or OAuth request was run against application data.

Supplemental-schema verification on 2026-09-10: the new migration passed 19 schema
checks, isolated up/down/up and active-row rollback guards. Shared-state tests
passed concurrent admission across two pools, normalized-identity limiting across
two HTTP servers, fail-closed database failure, single-use OAuth consumption,
expiry after row-lock wait, encrypted verifier recovery, browser/provider binding,
callback allowlist changes and bounded expired-state cleanup. Phase 2 schema
verification is pinned to its original migration boundary and still passes its
55 checks; newer migration compatibility is covered by the auth verifiers.

Also passed: auth (37 HTTP checks plus assertions), auth BFF, email, source
boundaries, API foundation, catalog/BFF, lint, typecheck and Next.js production
build. The current audit returned zero known vulnerabilities. These results do
not include real Google/Facebook login, real email delivery or production settings.
The new migration has only been applied to disposable verification databases;
the running application's database and Docker images were not upgraded in this
supplemental-schema step. After deployment backup/review, `npm run db:up` (local)
or `npm run docker:migrate` (rebuilt image) applies pending additive migrations.

## Earlier Verification Snapshot (Before Live Development Checks)

The approved two-table migration was reapplied only to isolated databases, with
up/down/up, 19 schema checks and the schema/concurrency/auth regressions rerun.
Google was implemented and verified before adding Facebook:

| Gate | Current evidence / remaining requirement |
| --- | --- |
| Google callback foundation | Signed JWT/JWKS adapter checks and actual HTTP + isolated PostgreSQL callback/session tests; real Google Console/browser login still pending |
| Facebook adapter | Token debug/app/subject/expiry checks and actual HTTP + isolated PostgreSQL callback/session tests with mocked Meta transport; real Meta app login/permissions still pending |
| Ownership/session | No email auto-link, collision rollback, same-subject concurrency, disabled-account lock race and hashed 30-day session issuance covered |
| Shared limiter | Concurrent replicas, HTTP enforcement and fail-closed behavior covered; production thresholds and trusted ingress/per-client policy remain open |
| Email operations | Dispatcher, retry/lease, bounded cleanup and alert persistence implemented; provider credentials, real send/retry/outage/shutdown drill and operational notification delivery remain open |
| Security configuration | Secrets/allowlist environment-only; real values absent from the current environment. Revocation/renewal, unverified-email recovery, key rotation and provider compliance settings still require production decisions/evidence |

**Phase 3.2 remains IN PROGRESS / NOT PRODUCTION-READY.** No real Google/Facebook
authentication or external email send is claimed. No production database,
application customer/order data or legacy/admin flow was modified by these tests.

Latest verification on 2026-09-10: Google adapter 25 checks, Google HTTP/DB E2E
29 checks, Facebook adapter 26 checks and Facebook HTTP/DB E2E 32 checks passed.
Additional auth integration tests cover concurrent subject creation, unverified
Google rejection and a callback genuinely blocked behind an account-disable row
lock. BFF tests cover callback without locale, required POST Origin, cookie and
redirect validation, forwarded errors and sensitive-route logging configuration.

Email operations tests cover real isolated PostgreSQL state, fake provider
failures, worker-scoped alert recovery, abort-before-claim, mid-batch lease reclaim
and polling-listener cleanup. A child-process CLI test with an unreachable local
database proves watch backoff, bounded failure exit and unknown-flag rejection
without ever sending mail. External provider outages, egress-log redaction and
deployment signal/supervisor behavior still need real-environment verification.

Protocol references: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[Meta code exchange](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business),
[Meta token inspection](https://developers.facebook.com/docs/facebook-login/access-tokens/debugging-and-error-handling),
[Meta app-secret proof](https://developers.facebook.com/docs/facebook-login/security),
[Next.js logging](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging).

## Revised Acceptance Gate (2026-09-10)

This section supersedes the earlier gate snapshot. The user approved deferring
real Facebook OAuth while Meta Business Verification/provider setup is unresolved.
Set `CUSTOMER_AUTH_FACEBOOK_ENABLED=false`; Facebook is not a Phase 3.2 PASS
requirement until explicitly brought back into scope. Do not bypass verification,
add unrelated permissions or mark Facebook as successfully verified.

The following requirement/evidence snapshot predates final user sign-off; it is
retained as the verification record rather than a claim of additional test runs:

| Requirement | Evidence / remaining work |
| --- | --- |
| Local register/login/reset/verify | Existing automated coverage; complete real email-link verification/reset workflow still required |
| Google real browser OAuth | User reports successful real Google login |
| Google identity persistence | Confirm repeated real login resolves the same provider subject/account without duplicate profiles |
| No email auto-linking | Existing collision/rollback tests; preserve this invariant |
| Resend verification/reset emails | Two real messages accepted through the Resend adapter in isolated live verification; inbox/browser delivery remains unverified |
| Token expiry/single-use/revocation | Auth/state tests rerun; live verification checked generated token links, TTL values, actual HTTP consumption/replay and reset session revocation |
| Shared rate limiter | Existing replica/concurrency and fail-closed tests; retain verification evidence |
| Production secrets/redirect configuration | Local configuration only has been validated; production-specific configuration remains unverified |
| Security audit clean | Full dependency audit rerun: zero known vulnerabilities; this does not replace the remaining security/configuration review |

The approved OAuth/rate-limit migration has now also been applied to the local
development database. No production migration or deployment was performed.
Web/API were restarted in development mode to load local environment settings.

Only the privately approved mailbox, configured locally through
`TEST_EMAIL_RECIPIENT`, is authorized for further real email tests. Two
unsent messages for the previously allowed recipient were quarantined and their
unused auth tokens revoked. No background email dispatcher is running.
The permitted recipient currently has a verified Google account without a local
password. Do not auto-link or silently add a password to make reset tests pass;
agree on a safe local-account test fixture before exercising those flows.

That fixture has now been implemented in `scripts/verify/customer-email-live.ts`:

```powershell
rtk npx tsx scripts/verify/customer-email-live.ts --send
```

This command is explicitly opt-in and sends two real emails on each run. It only
accepts development mode and a loopback PostgreSQL host. It creates a random,
isolated database, uses the real auth HTTP handler, registers the approved mailbox
as a local fixture there, and sends verification/reset messages through Resend.
It then consumes the generated tokens automatically, rejects replay, checks the
old password/session are rejected after reset, and removes its temporary server
and database. Tokens/passwords/provider secrets are not printed or persisted by
the verifier. The live development Google account is not changed.

The messages are marked `[DEV AUTO TEST]`. Their links are for the temporary test
environment and are no longer usable when the command exits; do not use them to
reset the real Google account. These checks are not a browser/inbox E2E result.

Recorded run: `sent=2`, `retried=0`, `quarantined=0`; HTTP consumption/replay,
24-hour verification TTL, 30-minute reset TTL, verified-account state, old-password
rejection and pre-reset session revocation passed. The existing auth verifier
(37 HTTP checks plus assertions) and shared-state/concurrency verifier also passed
again. Full dependency audit reported zero known vulnerabilities.

## Final Development Sign-off

Status: **PHASE 3.2 COMPLETE / PRODUCTION GATED**.

The user accepted development completion for local authentication, Google OAuth
and Resend verification/reset email flows. This sign-off supersedes earlier
in-progress status snapshots. It does not add agent-observed evidence for browser
or inbox checks that were not run, and does not rewrite the historical test record.

Facebook real OAuth is **DEFERRED** pending Meta provider/business verification.
Keep `CUSTOMER_AUTH_FACEBOOK_ENABLED=false` until explicitly re-approved.

Production deployment remains blocked until each gate is verified separately:

- Production-specific secrets and provider configuration.
- Exact production redirect allowlists, public origin and HTTPS configuration.
- Trusted ingress and shared rate-limit policy for real client identities.
- Key rotation and associated token/session recovery procedures.
- Operational monitoring, alert delivery, retry/recovery and shutdown verification.

Do not remove the runtime production guard or enable production auth solely
because development acceptance is complete. No production deployment is approved
by this sign-off, and no next-phase implementation is started automatically.

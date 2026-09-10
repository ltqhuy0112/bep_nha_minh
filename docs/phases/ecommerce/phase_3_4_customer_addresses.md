# Phase 3.4 - Customer Addresses

## Scope and Decisions

Implement the remaining customer-address portion of Phase 3 using the approved
`customer_addresses` schema from Phase 1 and its existing Phase 2 migration.
The administrative-location addendum adds one migration and order snapshot guards.
No checkout, guest claim, Java worker, Redis or RabbitMQ integration is included.
Customer auth remains production-gated. See [location runbook](../../operations/location-data.md).

- Ownership is `customer_accounts.customer_id -> customer_addresses.customer_id`,
  resolved exclusively from an active, unexpired, nonrevoked customer session.
  Admin sessions are not customer credentials. Request bodies cannot supply owner IDs.
- Required fields: recipient name, phone, street address, `provinceCode`, `wardCode`
  and explicit `isDefault`. Province/ward names are resolved internally; free-text
  city/ward/district inputs are rejected. Legacy district remains nullable and is
  displayed on existing addresses only. Editing a legacy address requires selecting
  its current province and ward; no guessed backfill is performed.
- Transport limits: recipient name 120 characters, street 500 characters,
  phone 7-15 digits with optional formatting and at most 24 characters.
  These are input-validation limits, not new schema relationships.
- Defaults are explicit. Selecting a default clears the previous one atomically.
  Creating the first address does not silently select it; deleting/unchecking a
  default leaves none. This preserves the approved at-most-one constraint without
  introducing an unapproved automatic choice.
- Deleting a saved address removes only that address-book row. It does not touch
  customer profile fields, cart/order records or historical recipient snapshots.
  No seeded personal address data is created.

## API Contract

| Method | Standalone API route | Result |
| --- | --- | --- |
| GET | `/api/v1/customer-addresses` | Own addresses, default first, then newest; `{items}` |
| POST | `/api/v1/customer-addresses` | Create; 201 with saved address |
| PUT | `/api/v1/customer-addresses/{id}` | Replace editable fields; 200 with saved address |
| DELETE | `/api/v1/customer-addresses/{id}` | Delete; 200 `{accepted:true}` |
| PUT | `/api/v1/customer-addresses/{id}/default` | Set default; 200 with saved address |

All results use the v1 envelope. DELETE/default requests send an empty JSON object.
No query parameters are accepted. Missing/expired/revoked/disabled sessions return
401, invalid Origin returns 403, foreign/missing address IDs return the same 404,
and unknown fields/invalid input return 400. Mutation rate limits use the existing
shared policy with the `ADDRESS_WRITE` scope; exceeding it returns 429/Retry-After.
No automatic mutation retries are performed, especially for non-idempotent POST.

The BFF exposes equivalent `/api/customer-addresses` routes. It allowlists methods,
path shapes, the customer session cookie and the Origin; rejects duplicate cookies;
bounds JSON bodies to 16 KiB; and forwards neither admin cookies, Authorization,
X-Forwarded-For nor upstream Set-Cookie/internal headers. Responses are no-store.
Browser reads/writes time out after 15 seconds, upstream BFF calls after 10 seconds.

## Transactions and Structure

The auth service exposes `withSession()` to lock/recheck the account and session
inside the same transaction as address operations. Consistent lock ordering is
account -> session -> address. Account locking serializes mutations across sessions
of the same owner, including concurrent first-address/default writes. The existing
partial unique index on default addresses remains the final database safeguard.

Default clearing, save/delete and audit insertion commit or roll back together.
Audits record action, address ID and customer actor only; no recipient, phone,
address, raw email, token or cookie is included in metadata.

- `packages/shared/src/schemas/customer-address.ts`: DTO/input contract and Zod validation.
- `apps/api/src/features/customer-addresses`: HTTP validation, transactional service, OpenAPI.
- `apps/web/src/features/customer-addresses`: UI, form, hook, transport and VI/EN copy.
- `apps/web/src/app/[locale]/account/addresses/page.tsx`: routing, metadata and composition only.

## UI and Navigation

`/vi/account/addresses` and `/en/account/addresses` are noindex pages linked from
the signed-in account page. They provide list/empty/loading/error states, inline
create/edit forms, explicit default controls, and a delete confirmation dialog.
Mutations fetch refreshed data without a document reload. Failed saves preserve
the draft; controls prevent overlapping mutations. No sensitive data is rendered
on the server or stored in localStorage.

Unauthenticated users return to the dedicated login page with an exact, same-locale
address destination. The existing return allowlist now includes only that additional
literal path, never arbitrary customer IDs or return URLs. Guest checkout remains
optional-auth in its future phase; this address book is for signed-in customers.

## Verification

```powershell
npm run verify:customer-addresses
npm run verify:customer-addresses:proxy
npm run verify:locations
npm run verify:locations:proxy
npx tsx scripts/verify/customer-auth-routes.ts
npm run typecheck
npm run lint
```

The database verifier creates/drops a random isolated local database and applies
existing migrations there. It never sends email or performs provider OAuth.
Recorded: 132 HTTP checks passed covering CRUD, tenant isolation, explicit defaults,
concurrent default changes, full rollback on audit failure, validation, audit metadata, unchanged customer profile,
disabled/revoked/expired sessions and shared rate limits. The proxy verifier passed
cookie/header isolation, duplicate-cookie rejection, Origin/body/path restrictions,
upstream errors and Retry-After forwarding.

Browser verification uses the existing development session only to view the empty
state and open the form in VI/EN at desktop/mobile sizes; it does not save an address
to the user's real account. HTTP mutation coverage above uses isolated fixtures.

Typecheck, full lint, the source-boundary check and the extended auth destination
tests passed. The local API was restarted in watch mode; readiness returned 200
and its live OpenAPI document contains all three address path definitions. No
production build or Docker rebuild was run for this local phase verification.

Production auth/configuration/ingress gates from Phase 3.2 remain open. No production
deployment, full checkout flow or real email/OAuth regression run is claimed.

### Administrative Lookup Addendum (2026-09-11)

The additive location migration was verified up/down/up in an isolated database,
then applied to local development only. Offline sync imported 34 provinces and
3,321 wards. Location tests passed for idempotence, legacy district preservation,
province membership, API cache, canonical snapshots, order immutability and safe
rollback refusal. The public location BFF passed credential-isolation, path and
error/cache checks. Source boundaries, lint, typecheck and the Next.js production
build passed. Live API/BFF province and Hanoi ward lookups returned 200 with
public cache headers (34 provinces, 126 Hanoi wards).

The live local form loaded province lists in VI/EN and was inspected at wide and
narrow viewports without horizontal overflow. No address was saved to the real
customer account; mutation coverage uses isolated fixtures. The Dockerfile includes
the bundled dataset, but the Docker image was not rebuilt for this addendum.

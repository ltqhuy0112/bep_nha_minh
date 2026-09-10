# Commerce Phases

Start with [approved business and schema decisions](phase_1_review_decisions.md).
This is the canonical specification, including subsequent slot, token, email and
OAuth decisions. The superseded initial schema draft has been removed; historical
conflicts are recorded in section 8 of the approved specification.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Business rules, schema, invariants and acceptance plan | Approved with open configuration; see the specification's runtime gates |
| [2](phase_2_foundation.md) | Additive migrations, legacy compatibility and independent API foundation | Implemented; verification recorded in the phase report |
| [3.1](phase_3_1_catalog.md) | Read-only VI/EN catalog, availability and fulfillment configuration | Implemented; checkout remains disabled |
| 3.2 | Customer authentication, sessions, email verification/reset and Google/Facebook OAuth | Next; implementation not started |
| Remaining Phase 3 | Customer addresses and guest/account cart | Not started; confirm implementation packet before coding |
| 4 | COD checkout, ownership/claim, reservations, cancellation and admin integration | Not started |
| 5 | 60-second review, stock reconciliation, validation/alerts, outbox/RabbitMQ and resilience | Not started |
| 6 | End-to-end/load verification and operational documentation | Not started |

RabbitMQ/Redis integration services must use Java. Flash sale, online payment and
Kubernetes/Rancher deployment require separate approval. Phase 4 alone does not
complete the commerce release: automated review and operational safeguards remain.

## Boundaries

- Next.js pages compose features. Browser code imports transport contracts, never
  database repositories or backend secrets.
- The API validates and authorizes requests; business services own transactions
  and repositories handle persistence. Create folders only when they have code.
- PostgreSQL is authoritative. Redis may support caching/rate limiting, not order
  truth. Redis Pub/Sub must not replace durable delivery.
- Outbox publication uses leases and publisher confirmation. Consumers commit
  before ACK and deduplicate event IDs; published does not mean consumed. Stale
  events require version checks or refetching, not blind projection updates.
- Web, API and future Java workers are independent processes. Keep external
  configuration, readiness, graceful shutdown and bounded pools/concurrency.
  Cluster deployment, backup and database/broker HA still need a separate plan.
- New HTTP contracts are designed in their implementation phase: ownership checks,
  CSRF/rate limits, validation and idempotency are mandatory where applicable.
  Use 401 for missing authentication, 403 for insufficient permission and
  non-enumerating 404 for inaccessible customer resources. Never log tokens.

## Execution and Evidence

For each approved phase: Architect prepares the scoped implementation packet;
Implementer changes code; Independent Reviewer checks invariants, compatibility
and test evidence. Record the outcome in that phase's report. There is no
dependency on the removed multi-agent prompt files.

Approved requirements are not proof of implementation. Acceptance scenarios in
Phase 1 remain expected behavior until the relevant implementation is tested.
Keep applied migrations and regression verification scripts even after a phase
finishes. Do not rewrite migrations or reset customer data to clean the project.

See the [project README](../../../README.md) for local/Docker setup, migration,
catalog seed and slot configuration commands. Recheck open security/configuration
gates before enabling each new flow. Phase 3.2 is intentionally excluded from the
current cleanup and foundation/catalog commit.

# Backlog

Tracked follow-up work that is not part of any phase's exit criteria but was
identified while building one. Each item names the phase it came from, what
state it's actually in, and what would need to be true to close it. This is
not a roadmap — see [phase-tracker.md](phase-tracker.md) for sequenced,
committed work. Items here get promoted into a phase (or folded into Phase 22
security hardening / Phase 24 complete QA) when prioritized, not worked
ad hoc.

## How to read "state" on each item

Every item below is labeled with one of:

- **Completed architecture** — the design/pattern is decided and documented,
  but no runtime code implements it yet.
- **Implemented functionality** — real code path exists, is unit-tested, and
  runs today with no external dependency.
- **Credential-gated functionality** — real code path exists but only
  activates once a real secret/credential is configured; fails safely
  ("not configured") without one, per every prior phase's posture.
- **Placeholder provider adapter** — a named, registered stub whose methods
  throw rather than fake success; no real third-party call is made.
- **Deferred production verification** — implemented and unit-tested against
  mocks, but never exercised against the real external system it targets.

## Phase 18 (Integrations) production-completeness gaps

Source: [public-api.md](../architecture/public-api.md)'s "Known gaps"
section, carried forward from the phase-tracker's Phase 18 entry.

### 1. Expand the public API beyond the two current read-only endpoints

- **State:** Implemented functionality (for the two that exist) +
  completed architecture (for the pattern to extend).
- **Today:** `GET /api/v1/processes`, `GET /api/v1/workflows` — both
  read-only, scope-gated, paginated. See
  [public-api.md — Endpoints (v1)](../architecture/public-api.md#endpoints-v1).
- **To close:** Add write endpoints (e.g. `POST /api/v1/workflows` to start a
  workflow, `POST /api/v1/tasks/{id}/complete`) and read endpoints for other
  approved resources (tasks, exceptions, evidence). Each new endpoint needs
  its own scope, its own authorization test, and its own entry in the
  endpoint table — do not widen an existing scope to cover a new resource.
- **Depends on:** Nothing blocking; can start immediately. Write endpoints
  should land after Phase 22's authorization re-review, since a public
  write path is higher-risk than the existing read-only surface.

### 2. Generate and publish an OpenAPI specification

- **State:** Completed architecture only (the endpoint table in
  public-api.md is hand-maintained prose, not a machine-readable spec).
- **To close:** Generate `openapi.yaml`/`openapi.json` from the route
  handlers' existing Zod request/response schemas (avoids a second,
  hand-drifting source of truth), publish it at a stable path (e.g.
  `/api/v1/openapi.json`), and add a CI check that fails if the generated
  spec doesn't match the committed one.
- **Depends on:** Item 1 landing first is not required, but doing them
  together avoids generating a spec twice.

### 3. Wire the remaining planned webhook event types to real domain events

- **State:** Implemented functionality for the delivery mechanism;
  completed architecture (defined but unwired) for 5 of 6 event types.
- **Today:** `WEBHOOK_EVENT_TYPES` defines `workflow.started`,
  `workflow.completed`, `workflow.failed`, `exception.created`,
  `exception.closed`, `approval.decided`. Only `workflow.completed` has a
  real `triggerWebhookEvent()` call site
  (`workflow-engine.ts`'s `maybeCompleteWorkflow()`). See
  [public-api.md — Supported outbound event types](../architecture/public-api.md#supported-outbound-event-types).
- **To close:** Add one `triggerWebhookEvent()` call site per remaining type
  at its natural domain-code location (`workflow-engine.ts`'s start/fail
  paths, `exceptions.ts`'s create/close, `approval-resolution.ts`'s
  decision recording), each with its own delivery test asserting the
  correct payload shape and idempotency key.
- **Depends on:** Nothing blocking.

### 4. Strengthen SSRF defenses against DNS rebinding

- **State:** Implemented functionality (literal-IP check), with a known
  gap against a stronger attack class.
- **Today:** `src/lib/webhooks/ssrf-guard.ts` rejects a subscription URL
  that isn't `https://` or that resolves to a private/loopback/link-local
  IP **at subscription-creation time only**. A hostname that resolves
  differently at delivery time (DNS rebinding) is not caught. See
  [public-api.md — Security](../architecture/public-api.md#security).
- **To close:** Resolve-and-pin the IP at delivery time (not just creation
  time), and re-validate that pinned IP is still non-private immediately
  before the outbound HTTP connection is made — ideally by connecting to
  the pinned IP directly with the original hostname sent only as the `Host`
  header/TLS SNI, so a second DNS lookup can't be substituted in between
  the check and the connection.
- **Depends on:** Nothing blocking. Should land before or during Phase 22
  (security hardening), since this is explicitly a security gap, not a
  feature gap.

### 5. Build event-to-workflow mapping configuration

- **State:** Completed architecture only.
- **Today:** Every verified, deduped inbound Slack event is logged
  (`inbound_webhook_events.event_type`) but nothing lets an admin configure
  "event type X starts workflow Y." See
  [public-api.md — Inbound webhooks](../architecture/public-api.md#inbound-webhooks).
- **To close:** An admin-configured mapping table (organization-scoped,
  `integration.manage`-gated) from `(provider, event_type, match criteria)`
  to a specific **published** workflow-start action, with explicit
  validation that the target workflow exists, is published, and that the
  mapping cannot be used to trigger a higher-privilege action than the
  admin who created the mapping could trigger themselves. This is a
  privilege-boundary feature, not a simple config screen — plan for
  dedicated authorization tests, not just CRUD tests.
- **Depends on:** Item 3 (a wider set of wireable event types) is not a
  hard dependency — mapping can start with Slack's existing inbound events
  alone.

### 6. Implement and live-verify provider integrations beyond Slack

- **State:** Placeholder provider adapter (Microsoft Teams, Microsoft 365,
  Google Workspace, Jira, ServiceNow, Zapier) — each registered via
  `NotImplementedProvider` in `src/lib/integrations/registry.ts`; every
  adapter method throws rather than faking success. Slack itself is
  implemented functionality for OAuth connect and inbound events, but
  deferred production verification for both (no real Slack app/credentials
  exercised end-to-end in this environment). See
  [public-api.md — Integration catalog](../architecture/public-api.md#integration-catalog)
  and [public-api.md — Production verification steps](../architecture/public-api.md#production-verification-steps-unresolved-live-provider-dependencies).
- **To close, per provider:**
  1. Implement the real OAuth/API-key connect flow and at least one real
     inbound and outbound operation against that provider's actual API.
  2. Obtain real sandbox/developer credentials for that provider (a
     Microsoft 365 developer tenant, a Google Workspace test domain, a
     Jira Cloud trial, a ServiceNow PDI, a Zapier developer app).
  3. Run a genuine end-to-end connect → verify → disconnect cycle against
     that real system and record the result — a passing mocked unit test
     is not sufficient to change this item's state to "implemented."
  4. Update this backlog entry and public-api.md's provider table only
     after step 3 actually happened, not when the code is written.
- **Depends on:** Real developer/sandbox credentials per provider — this is
  the class of work this program's stopping rule explicitly calls out
  ("unavailable credentials required for genuine verification"). Do not
  build a provider's connect flow further than Slack's without first
  securing that provider's sandbox credentials, to avoid a second round of
  "implemented but never verified" debt.

## Related documents

- [Phase tracker](phase-tracker.md)
- [Public API, webhooks, and the integration catalog](../architecture/public-api.md)
- [Integration architecture](../architecture/integration-architecture.md)

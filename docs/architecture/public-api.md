# Public API, Webhooks, and the Integration Catalog

Implemented as a continuation of Phase 18 (Integrations)
([src/lib/api/](../../src/lib/api/), [src/lib/services/api-keys.ts](../../src/lib/services/api-keys.ts),
[src/lib/services/webhooks.ts](../../src/lib/services/webhooks.ts),
[src/lib/services/integration-connections.ts](../../src/lib/services/integration-connections.ts),
[src/lib/integrations/](../../src/lib/integrations/),
[src/app/api/v1/](../../src/app/api/v1/)). See also
[integration-architecture.md](integration-architecture.md)'s SSO/SAML
section for the sibling piece of this phase.

## Scope note

This is a large surface area. What follows documents exactly what is
built and tested against deterministic mocks — nothing here claims a
live, verified connection to any real third-party provider except
where explicitly stated. See "Known gaps" at the end for what was
deliberately bounded out of this pass.

## API authentication

Every `/api/v1/*` request authenticates with `Authorization: Bearer
pp_live_<token>`. `src/lib/services/api-keys.ts`'s `verifyApiKey()`
hashes the presented key (sha256) and looks it up by `key_hash` —
**the raw key is never stored**, only its hash, the same posture
password storage uses. A key acts with the RLS visibility of its
creator (`api_keys.created_by`): `src/lib/api/tenant-context.ts`'s
`resolveApiTenantContext()` resolves that member's
`organization_member`/`profile` row and opens the same
`withTenantContext()` transaction a session-based request would, so
the same RLS policies apply — a key does not bypass row-level security,
it inherits its creator's real, currently-held permissions, re-checked
on every request. Endpoint-level authorization on top of that is the
key's own **scope** array (`processes:read`, `workflows:read`,
`webhooks:inbound`), checked in `src/lib/api/authenticate.ts` before
the request reaches a handler.

## API key lifecycle

- **Create** (`createApiKey()`) — returns the raw key exactly once, in
  the response only; `/app/integrations/api-keys` shows it in a
  one-time banner immediately after creation and never again.
- **Rotate** (`rotateApiKey()`) — revokes the existing key and creates
  a new one with the same name/scopes/expiry. There is no in-place key
  replacement: since only a hash is ever stored, no key value can be
  recovered or reissued, so "rotation" is definitionally revoke +
  create.
- **Revoke** (`revokeApiKey()`) — immediate; a revoked key fails
  `verifyApiKey()`'s `status = 'active'` check on its very next use.
- **Expire** — `expires_at`, checked the same way (`expires_at is null
or expires_at > now()`); no background job is needed since expiry is
  enforced at verification time, not swept proactively.

## Rate limiting

A fixed 60-second trailing window, capped at 60 requests per key
(`checkRateLimit()`), counted directly from `api_key_usage_log` — the
usage log the "API usage logs" deliverable already requires exists
independently, so this reuses it rather than adding a second counter
table. A limited request returns `429` with `{ error: { code:
"rate_limited", ... } }` before touching any resource query.

## Error envelope, pagination, versioning

Every response — success or failure — is JSON. Errors are always `{
error: { code, message } }` with a matching HTTP status
(`toSafeErrorResponse()`, extended with `bad_request` → 400 and
`rate_limited` → 429 for this phase). Successful list responses are `{
data: [...], pagination: { limit, offset, hasMore } }` —
offset/limit pagination (`?limit=&offset=`, capped at 100/page), not
cursor-based, matching every other list endpoint's convention in this
codebase. `/api/v1/` is the version prefix; a breaking change ships as
`/api/v2/` alongside it, never an in-place breaking change to `v1`.

## Endpoints (v1)

| Method | Path                | Scope            | Filters                      |
| ------ | ------------------- | ---------------- | ---------------------------- |
| GET    | `/api/v1/processes` | `processes:read` | `status`, `q` (title search) |
| GET    | `/api/v1/workflows` | `workflows:read` | `status`, `processId`        |

Deliberately read-only and deliberately two resources — the "approved
ProcessPilot resources" the requirement calls for, bounded to what
this pass could build, test, and document to the same bar as the rest
of the codebase rather than a wide, shallow surface. No OpenAPI JSON
file is generated; this table plus the code itself is the
hand-maintained spec for now — see known gaps.

## Outbound webhooks

`webhook_subscriptions` (organization-configured target URL + event
types + an encrypted signing secret) and `webhook_deliveries` (one row
per attempt series) — see
[src/lib/services/webhooks.ts](../../src/lib/services/webhooks.ts).

- **Signing** — every delivery's HTTP POST body is HMAC-SHA256-signed
  with the subscription's secret
  (`src/lib/webhooks/signing.ts`), sent as `X-ProcessPilot-Signature`
  (hex-encoded) alongside `X-ProcessPilot-Event`. A receiving endpoint
  verifies by recomputing the same HMAC over the raw body.
- **Delivery, retry, and dead-lettering reuse the existing
  background-job worker** (ADR-0009) rather than reimplementing queue
  mechanics: `triggerWebhookEvent()` enqueues a `deliver-webhook` job
  per matching subscription; `src/lib/jobs/webhook-handlers.ts`'s
  handler sends the request and rethrows on failure so the worker's
  own exponential backoff (`computeBackoffMs()`) retries it, up to the
  job's `max_attempts`. The _delivery_ row's own status only becomes
  `dead_letter` (vs. the still-retryable `failed`) on the job's last
  allowed attempt, so the admin UI's delivery log accurately reflects
  "no further retries will happen."
- **Replay** — `replayWebhookDelivery()` resets a `failed`/`dead_letter`
  delivery to `pending` and re-enqueues it with a fresh idempotency
  key, from `/app/integrations/webhooks`.
- **SSRF guard** — `src/lib/webhooks/ssrf-guard.ts` rejects a target
  URL that isn't `https://`, or that resolves (by IP literal) to
  loopback/link-local/private ranges, at subscription-creation time.
  Best-effort, not DNS-rebinding-proof — see known gaps.
- **Secret rotation** — not implemented as a distinct action in this
  pass (delete + recreate the subscription achieves the same result,
  issuing a fresh secret) — see known gaps.

### Supported outbound event types

`workflow.started`, `workflow.completed`, `workflow.failed`,
`exception.created`, `exception.closed`, `approval.decided`
(`WEBHOOK_EVENT_TYPES` in `webhooks.ts`). **Only `workflow.completed`
is actually wired to a real trigger call site in this pass**
(`workflow-engine.ts`'s `maybeCompleteWorkflow()`) — the other five are
defined and selectable in the subscription UI, but nothing in the
domain code calls `triggerWebhookEvent()` for them yet. This mirrors
Phase 16's "one representative trigger per category" scoping decision
and is a documented, deliberate gap, not an oversight.

## Inbound webhooks

`inbound_webhook_events` is the idempotency/audit table, generalized
across providers by a `(provider, external_event_id)` partial unique
index — the same shape `webhook_events` (Clerk) and
`billing_webhook_events` (Stripe) already established, just
parameterized instead of one dedicated table per integration.

**Slack is the one real, signature-verified inbound adapter**
(`src/app/api/webhooks/integrations/slack/route.ts`,
`src/lib/integrations/slack-signature.ts`) — implements Slack's actual
"v0" request-signing scheme (`HMAC-SHA256` over `v0:{timestamp}:{raw
body}`, keyed by `SLACK_SIGNING_SECRET`) plus the 5-minute replay
window Slack's own docs specify, and handles the one-time
`url_verification` handshake Slack's Events API requires before it
will deliver anything else.

**Event-to-workflow mapping is a deliberate, documented gap**: every
verified, deduped Slack event is logged with its type
(`inbound_webhook_events.event_type`), but there is no configuration
UI yet letting an admin say "a Slack `app_mention` event should start
Workflow X" or similar. Building that safely (validating the target
workflow exists, is published, and the mapping doesn't let an
unauthenticated Slack payload trigger an arbitrarily-privileged
action) is its own feature, not attempted as a half-built stub here.

## Integration catalog

`src/lib/integrations/registry.ts` lists all 7 requested providers.
**Slack is the only implemented (`OAuth2`-connectable) adapter**
(`src/lib/integrations/providers/slack-provider.ts`) — OAuth v2
authorize/exchange against Slack's real Web API endpoints, plus
`auth.test` as the connection-health check
(`verifyConnection()`). The other six (Microsoft Teams, Microsoft 365,
Google Workspace, Jira, ServiceNow, Zapier) are registered via
`NotImplementedProvider` — they appear in `/app/integrations` labeled
"not yet available to connect," and every one of their adapter methods
throws rather than pretending to succeed, per the explicit "no fake
successful connections" requirement.

OAuth connections use a self-contained, HMAC-signed `state` parameter
(`src/lib/integrations/oauth-state.ts`) rather than server-side session
storage — a serverless route handler can't reliably share in-memory
state between the authorize redirect and the callback request. The
state binds the initiating organization and provider and expires after
10 minutes, giving the CSRF-protection property an OAuth `state`
parameter exists for without needing a database row.

## Credential encryption

`src/lib/crypto/secret-box.ts` — AES-256-GCM, keyed by
`INTEGRATION_ENCRYPTION_KEY` (base64, 32 bytes), server-only, never
committed. Encrypts: `integration_connections.encrypted_credentials`
(OAuth tokens / API keys for third-party providers) and
`webhook_subscriptions.encrypted_secret` (the HMAC signing secret).
Ciphertext format is `base64(iv).base64(authTag).base64(ciphertext)` —
three dot-separated fields, so a truncated/malformed value fails fast
rather than decrypting to garbage. **No real
`INTEGRATION_ENCRYPTION_KEY` is configured in this environment** — see
environment-variables.md; every connect/create-subscription action
checks `isEncryptionConfigured()` first and fails with a clear
"not configured" `AppError` rather than attempting to encrypt with an
absent key.

## Security

- **Cross-tenant isolation** — every table added in this pass carries
  `organization_id` and RLS gated on `integration.manage`, per
  [multi-tenancy.md](multi-tenancy.md); `webhook_deliveries`/
  `api_key_usage_log`/`inbound_webhook_events` are select-only for the
  `authenticated` role (written exclusively by the admin client from
  job handlers/webhook routes), mirroring `webhook_events`/
  `billing_webhook_events`'s established pattern.
- **Server-side authorization only** — API-key scope and RLS are both
  checked server-side on every request; there is no UI-only gate
  anywhere in this surface.
- **Redirect/callback validation** — the OAuth callback route only
  accepts a `state` it can verify was issued by this application for
  the calling organization and provider, within the last 10 minutes.
- **SSRF** — see the outbound-webhooks section above.
- **Replay protection** — inbound Slack requests are rejected outside a
  5-minute clock-skew window in addition to the (provider, event id)
  idempotency dedupe; outbound and inbound webhook signature
  verification both use `timingSafeEqual` (not `===`) to avoid a
  timing side-channel on the comparison.
- **Injection / excessive payloads** — every SQL statement in this
  surface uses the same tagged-template parameterization as the rest
  of the codebase (no string concatenation into SQL); request bodies
  are read once via `request.text()`/`request.json()` with no explicit
  size cap added in this pass — see known gaps.
- **Secret redaction** — no route or job handler in this surface ever
  logs a raw API key, OAuth token, or webhook secret; `console.error`
  calls throughout log only error messages/status codes.

## Local testing with mocks

Every unit test in this surface (`*.test.ts` alongside each service/
route) mocks the actual third-party call — `fetch` for Slack's Web
API and for outbound webhook delivery, `@clerk/nextjs/server`'s
`clerkClient` is not involved here (that's the SSO section's
concern) — so the full suite runs with zero network access and zero
real credentials. `npm test` is sufficient to exercise this entire
surface locally; no separate mock server or fixture service is
required.

## Production verification steps (unresolved live-provider dependencies)

None of the following has been exercised against a real external
system in this environment:

1. **Slack OAuth connect** — requires real `SLACK_CLIENT_ID`/
   `SLACK_CLIENT_SECRET` and a Slack app configured with the
   `/api/integrations/oauth/slack/callback` redirect URI.
2. **Slack inbound events** — requires a real `SLACK_SIGNING_SECRET`
   and a Slack app's Event Subscriptions pointed at
   `/api/webhooks/integrations/slack`.
3. **Outbound webhook delivery** — requires a real receiving endpoint;
   verify signature validation against `X-ProcessPilot-Signature`
   using the secret shown at subscription creation.
4. **The public API** — requires a real, created `api_keys` row (this
   works today without any external credential — only
   `INTEGRATION_ENCRYPTION_KEY` is unrelated to it — but has not been
   exercised against a live Supabase-backed environment, same
   "no Supabase project provisioned yet" caveat every other phase
   carries, see current-project-status.md).

## Known gaps

- **Only Slack is a real adapter** — the other six catalog entries are
  intentionally unimplemented placeholders (see above).
- **Only two public-API endpoints** (`processes`, `workflows`),
  read-only.
- **No generated OpenAPI spec file** — this document's endpoint table
  is hand-maintained, not machine-validated against the actual route
  handlers.
- **Only `workflow.completed` is wired as an outbound trigger** — the
  other five defined event types have no call site yet.
- **No event-to-workflow mapping configuration** for inbound events.
- **No webhook secret "rotate" action** — delete + recreate the
  subscription achieves the same effect today.
- **SSRF guard is a literal-IP check, not DNS-rebinding-proof** — a
  hostname could resolve to a private address after the check passes
  and before a later retry actually connects; a hardened version would
  resolve-and-pin the IP at delivery time, not just at subscription
  creation.
- **No explicit request-body size cap** on inbound routes beyond
  whatever the platform (Vercel) itself enforces.
- **`INTEGRATION_ENCRYPTION_KEY` is unconfigured in this environment**
  — every credential-storing action fails safely with a clear
  "not configured" error rather than attempting it.

## Related documents

- [Integration architecture](integration-architecture.md) — the SSO/SAML half of this phase
- [Multi-tenancy](multi-tenancy.md)
- [Event model](event-model.md)
- [ADR-0009: Provider-neutral background jobs](decisions/0009-provider-neutral-background-jobs.md)

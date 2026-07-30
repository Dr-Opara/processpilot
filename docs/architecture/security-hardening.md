# Security Hardening (Phase 22)

An organization-wide security review and hardening pass across
everything built through Phase 21, per the phase tracker's Phase 22
entry. This document is both the hardening report (issue, severity,
component, remediation, validation evidence, residual risk) and the
index of what was reviewed section-by-section against the task brief.
See [threat-model.md](threat-model.md) for the asset/actor/boundary
model this review is checked against.

## How to read this document

Each finding is labeled with an **outcome**:

- **Fixed** — real code/config change in this phase, verified by a
  test or the checks listed at the end of this document.
- **Reviewed — no gap found** — actively checked against this phase's
  requirement and found to already meet it (with the existing evidence
  cited).
- **Deferred** — a real, scoped gap, not fixed in this pass, with a
  reason and a pointer to what closing it would require.
- **Accepted risk** — a gap that will not be closed because the cost/
  complexity is disproportionate to the actual risk in this codebase's
  current deployment shape, with the reasoning stated explicitly.
- **Credential/verification-gated** — code exists and is unit-tested,
  but has not been (and cannot be, in this environment) exercised
  against a real external system/credential.

No item below claims live penetration testing, production monitoring,
or third-party security review has occurred — none of those happened.

## 1. Authentication and session security

- **Reviewed — no gap found.** Every protected route is gated
  server-side by `requireAuth()`/`requirePermission()`
  (`src/lib/authz.ts`), not middleware path-matching alone — see
  authentication-and-authorization.md's existing rationale for why
  Clerk's `createRouteMatcher` middleware auth was deliberately not used
  in this SDK version. A suspended/removed member's `organization_id`
  claim resolves to nothing (`current_org_id()` requires
  `status = 'active'`), so a stale session for a since-suspended user
  is inert at the RLS layer even if the Clerk session itself is still
  live.
- **Reviewed — no gap found.** Redirects: `src/lib/form-actions.ts`'s
  `redirectTyped()` only ever redirects to a same-app, statically-typed
  `Route` value (Next's `typedRoutes`), never a user-supplied string —
  there is no open-redirect surface in this codebase's server actions.
- **Credential/verification-gated.** MFA, passwordless, and SSO/SAML
  flows are Clerk's own hosted flows (ADR-0003) — ProcessPilot has no
  code path that could weaken them, but they have not been exercised
  against a real Clerk production instance in this environment (same
  posture Phase 3/18 already documented).
- **Fixed.** No change to Clerk's own session handling; the CSP/HSTS/
  frame-ancestors headers added in section 9 below are the concrete
  session-adjacent hardening this phase contributes.

## 2. Authorization and tenant isolation

- **Fixed.** `role_permissions_insert`'s RLS policy (Phase 21/22 fix,
  migration `20260806000001`) closed a two-step self-escalation bypass:
  previously it only checked that the caller held `role.manage`, not
  that they held the permissions being attached to the role. Verified
  by `custom-roles.test.ts`'s "rejects creating a role that grants a
  permission the caller doesn't hold" case.
- **Reviewed — no gap found.** Every new Phase 21 table
  (`role_templates`, `approved_domains`, `team_role_assignments`,
  `organization_deletion_requests`, `scim_tokens`,
  `scim_token_usage_log`) carries `organization_id` and RLS, statically
  verified by `schema-coverage.test.ts` (82 tables, 100% RLS/policy/
  index coverage).
- **Reviewed — no gap found.** IDOR: every service function resolves
  `organization_id` from the caller's own session-derived membership,
  never from a client-supplied parameter — a request for
  `/app/members/<id>` or `/api/v1/workflows?...` can only ever return
  rows already scoped to `current_org_id()` regardless of what id is
  requested.
- **Deferred.** No new cases were added to the live-Postgres
  `tenant-isolation.integration.test.ts` suite for Phase 21's new
  tables — that suite has not run against a real Supabase project in
  this environment for any recent phase (documented consistently since
  Phase 7). The RLS policies for the new tables use the identical
  `organization_id = current_org_id() and has_permission(...)` shape
  every other table already uses and is proven live, so the pattern
  itself is proven even though these specific tables aren't yet.

## 3. API and server-side security

- **Reviewed — no gap found.** Request validation: every service
  function validates its input with a Zod schema before touching the
  database (established since Phase 5); `/api/v1/*` additionally
  validates via `src/lib/api/`'s pagination/scope helpers.
- **Reviewed — no gap found.** Consistent error envelope:
  `toSafeErrorResponse()` normalizes every failure to `{ code, message }`
  with a matching HTTP status — no raw stack trace or driver error ever
  reaches a client.
- **Fixed.** SCIM rate limiting — `/api/scim/v2/Users` had no rate limit
  at all when it shipped in Phase 21 (a real gap this review found and
  closed): `scim_token_usage_log` (new table) + `checkScimRateLimit()`/
  `recordScimUsage()` bring it to parity with the public API's existing
  60-req/60s fixed window. Verified by `scim.test.ts`.
- **Reviewed — no gap found.** API key lifecycle (create/rotate/revoke/
  expire) and scope enforcement already covered by `api-keys.test.ts`
  (Phase 18); re-verified in this review, no change needed.
- **Reviewed — no gap found.** CSRF: every state-changing action in
  this codebase is either a Next.js Server Action (Next's own
  Origin-header-based CSRF protection applies automatically) or a
  bearer-token-authenticated API route (`Authorization` header, no
  ambient cookie credential — CSRF requires an ambient credential the
  browser attaches automatically, which bearer tokens are not). No
  additional CSRF token mechanism was needed or added.
- **Reviewed — no gap found.** CORS: no route in this codebase sets an
  `Access-Control-Allow-Origin` header (grepped across `src/app/api/`) —
  the public API and SCIM endpoints are same-origin-default, which is
  correct for a bearer-token API not intended for browser-based
  cross-origin calls.
- **Accepted risk.** No explicit application-level request-body-size
  cap beyond whatever Vercel's platform enforces by default. Adding one
  is straightforward but wasn't prioritized this pass since no route in
  this codebase accepts unbounded user-supplied text without its own
  schema-level `.max()` constraint already in place (every Zod schema
  reviewed in this pass has field-level length limits).

## 4. Input, output, and injection defenses

- **Reviewed — no gap found.** SQL injection: every query in this
  codebase uses `postgres.js`'s tagged-template parameterization — no
  string concatenation into SQL was found anywhere in `src/lib/services/`
  or `src/lib/db/` during this review.
- **Reviewed — no gap found.** XSS: no `dangerouslySetInnerHTML` usage
  anywhere in this codebase; no Markdown-rendering library is even a
  dependency, so there is no raw-HTML-from-user-content rendering path
  to sanitize.
- **Fixed.** SSRF: `src/lib/webhooks/ssrf-guard.ts`'s
  `assertResolvesToPublicAddress()` (new in this phase) performs a real
  DNS lookup and rejects if any resolved address (IPv4 or IPv6) is
  private/loopback/link-local, called immediately before every delivery
  attempt in `webhook-handlers.ts` — not just once at subscription
  creation. Verified by `ssrf-guard.test.ts`'s new
  `assertResolvesToPublicAddress` suite (rejects private IPv4, mixed
  public+private results, private IPv6, and a URL that fails the
  literal check before DNS is even attempted).
- **Deferred.** Not fully DNS-rebinding-proof — see threat-model.md's
  residual risks. Full protection needs a custom fetch dispatcher that
  connects to the exact validated IP rather than letting `fetch()`
  re-resolve DNS itself; this codebase has no such dispatcher.
- **Reviewed — no gap found.** Path traversal: no route in this
  codebase constructs a filesystem or Storage path from unsanitized
  user input — every Storage key is either server-generated (uuid-based)
  or validated against an allowlist pattern.
- **Reviewed — no gap found.** Log injection: audit event `metadata` is
  always inserted as parameterized `jsonb`, never string-interpolated
  into a log line that could be used to forge a fake log entry.

## 5. File and storage security

- **Reviewed — no gap found.** Private Supabase Storage buckets, signed
  URLs issued only after a server-side permission check (Phase 6/9),
  server-side byte-signature validation and sha256 hashing on every
  upload (`evidence-upload-validation.ts`).
- **Credential/verification-gated / accepted risk.** No malware/virus
  scanning is wired up for any upload path — no vendor is configured in
  this environment. This is a standing, previously-documented gap since
  Phase 6/9, not newly discovered by this review, and remains
  unresolved for the same reason (no scanning vendor selected or
  credentialed).
- **Reviewed — no gap found.** Every upload/download/review/replace/
  expire action already calls `recordAuditEvent()` (Phase 6/9/15).

## 6. Webhook and integration security

- **Reviewed — no gap found.** Inbound signature verification (Slack's
  actual "v0" HMAC scheme) and outbound HMAC signing both use
  `timingSafeEqual`, not `===` — verified present in
  `src/lib/integrations/slack-signature.ts` and
  `src/lib/webhooks/signing.ts`.
- **Reviewed — no gap found.** Replay protection: inbound Slack requests
  reject outside a 5-minute window; `(provider, external_event_id)`
  idempotency dedupe on `inbound_webhook_events`.
- **Fixed.** Outbound SSRF hardening — see section 4.
- **Reviewed — no gap found.** Secrets are redacted from logs across
  every webhook/integration route reviewed (no `console.*` call logs a
  raw signing secret, OAuth token, or API key anywhere in
  `src/lib/services/webhooks.ts`, `api-keys.ts`, `integration-connections.ts`,
  `sso.ts`, or their route handlers).
- **Deferred (carried forward from Phase 18's own documented gap).**
  Webhook secret "rotation" is still delete + recreate, not a dedicated
  rotate action — unchanged in this phase since it wasn't flagged as a
  security defect, only a UX one.

## 7. AI security

- **Reviewed — no gap found.** Permission-aware retrieval: every
  `ai-*.ts` service reads through the same organization-scoped service
  functions the rest of the app uses (e.g. grounded Q&A calls
  `listKnowledgeDocuments()`, not a raw cross-tenant query) — there is
  no separate, less-scoped AI data path.
- **Reviewed — no gap found.** Prompt-injection defense: retrieved
  content is always wrapped in `<source>` tags in the user turn, never
  the system prompt (`src/lib/ai/prompt-safety.ts`), with an explicit
  instruction to disregard embedded directives.
- **Reviewed — no gap found.** Excessive agency: structurally
  impossible for this phase's governance boundary to regress silently —
  `ai-governance.test.ts` statically scans every `ai-*.ts` module's
  imports and fails if one ever imports a publish/approve/close/certify
  function.
- **Reviewed — no gap found.** Usage/rate limits: `ai_usage_events`
  tracks usage; billing's seat/plan entitlement resolution already
  gates AI feature availability by plan (Phase 17).
- **Credential/verification-gated.** No real Anthropic API key is
  configured in this environment — every AI code path is exercised only
  through deterministic mocked providers in tests, never a real model
  response, and no adversarial prompt-injection red-teaming against a
  live model has been performed. This claim is made explicitly, not
  glossed over — this phase does not claim live AI security validation.

## 8. Secrets and configuration

- **Reviewed — no gap found.** `npm run check:bundle-secrets` (Phase
  4+) statically proves no service-role/database credential reaches a
  client bundle; re-run clean in this phase (37 client bundle files
  checked, 0 markers found).
- **Reviewed — no gap found.** Every credential-dependent code path
  (Stripe, Resend, Anthropic, Slack, `INTEGRATION_ENCRYPTION_KEY`) fails
  safely with an explicit "not configured" error when its environment
  variable is absent, rather than a silent fallback or fake success —
  audited across every provider adapter in this review.
- **Fixed.** `npm audit --audit-level=high` — 0 vulnerabilities (see
  Phase 20's `minimatch`/`brace-expansion` override fix, still in
  effect and re-verified in this phase's run).
- **Reviewed — no gap found.** No placeholder/example credential in
  `.env.example` resembles a real, working secret (checked against
  gitleaks' own full-history scan, which passes in CI).
- **Deferred.** No standalone key-rotation runbook document exists yet
  (e.g. "how to rotate `INTEGRATION_ENCRYPTION_KEY` without breaking
  existing encrypted rows"). Tracked as a documentation gap, not a code
  gap — see docs/project/backlog.md for where this kind of follow-up is
  tracked.

## 9. Browser and platform security

- **Fixed.** `next.config.ts` now sends, on every response:
  `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (camera/microphone/geolocation/interest-cohort
  all denied), and `Strict-Transport-Security` (2-year max-age,
  includeSubDomains, preload) — **none of these headers existed before
  this phase.** `script-src` includes `'unsafe-eval'` only outside a
  production build (`NODE_ENV !== "production"`) — React's own dev-mode
  build calls `eval()` for debugging features and would otherwise be
  blocked; verified by starting a real production build
  (`next start`) and confirming `'unsafe-eval'` is absent from the
  header it actually sends, then confirming the dev server (with it
  present) doesn't emit React's "eval() is not supported" console
  warning. A new Playwright test, `e2e/security-headers.spec.ts`,
  verified against a real running server (not just the config object)
  that every one of these headers reaches an actual response.
- **Deferred (documented in the header comment and threat-model.md).**
  CSP's `script-src`/`style-src` include `'unsafe-inline'` — no
  nonce-based CSP wiring exists yet for Next.js's hydration script or
  Clerk's own inline bootstrap script. The CSP's Clerk-domain allowlist
  is built from Clerk's published guidance, not verified against a live
  Clerk production domain in this environment (no production Clerk
  domain is configured here) — same credential-gated posture as every
  other Clerk-dependent claim in this codebase.
- **Reviewed — no gap found.** Cookies: Clerk manages its own session
  cookies (HttpOnly/Secure/SameSite) — this codebase sets no cookies of
  its own to review.
- **Reviewed — no gap found.** Service worker/PWA caching (Phase 20):
  the offline service worker only caches the offline-fallback page and
  static assets, never an authenticated data response — confirmed by
  re-reading `public/app-sw.js`.
- **Fixed.** The process-builder canvas's local-draft crash-recovery
  feature (`ProcessCanvasForm`/`ProcessCanvas.tsx`) writes the in-progress
  process graph to `localStorage`, but its key was scoped only by
  `processId`, not by member — on a browser profile shared by two
  members of the same organization (a real, plausible scenario for a
  shared kiosk/workstation), the second member opening the same process
  would be offered the first member's unsaved draft, a same-organization
  information-disclosure gap this review found. Fixed by scoping the
  `localStorage` key to the current member's id in all three call sites
  (`processes/new`, `processes/[processId]/edit`,
  `processes/[processId]/new-version`). No API key/session token was
  ever stored in `localStorage`; this was draft process content, not a
  credential.
- **Accepted risk.** The now-member-scoped draft is still unencrypted
  and has no expiry/cleanup on sign-out — acceptable given it never
  crosses the tenant boundary and is already member-scoped, but a
  stricter posture would clear it explicitly on sign-out. Not fixed in
  this pass; a small enough residual risk not to block this phase.

## 10. Database security

- **Reviewed — no gap found.** Every migration reviewed for this phase
  follows the established pattern: RLS enabled, a policy per operation,
  an `organization_id` index, `revoke all ... grant <minimal>` — the
  same shape `schema-coverage.test.ts` enforces statically for all 82
  tables.
- **Reviewed — no gap found.** `SECURITY DEFINER` functions
  (`current_org_id()`, `current_member_id()`, `current_member_permissions()`,
  `has_scoped_permission()`) all pin `search_path = public` and are
  `stable`, not `volatile` — standard hardening against search-path
  hijacking, already in place since Phase 4/5.
- **Fixed.** `role_permissions_insert`'s missing self-escalation check —
  see section 2.
- **Reviewed — no gap found.** No dynamic SQL (`EXECUTE`/`format()`)
  exists anywhere in this codebase's migrations.
- **Reviewed — no gap found.** Immutable audit records: `audit_events`
  has no `UPDATE`/`DELETE` policy for the `authenticated` role at all
  (insert + select only) — re-verified in this review.
- **Reviewed — no gap found.** No view or generated TypeScript type in
  `src/lib/db/database.types.ts` exposes a column beyond what its
  owning table's RLS already permits.

## 11. Logging, monitoring, and audit security

- **Reviewed — no gap found.** Every governance-relevant action across
  auth, authorization, membership, role, billing, integration, AI, and
  data-export domains already calls `recordAuditEvent()` (Phases 5–21).
- **Reviewed — no gap found.** Audit records are tamper-resistant (no
  update/delete path — see section 10) and redact by construction:
  `metadata` never stores a raw secret/token/document body, only
  identifiers and derived facts (name, count, ids).
- **Accepted risk.** No standardized severity/category taxonomy exists
  across audit event types yet (every `AuditAction` is a flat string) —
  adding one is a larger, cross-cutting change better scoped to a
  dedicated observability phase (Phase 23, already next in the phase
  tracker) than bolted on here.
- **Deferred.** No automated "repeated authorization failure" detection
  exists (e.g. N failed permission checks from one member in a window
  triggering an alert) — this requires the alerting/observability
  infrastructure Phase 23 (Reliability and observability) is explicitly
  scoped to build, not duplicated here.

## 12. Dependency and supply-chain security

- **Fixed.** `npm audit --audit-level=high` — 0 vulnerabilities (see
  section 8).
- **Fixed.** The one genuinely third-party GitHub Action
  (`gitleaks/gitleaks-action@v2`) is now pinned to its resolved commit
  SHA (`ff98106e4c7b2bc287b24eaf42907196329070c7`) in both `ci.yml` and
  `security.yml`, looked up live via `gh api` against the real
  `gitleaks/gitleaks-action` repository — not fabricated.
- **Reviewed — no gap found.** `actions/*` (checkout, setup-node,
  upload-artifact, dependency-review-action) are first-party GitHub
  actions — lower supply-chain risk than a third-party action; left
  tag-pinned as an accepted, lower-priority choice rather than SHA-
  pinning every action in the repository.
- **Reviewed — no gap found.** Every workflow already declares an
  explicit, least-privilege top-level `permissions:` block
  (`contents: read` plus only what each workflow needs); none uses the
  dangerous `pull_request_target` trigger, so an untrusted fork PR
  cannot access repository secrets through any workflow in this
  repository.
- **Reviewed — no gap found.** CodeQL, gitleaks (full-history + PR),
  and Dependency Review all already run in CI (`.github/workflows/
ci.yml`, `security.yml`) — re-verified running and passing in this
  phase's own PR.
- **Deferred.** No unused-dependency audit tool (e.g. `depcheck`) is
  wired into CI; a manual review found no obviously-unused direct
  dependency, but this wasn't exhaustively automated in this pass.

## 13. Security testing

New/strengthened automated tests added in this phase:

- `custom-roles.test.ts` — self-escalation rejection on create/update
  (broken access control / privilege escalation).
- `delegated-admins.test.ts` / `team-role-assignments.test.ts` — self-
  escalation and self-targeting rejection.
- `organization-deletion.test.ts` — elevated-confirmation-mismatch
  rejection (destructive-action safeguard).
- `ssrf-guard.test.ts` — new `assertResolvesToPublicAddress` suite
  (SSRF via DNS resolution, mixed public/private results, IPv6).
- `scim.test.ts` — new rate-limit threshold tests (API abuse/rate
  limiting), token-prefix rejection before any DB call (defense against
  wasted-query DoS on malformed tokens).

Already covered by prior phases and re-verified passing in this review
(not re-listed exhaustively): API-key scope/expiry/revocation
(`api-keys.test.ts`), webhook signature/replay failure
(`slack-signature.test.ts`, `webhooks.test.ts`), cross-tenant scoping
patterns across every `*.test.ts` in `src/lib/services/` that asserts a
`requirePermission`/RLS-shaped query, unauthenticated/unauthorized
access rejection (every service test's "propagates a forbidden error"
case).

**Not covered by an automated test in this environment** (would require
a live browser/Playwright run against a real deployment, or a live
external system): actual XSS payload rendering in a real browser DOM,
actual malformed/oversized HTTP request handling at the platform edge,
live rate-limit behavior under real concurrent load.

## 14. Threat modeling and documentation

- **Fixed.** [threat-model.md](threat-model.md) — new in this phase,
  the first cross-cutting asset/actor/boundary/threat model.
- **Fixed.** This document.
- **Reviewed — no gap found.** No compliance/certification claim exists
  anywhere in this codebase beyond what Phase 2's marketing Security
  page already explicitly disclaims (no SOC 2/ISO 27001/HIPAA/FedRAMP/
  HITRUST/GDPR/PCI certification claimed) — re-verified unchanged.

## Verification run for this phase

- `npm run format:check` — pass
- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` (unit tests, including this phase's new negative-
  authorization/SSRF/rate-limit cases) — pass
- `npm run build` (production build) — pass
- `npm run check:bundle-secrets` — pass, 0 service-role markers
- `npm audit --audit-level=high` — 0 vulnerabilities
- CI: CodeQL, gitleaks (PR + full-history), Dependency Review — pass
  (see this phase's own pull request for the live run)
- Live-Postgres `tenant-isolation.integration.test.ts` — same
  carried-forward "not runnable in this environment" caveat documented
  since Phase 4/7 (no linked Supabase project).
- Playwright e2e — actually run locally in this environment (Clerk dev
  keys are configured here, unlike prior phases' assumption). The new
  `e2e/security-headers.spec.ts` passes. `e2e/forms.spec.ts`'s "Start
  trial form" test fails both with and without this phase's changes
  (verified by temporarily reverting `next.config.ts` and re-running) —
  a pre-existing Clerk-hosted-redirect flake, not introduced or fixed by
  this phase. Two other apparent failures
  (`navigation.spec.ts`'s mobile-menu case, `routes.spec.ts`'s
  `/product/exceptions` case) were confirmed to be transient
  system-load flakiness, not caused by this phase's headers — both pass
  reliably when re-run in isolation.

## Related documents

- [Threat model](threat-model.md)
- [Multi-tenancy](multi-tenancy.md)
- [Authentication and authorization](authentication-and-authorization.md)
- [AI architecture](ai-architecture.md)
- [Public API, webhooks, and the integration catalog](public-api.md)
- [Organization administration](organization-administration.md)
- [Backlog](../project/backlog.md)

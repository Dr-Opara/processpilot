# Threat Model (Phase 22)

The first end-to-end threat model of ProcessPilot as actually built —
prior phases documented security decisions locally (per-feature "Security"
sections in each `docs/architecture/*.md` file); this document is the
first cross-cutting pass tying those decisions to assets, trust
boundaries, actors, and residual risk. See
[security-hardening.md](security-hardening.md) for the Phase 22
remediation report this threat model informed.

## Assets

| Asset                                                                                            | Sensitivity                                | Where                                                               |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------- |
| Organization/tenant data (processes, workflows, knowledge, exceptions, training, evidence files) | High — customer confidential               | Supabase Postgres, private Storage buckets                          |
| Member identity and role/permission assignments                                                  | High — governs all other access            | `organization_members`, `roles`, `member_role_assignments`          |
| Audit event log                                                                                  | High — must be tamper-evident              | `audit_events` (immutable, Phase 15)                                |
| Third-party credentials (OAuth tokens, webhook secrets, API keys, SCIM tokens)                   | Critical                                   | Encrypted (`secret-box.ts`) or hash-only (`api_keys`/`scim_tokens`) |
| AI provider key, database URL, encryption key, Stripe/Resend/Slack secrets                       | Critical                                   | Environment variables only, never committed                         |
| Evidence/knowledge document file contents                                                        | High — may include PII, compliance records | Private Supabase Storage, signed URLs                               |

## Actors

| Actor                                                                     | Trust level                                                                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Authenticated organization member (7 system roles, product/user-roles.md) | Trusted within their own organization and role/scope                                            |
| `external_user` (Phase 19)                                                | Least-trusted authenticated actor — resource-scoped to exactly one invited task                 |
| Organization admin/owner                                                  | Trusted, but bounded by permissions-matrix.md rule 5 (cannot self-escalate via custom roles)    |
| Third-party webhook sender (Slack, Stripe, Clerk)                         | Untrusted until signature-verified                                                              |
| Public API / SCIM caller                                                  | Untrusted until bearer-token-verified; acts with its creator's real, currently-held permissions |
| ProcessPilot's own AI provider (Anthropic)                                | Untrusted output source — never a privileged actor, see "AI" below                              |
| Anonymous internet requester                                              | Untrusted — every non-marketing route requires authentication or a verified token               |

## Trust boundaries

1. **Browser ↔ Next.js server** — the primary boundary; every server
   action/route handler re-authenticates and re-authorizes, never trusts
   client-supplied role/permission claims (docs/architecture/
   authentication-and-authorization.md).
2. **ProcessPilot ↔ Clerk** — identity and session management are
   entirely delegated (ADR-0003); ProcessPilot never stores a password
   or session token itself.
3. **ProcessPilot ↔ Supabase Postgres** — RLS is defense-in-depth behind
   application-layer authorization, not a substitute for it
   (multi-tenancy.md).
4. **ProcessPilot ↔ third-party webhook senders** — inbound (Slack,
   Stripe, Clerk) and outbound (organization-configured subscriptions)
   both cross this boundary; every inbound sender is signature-verified,
   every outbound destination is SSRF-guarded (see below).
5. **ProcessPilot ↔ AI provider** — a one-way boundary for retrieval
   (only already-permission-filtered content is sent) and a hard
   boundary on the way back (model output can never itself invoke a
   privileged action — see "AI" below).
6. **Organization ↔ organization** — the tenant-isolation boundary,
   enforced at both the application-query layer (every query scopes by
   `organization_id`) and the database layer (RLS on every tenant-owned
   table, statically verified by `schema-coverage.test.ts`).

## Entry points

- Marketing site (`/`, public, unauthenticated) — request-demo/start-trial forms, no persistence.
- Authenticated app (`/app/*`) — every route gated by `requireAuth()`/`requirePermission()`.
- Public REST API (`/api/v1/*`) — API-key bearer auth, scoped, rate-limited.
- SCIM (`/api/scim/v2/*`) — SCIM-token bearer auth, rate-limited (Phase 22).
- Inbound webhooks (`/api/webhooks/*`) — signature-verified, idempotent, replay-protected.
- Outbound webhooks (organization-configured URLs) — SSRF-guarded at creation and delivery time (Phase 22).
- Background jobs (`/api/jobs/process`, Vercel Cron) — `CRON_SECRET`-gated, runs as trusted system code via the admin client.

## Threats and controls (STRIDE-flavored, mapped to OWASP/NIST where useful)

| Threat                                                    | Control                                                                                                                                                                                                        | OWASP / NIST mapping                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Spoofing a session / stale or suspended user acting       | Clerk session verification on every request; `organization_members.status` re-checked server-side on every RLS evaluation (`current_org_id()`); a suspended/removed member's claims resolve to no organization | OWASP A07 (Identification and Authentication Failures)    |
| Tampering with another organization's data (cross-tenant) | RLS on every tenant-owned table + application-layer `organization_id` scoping (defense-in-depth, multi-tenancy.md)                                                                                             | OWASP A01 (Broken Access Control)                         |
| Repudiation of a privileged action                        | Immutable `audit_events` (Phase 15), one row per governance-relevant action, `recordAuditEvent()` called from the same transaction as the action                                                               | NIST AU-2/AU-3                                            |
| Information disclosure via cross-tenant IDOR              | Every service function re-derives the caller's `organization_id` from their session, never trusts a client-supplied org/tenant id; ownership/scope checked in the same query                                   | OWASP A01, API1:2023 (Broken Object Level Authorization)  |
| Information disclosure via error messages                 | `toSafeErrorResponse()` (`src/lib/errors.ts`) — every route returns a normalized `{ code, message }`, never a raw driver/stack trace                                                                           | OWASP A05 (Security Misconfiguration)                     |
| Denial of service via oversized/malicious payload         | `brace-expansion` DoS patched (Phase 20); public API and SCIM rate-limited (60 req/60s); Vercel platform request-size limits apply beyond that (no additional app-level cap — see known gaps)                  | OWASP A05, API4:2023                                      |
| Elevation of privilege via custom role definition         | Fixed in Phase 21/22: `role_permissions_insert` RLS + application-layer check both enforce "grant only what you hold"                                                                                          | permissions-matrix.md rule 5, OWASP A01                   |
| Elevation of privilege via self-role-change               | `changeMemberRole()`/`suspendMember()`/`removeMember()` reject acting on one's own membership                                                                                                                  | OWASP A01                                                 |
| SSRF via an admin-configured outbound webhook URL         | Literal-IP check at creation + real DNS-resolution check at every delivery attempt (Phase 22)                                                                                                                  | OWASP A10 (SSRF), API7:2023                               |
| Forged inbound webhook event                              | HMAC signature verification with `timingSafeEqual`, replay-window rejection, `(provider, external_event_id)` idempotency                                                                                       | OWASP A08 (Software and Data Integrity Failures)          |
| Prompt injection via retrieved organizational content     | Retrieved content is always fenced as `<source>` data in the user turn, never the system prompt; system prompt explicitly instructs the model to ignore embedded instructions                                  | OWASP LLM01 (Prompt Injection)                            |
| AI output taking an unreviewed privileged action          | Structural: no `ai-*.ts` service imports a publish/approve/close/certify function at all — enforced by a static import-scan test (`ai-governance.test.ts`)                                                     | OWASP LLM06 (Excessive Agency)                            |
| Credential leakage in logs                                | No `console.*` call in this codebase logs a raw API key/OAuth token/webhook secret/SCIM token (spot-checked across every credential-issuing service in this review)                                            | OWASP A09 (Security Logging and Monitoring Failures)      |
| Supply-chain compromise via a GitHub Action               | CodeQL, gitleaks, `npm audit`, and Dependency Review all run in CI; the one genuinely third-party action (`gitleaks-action`) is now SHA-pinned (Phase 22)                                                      | NIST SR-3, OWASP A06 (Vulnerable and Outdated Components) |
| Malicious file upload (evidence/knowledge documents)      | Server-side byte-signature validation + sha256 hashing (`evidence-upload-validation.ts`, Phase 6/9)                                                                                                            | OWASP A08                                                 |

## Residual risks (accepted or deferred, not fixed in this pass)

See [security-hardening.md](security-hardening.md)'s findings table for
the full list with severity and remediation status. Highlights:

- **No malware/virus scanning** on uploaded files — no vendor is
  configured in this environment; documented as a standing gap since
  Phase 6, not newly discovered.
- **SSRF is not fully DNS-rebinding-proof** — the delivery-time DNS
  check (Phase 22) closes the practical gap but doesn't pin the
  validated IP for the actual TCP/TLS connection, which would require a
  custom fetch dispatcher this codebase doesn't have.
- **Content-Security-Policy uses `'unsafe-inline'` for scripts** — no
  nonce-based CSP wiring exists yet; tracked as a follow-up, not a
  silent gap.
- **No application-level request body size cap** on most routes beyond
  Vercel's platform default.
- **SCIM, custom-role, and organization-deletion surfaces are new in
  Phase 21/22** — real, unit-tested, but not yet exercised against a
  live Supabase project or a real SCIM identity-provider client, same
  "credential/verification-gated" posture as every other phase.

## Related documents

- [Security hardening report (Phase 22)](security-hardening.md)
- [Multi-tenancy](multi-tenancy.md)
- [Authentication and authorization](authentication-and-authorization.md)
- [AI architecture](ai-architecture.md)
- [Organization administration](organization-administration.md)
- [Public API, webhooks, and the integration catalog](public-api.md)

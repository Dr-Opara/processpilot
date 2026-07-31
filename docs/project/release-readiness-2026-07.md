# Phase 30 — Product and Corporate Release Readiness (2026-07)

Per [phase-tracker.md's Phase 30 entry](phase-tracker.md#phase-30-product-and-corporate-release-readiness),
this report issues two separate verdicts: **product readiness** (the
SaaS application) and **corporate-website readiness** (Phase 31/31A).
The product verdict does not wait on the corporate-website verdict, and
vice versa — they are independent tracks by design.

## Corporate-website readiness: not applicable yet

Phase 31 (Corporate Product and Services Website) and Phase 31A
(Independent Client Engagements) have not been built. There is nothing
to classify or issue a verdict on. This section will be completed when
those phases ship — see
[phase-tracker.md's Phase 31/31A entries](phase-tracker.md#phase-31-corporate-product-and-services-website).

## Product readiness

### Capability classification

Legend: **Production Verified** (exercised against a real external
system in this environment) · **Credential-Gated** (real code, fails
safe, but no real credential/account exists here to verify against) ·
**Staging-Only** (verified against a live-but-non-production
environment, e.g. a Vercel preview) · **Mocked** (tested only against
deterministic fakes) · **Deferred** (a known, explicitly scoped gap —
see the cited phase's own "Known gaps") · **Blocked** (cannot be
completed in this environment at all, requires an account/purchase/
credential nobody has supplied) · **Not Implemented**.

| Capability                                                           | Status                                | Detail                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core loop (onboarding → knowledge → process → workflow → task)       | Staging-Only                          | Fully built, unit-tested, and Playwright-smoke-tested against Vercel previews on every phase's PR. Never run against a real production Supabase/Clerk pair.                                                                                                                                 |
| Database schema, RLS, tenant isolation                               | Mocked (statically verified)          | 85 tables, 100% RLS/policy/index coverage per `schema-coverage.test.ts` — a static check, not a live-database proof. `tenant-isolation.integration.test.ts` exists but has never run against a real Postgres instance in this environment (true since Phase 4, unchanged through Phase 29). |
| AI copilot                                                           | Credential-Gated                      | Provider-neutral adapter (Phase 13), governed by a statically-verified read-only import boundary. No real `ANTHROPIC_API_KEY` exists here — live Claude output is unverified.                                                                                                               |
| Email delivery                                                       | Credential-Gated                      | Provider-neutral adapter (Phase 16). No real `EMAIL_PROVIDER_API_KEY`/verified sending domain exists — live Resend delivery is unverified.                                                                                                                                                  |
| Billing (Stripe)                                                     | Credential-Gated, pricing uncommitted | Adapter is real (Phase 17); no real Stripe account/price catalog exists. Pricing itself is still hypothesis-stage per `product/pricing-hypotheses.md`.                                                                                                                                      |
| SSO/SAML/OIDC                                                        | Credential-Gated                      | Thin wrapper over Clerk Enterprise Connections (Phase 18); never exercised against a real Clerk Enterprise-Connections-enabled organization.                                                                                                                                                |
| Outbound webhooks / public API                                       | Mocked                                | Real HMAC signing/retry/SSRF-guard logic (Phase 18 continuation), covered by unit tests; no real third-party webhook consumer has ever received a delivery.                                                                                                                                 |
| Slack integration                                                    | Credential-Gated                      | One real OAuth/Events-API adapter (Phase 18); no real Slack app/credentials exist.                                                                                                                                                                                                          |
| External portal (`external_user`)                                    | Mocked                                | Scoped-access model built and unit-tested (Phase 19); privilege-escalation coverage is unit-test-level only, same live-Postgres caveat as tenant isolation generally.                                                                                                                       |
| Responsive layout / installable PWA                                  | Staging-Only                          | Built and Playwright-tested (Phase 20) against Vercel previews; no real mobile-device/Lighthouse audit has been performed in this environment.                                                                                                                                              |
| Organization administration depth (custom roles, SCIM, etc.)         | Mocked                                | SCIM is real but never validated against a real IdP (Phase 21); domain verification is genuinely live (real DNS `resolveTxt`).                                                                                                                                                              |
| Security hardening (CSP/headers/SSRF guard)                          | Staging-Only                          | Headers verified against a real running server (`e2e/security-headers.spec.ts`) on every Vercel preview.                                                                                                                                                                                    |
| Reliability/observability (health checks, logging, error reporting)  | Credential-Gated (error reporting)    | Health/readiness endpoints are real and pollable. `Sentry`-shaped error-reporting adapter exists but no DSN is configured — falls back to console reporting.                                                                                                                                |
| Legal/privacy/trust documents                                        | Deferred (attorney review)            | Content is accurate to the shipped product and explicitly labeled draft/not-yet-reviewed (Phase 25) — no attorney has reviewed any document.                                                                                                                                                |
| Production infrastructure (Vercel/Supabase/Clerk prod, DNS, backups) | Blocked                               | No production account of any kind has been provisioned in this environment — this is Phase 26's own, still-unmet exit criterion.                                                                                                                                                            |
| Internal support / platform administration                           | Mocked                                | Environment-variable-allowlist authorization model (Phase 27), fully unit-tested; never exercised by a real support engineer against a real customer organization.                                                                                                                          |
| Production-safe demo workspace                                       | Mocked                                | Built and unit-tested (Phase 28); reset restores seeded baseline only, not ad-hoc session content (documented known gap).                                                                                                                                                                   |
| Accessibility (WCAG 2.1 AA)                                          | Staging-Only                          | Automated axe-core scan (Phase 29) passes across every public route on a real deployed Vercel preview. Authenticated `/app/*` shell is not yet covered.                                                                                                                                     |
| Complete QA pass (Phase 24)                                          | Not Implemented                       | Skipped in sequence per explicit direction at the time; remains `Not Started` in the phase tracker. No dedicated cross-cutting QA pass has been performed.                                                                                                                                  |

### What would need to happen for a full, unqualified GO

1. Provision real Vercel/Supabase/Clerk production projects and a
   registered domain (Phase 26's own unmet exit criterion).
2. Apply the committed migration sequence to a real Postgres instance
   and run `tenant-isolation.integration.test.ts` for real — this is
   the single highest-severity unverified claim in the entire codebase
   (every RLS policy is correct **on paper and by static check**, never
   proven against a live database engine).
3. Supply real `ANTHROPIC_API_KEY`, `EMAIL_PROVIDER_API_KEY`,
   `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, and verify each
   end-to-end.
4. Commit real pricing (`product/pricing-hypotheses.md` is still
   hypothesis-stage).
5. Perform Phase 24 (Complete QA) — a dedicated cross-cutting pass,
   never a substitute for individual phases' own test coverage.
6. Execute a real deployment and rollback cycle at least once.
7. Obtain attorney review of every legal document currently labeled
   draft.

None of these are defects in what's been built — every one is either a
credential/account this environment was never given, or a validation
pass whose entry criteria (a provisioned production stack) don't yet
exist. Nothing here was faked, stubbed, or claimed as verified without
evidence.

### Verdict: CONDITIONAL GO

The product is **code-complete, internally consistent, and
structurally sound** for every phase through 29 — every feature has
real implementation, real tests, and honestly-documented known gaps
(no phase in this codebase has ever claimed a capability was verified
when it wasn't). It is **not** a full, unqualified GO, because the
items in the section above are genuinely outside engineering's ability
to complete without someone actually provisioning accounts, supplying
credentials, and committing pricing/legal decisions.

**Recommendation:** proceed with the 7 items above as the literal
release checklist. Once items 1–3 are complete, re-run this report's
capability table — most rows will move from Credential-Gated/Blocked to
Production Verified without any further code changes, since every
adapter already fails safe today and is designed to "just work" once a
real credential is supplied.

## Related documents

- [Phase tracker — Phase 30](phase-tracker.md#phase-30-product-and-corporate-release-readiness)
- [Production configuration matrix](../operations/production-configuration-matrix.md)
- [Current project status](current-project-status.md)
- [Final audit (Phase 29)](final-audit-2026-07.md)
- [Legal operational readiness checklist](../operations/legal-operational-readiness-checklist.md)

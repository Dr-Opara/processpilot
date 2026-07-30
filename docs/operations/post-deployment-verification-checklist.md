# Post-Deployment Verification Checklist (Phase 26)

Run after every production deployment (once a real production
environment exists — this checklist has never been executed for real in
this environment).

- [ ] `GET /api/health` returns `200 { status: "ok" }`.
- [ ] `GET /api/ready` returns `200` with `status: "ok"` (database
      connectivity, queue health, provider configuration all reporting).
- [ ] Marketing homepage (`/`) loads and renders the hero section.
- [ ] Sign-in and sign-up flows work end-to-end against the real Clerk
      production instance.
- [ ] Creating an organization and completing onboarding works,
      including terms-of-service acceptance recording (Phase 25).
- [ ] A background job (e.g. the daily cron tick) has run successfully
      at least once since deployment — check `background_jobs` for
      recent `succeeded` rows and zero unexpected `dead_letter` rows.
- [ ] Security headers are present on a real response (CSP,
      `X-Content-Type-Options`, `X-Frame-Options`,
      `Strict-Transport-Security`) — see
      `e2e/security-headers.spec.ts` for the automated version of this
      check; run it against the production URL manually since it
      normally targets a local/preview server.
- [ ] No `.env.example` placeholder value leaked into a real response
      or the client bundle (`npm run check:bundle-secrets` already
      proves this for the build artifact; spot-check a real page's
      source for good measure).
- [ ] Sitemap (`/sitemap.xml`) and `robots.txt` are reachable and
      reference the real production domain, not a preview URL.
- [ ] DNS resolves correctly for both `www.useprocesspilot.com` and
      `app.useprocesspilot.com`, and the apex redirects to `www`.
- [ ] TLS certificate is valid (Vercel-managed, should be automatic).

## If something fails

Follow [incident-response-plan.md](incident-response-plan.md); for a
deployment-specific regression, follow
[deployment-runbook.md](deployment-runbook.md)'s rollback procedure
rather than attempting a forward-fix under pressure unless the fix is
small, well-understood, and already covered by a passing test.

## Related documents

- [Deployment runbook](deployment-runbook.md)
- [Deployment architecture](../architecture/deployment-architecture.md)

# Phase 29 — Final Product, Brand, UX, and Design Audit (2026-07)

An end-to-end audit of the product, architecture, and design
documentation against the shipped product, per
[phase-tracker.md's Phase 29 entry](phase-tracker.md#phase-29-final-product-brand-ux-and-design-audit).
This report records what was checked, what was found, and what was
fixed — not a rubber-stamp pass.

## Scope

This audit covers everything shipped through Phase 28. The revised
roadmap's professional-services/client-engagement positioning
requirements (products-before-services ordering, "Independent Project
Engagement" labeling, no general-IT-consultancy wording) apply to Phase
31/31A, which have not shipped yet — those checks are recorded below as
"not yet applicable," to be re-verified once that content exists, rather
than skipped silently.

## Accessibility

`design/accessibility.md` has stated since Phase 1 that "automated
checks (e.g. axe-core integrated into Playwright) are added starting
Phase 1 component work" — no such check existed anywhere in the
codebase until this phase. `@axe-core/playwright` is now a dev
dependency, and `e2e/accessibility.spec.ts` scans every public marketing
route against the WCAG 2.1 AA ruleset (`wcag2a`/`wcag2aa`/`wcag21aa`
tags, matching `design/accessibility.md`'s stated baseline).

**Found and fixed:** a real, systemic color-contrast violation.
`StatusBadge`'s `warning` variant (`bg-warning/10 text-warning`) and the
offline banner (`AppPwaClient.tsx`, same class pattern) rendered
`color-warning` (`#B7791F`) text at a 3.01:1 contrast ratio against its
own tint background — below the 4.5:1 AA minimum for normal text.
Fixed by darkening the `warning` design token to `#8A5A10` (≈4.9:1
against the same background) in `tailwind.config.ts` and
`design/colors.md`, rather than a one-off override — every current
usage of `text-warning` is against a light tint background, so the
global token change is correct and doesn't introduce a new inconsistency
elsewhere.

**Found and fixed (via the real CI run against a deployed Vercel
preview, `.github/workflows/preview-checks.yml` — the local dev-server
runs were too flaky to fully validate on their own):**

- `PageHero`'s `accent="signal"` option rendered `Eyebrow` text
  (`text-xs`/uppercase/semibold) in `color-signal` (`#F05A34`) at a
  3.10:1 contrast ratio against the page background — below the 4.5:1
  AA minimum for normal text, even though `color-signal` is fine at the
  larger sizes/UI components `design/colors.md` documents it for.
  Affected `/product/process-builder`, `/solutions/customer-operations`,
  and `/industries/franchises` (every page using `accent: "signal"`).
  Fixed two ways: (1) `Eyebrow` (`src/components/ui/Typography.tsx`)
  previously appended a caller-supplied `className` alongside its own
  hardcoded `text-cobalt`, leaving Tailwind's generated-stylesheet order
  — not the more specific/intentional class — to decide which color
  actually won; now a caller-supplied class replaces the default instead
  of competing with it. (2) `"signal"` was removed from `PageHero`'s
  accent palette entirely (`src/content/types.ts`,
  `PageHero.tsx`) — it doesn't meet AA at this text size regardless of
  the merge-order fix — and the three affected content files were
  switched to `accent: "cobalt"`.
- `/security`'s two inline links inside body-copy paragraphs
  (`text-cobalt` with no other styling) failed axe's
  `link-in-text-block` rule: a 1.13:1 contrast ratio against the
  surrounding `text-muted` prose with no non-color distinguishing style
  (no underline) — a direct violation of `design/accessibility.md` rule
  2, "never color-only." Fixed by adding `underline` to both links.

**Known gap:** the scan covers the public marketing site only, not the
authenticated `/app/*` shell — no real Clerk credentials are guaranteed
in every environment this runs in. Extending coverage to authenticated
routes (with a real or mocked sign-in step) is future work.

## Dead links

`e2e/link-audit.spec.ts` (new) crawls every internal (`href="/..."`)
link rendered on every public route and confirms each resolves.

**Found and fixed:** a real, sitewide broken link. `MarketingFooter.tsx`
rendered an unconditional "Design system" link to `/design-system` —
but that route calls `notFound()` unless
`NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM=true` is explicitly set, which it
is not in production. Every public page's footer therefore linked to a
404 in the shipped site. Fixed by gating the footer link on the same
flag the page itself checks, rather than always rendering it.

**Local test-environment note:** a handful of `e2e/accessibility.spec.ts`/
`e2e/link-audit.spec.ts` runs against a local `next dev` server
intermittently hit `net::ERR_ABORTED`/timeout errors on cold-start
routes under parallel load — the same class of dev-server
first-compile race documented in `e2e/legal-pages.spec.ts`'s header
comment. CI runs these specs with `workers: 1` against an already-built,
already-deployed Vercel preview
(`.github/workflows/preview-checks.yml`), not a lazily-compiling dev
server, so this race is not expected to reproduce there.

## Placeholder / hypothesis language

Grepped the public site and marketing content for `TODO`, `FIXME`,
"coming soon," "lorem ipsum," and "TBD." The one match
(`src/app/app/(protected)/integrations/page.tsx`: "Not yet available to
connect — coming soon.") is an intentional, honest label for a
genuinely-unimplemented integration provider — matching
`docs/architecture/public-api.md`'s established "explicit unimplemented
placeholders, never faked" convention, not stale copy. No changes made.

A related instance was already caught and fixed during Phase 28: the
authenticated dashboard (`/app`, `src/app/app/(protected)/page.tsx`)
had read "This is a placeholder dashboard proving sign-in... The real
product surface... is built starting in Phase 5" — true when Phase 0
wrote it, false since Phase 5 shipped. Noted here since it's the same
class of finding this section is auditing for, even though the fix
landed a phase earlier.

## No general-IT-consultancy wording

Grepped for "IT services," "managed IT," "staff augmentation," "IT
consultancy/consulting" across `src/app`, `src/content`, and
`src/components/marketing`. No matches — expected, since Phase 31 (the
professional-services content this requirement targets) hasn't shipped
yet. **Re-verify once Phase 31 lands.**

## Products-before-services ordering

Not yet applicable — Phase 31's Professional Services / Client
Engagements navigation and homepage sections don't exist yet. The
current site is entirely product/solutions/pricing content, which is
trivially "products-dominant" by having nothing else. **Re-verify once
Phase 31/31A land**, checking nav order, homepage section order, and
sitemap priority values against the positioning requirement in
[phase-tracker.md's Phase 31 entry](phase-tracker.md#phase-31-corporate-product-and-services-website).

## Documentation drift

- `product/roadmap.md`'s Horizon 6 description was written before the
  Phase 25–31A revisions and only mentioned "Phases 21–30." Updated to
  list the actual current phase set through 31A and note the
  product-track/corporate-website-track split.
- `docs/project/phase-tracker.md`'s Phase 29 and Phase 30 entries still
  described their original (pre-revision) scope, and Phase 31/31A had
  no entries at all. Rewritten to match the revised roadmap (see this
  phase's commit).
- `docs/architecture/database-schema.md` **remains** explicitly
  self-disclosed as "known incomplete above [Phase 4]" — this was true
  before this phase and remains true after it. Bringing it fully current
  (70+ tables' worth of documentation) is a large, separate undertaking
  disproportionate to this pass's scope; recorded here as a known gap
  rather than silently left stale or attempted as a rushed, low-quality
  pass.

## Not attempted in this pass

- Full authenticated-app accessibility scanning (see "Known gap" above).
- A complete rewrite of `database-schema.md`.
- Manual keyboard-only / screen-reader spot checks (`design/
accessibility.md`'s "Verification" section calls for these per new
  core flow — none of Phases 21–28 shipped a new core end-user flow
  significant enough to trigger this on its own, but a dedicated manual
  pass across the whole product has not been performed).

## Related documents

- [Phase tracker — Phase 29](phase-tracker.md#phase-29-final-product-brand-ux-and-design-audit)
- [design/accessibility.md](../../design/accessibility.md)
- [design/colors.md](../../design/colors.md)
- [product/roadmap.md](../../product/roadmap.md)

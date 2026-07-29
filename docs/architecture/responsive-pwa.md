# Responsive Layout and PWA (Phase 20)

Covers the mobile-usability and installable-PWA work in
[phase-tracker.md](../project/phase-tracker.md)'s Phase 20. Scope was
narrowed at phase start (per that entry's own risk note — "scope of
true offline support decided at phase start, not assumed here") to what
follows; the "Known gaps" section documents what was deliberately left
out rather than silently omitted.

## Primary navigation (new in this phase)

Before this phase, the authenticated app shell
(`src/app/app/(protected)/layout.tsx`) had a header only — no way to
navigate between sections except a hand-typed URL. This phase adds:

- `src/lib/app-nav.ts` — the nav item catalog (`APP_NAV_ITEMS`) and
  `visibleNavItems(permissions, scopedPermissions)`, a pure function
  filtering it to what the current member can see. Home and My Work
  have no required permission (every active member sees them); every
  other item requires the same permission its own page's service layer
  already enforces (e.g. `member.manage` for People). This filtering is
  presentation only — hiding a nav item never substitutes for the
  target route's own server-side `requirePermission()` check, per
  [product/information-architecture.md](../../product/information-architecture.md).
- `src/components/app/AppNav.tsx` — a persistent sidebar at the `md`
  breakpoint and up; below it, a `<details>`-based disclosure in the
  header (no client-side JavaScript needed to open/close it).
- `external_user` sessions render no primary navigation at all — the
  protected layout checks `roleKeys.includes("external_user")` (a new
  field on `CurrentMembership`, resolved in `src/lib/authz.ts`, UI
  rendering only, never authoritative for access control) and omits
  `<AppNav>` entirely, matching
  [design/application-layout.md](../../design/application-layout.md)'s
  "Role-aware rendering."

## Responsive table → card collapse

The employee-critical flow named in this phase's exit criteria — My
Work (`/app/tasks`) — now renders a stacked card list below `md` and
the original `<table>` at `md` and above
(`src/app/app/(protected)/tasks/page.tsx`). Task completion, form
submission (`DynamicFormRenderer`), and evidence upload
(`EvidenceFileField`) on the task-detail page were already
mobile-usable without changes — they use the existing `Stack` (flex
column) layout primitive at a `max-w-2xl` container, which reflows
naturally at any viewport width; no fixed-pixel widths were found in
either component.

## Installable PWA

- `src/app/manifest.ts` (pre-existing) already provides `name`,
  icons, `display: "standalone"`, and theme colors — installability
  itself required no change.
- `public/app-sw.js` — a minimal service worker, scoped to `/app/`
  only (never the marketing site): precaches `/app/offline`
  (`src/app/app/offline/page.tsx`, outside the `(protected)` route
  group so it's reachable without a session) and, on a failed
  navigation request, serves that cached page instead of the browser's
  default offline error. It does not intercept or cache any API/data
  request — every read or write always reflects live, authorized,
  tenant-scoped data; nothing is ever served stale.
- `src/components/app/AppPwaClient.tsx` — a client component in the
  protected layout that registers the service worker and shows a
  `role="status"` banner ("You're offline. Changes you make now won't
  be saved until you reconnect.") while `navigator.onLine` is false.
  Both registration and the banner are progressive enhancement: a
  browser without service-worker support, or one whose
  online/offline events don't fire reliably, just runs the app exactly
  as it did before this phase.

## Known gaps

- **No true offline task completion.** The service worker does not
  queue form submissions, evidence uploads, or task completions made
  while offline for later replay — this was the explicit scope
  decision at phase start (per the phase tracker's own risk note). The
  offline banner tells the user their changes won't be saved, and the
  offline fallback page appears for a failed navigation, but no
  background-sync queue exists. A future phase could add one using the
  same `background_jobs` pattern already reused throughout this
  codebase (webhooks, notifications), if frontline connectivity data
  justifies the complexity.
- **Only the My Work task list got a card-view responsive treatment.**
  The other ~25 table-based views (Processes, Workflows, Members,
  Audit, Analytics, etc.) are administrative/management surfaces, not
  the "frontline employee" flows this phase's goal names; they remain
  horizontally-scrollable tables (`ScrollArea`) at every viewport,
  usable but not optimized for a phone. Extending the same collapse
  pattern to them is straightforward (the My Work implementation is the
  template) but out of this phase's scope.
- **No real mobile-device or Lighthouse verification.** All of the
  above is verified by code review, unit tests
  (`src/lib/app-nav.test.ts`), and the production build succeeding —
  consistent with this repository's standing "no local dev server, no
  Vercel-preview browser session available in this environment"
  posture (see [CLAUDE.md](../../CLAUDE.md)'s remote-first rules).
  Installability, offline behavior, and mobile-viewport accessibility
  should be spot-checked against an actual Vercel preview URL before
  this is treated as done end-to-end.
- **The dashboard (`/app`) remains the Phase 1/3 placeholder** — "This
  is a placeholder dashboard..." copy. Now that primary navigation
  exists, this is more visible than before, but rewriting it into a
  real "what's assigned to me" landing page (per
  [information-architecture.md](../../product/information-architecture.md))
  is separate scope, not part of this phase's responsive/PWA goal.

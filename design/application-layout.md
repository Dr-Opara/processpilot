# Application Layout

Layout guidance for app.processpilot.com, implemented starting Phase 1
(shell) and populated with real views from Phase 5 onward. Navigation
content is defined in
[product/information-architecture.md](../product/information-architecture.md);
this document covers the layout structure, not the nav item list itself.

## Shell structure

- **Primary navigation** — persistent, role-aware sidebar (desktop) /
  bottom or drawer navigation (mobile, Phase 20) listing only the
  sections the signed-in member has any access to, per
  [information-architecture.md — role-aware navigation behavior](../product/information-architecture.md).
- **Top bar** — organization/workspace switcher (if the member belongs to
  more than one), search, notifications, account menu.
- **Content area** — the active section's content, using
  [spacing.md](spacing.md) density rules appropriate to operational,
  information-dense views.
- **Contextual panel (optional)** — used for detail-on-demand (e.g.
  viewing a task's full history alongside a list) rather than always
  navigating away from a list view.

## Role-aware rendering

- Sections with zero permitted actions for the current member are
  omitted from the primary navigation entirely (not shown disabled).
- `external_user` sessions render a minimal shell: no primary navigation
  sidebar, no organization switcher — just the single assigned
  resource and the account/sign-out affordance. See
  [product/user-roles.md — external_user](../product/user-roles.md).
- `auditor` sessions render the standard shell with all mutating controls
  (buttons that would create/edit/approve/resolve) omitted, not merely
  disabled, for any view outside their read-only scope.

## Responsive behavior

- Desktop-first information density (tables, multi-column dashboards)
  collapses to a mobile-appropriate single-column, card-based
  presentation at narrow viewports — full responsive implementation is
  Phase 20, but Phase 1's shell should not preclude it (avoid
  fixed-pixel layouts that can't reflow).
- Primary navigation collapses to a bottom bar or drawer below a defined
  breakpoint (set during Phase 1 implementation).

## Related documents

- [Information architecture](../product/information-architecture.md)
- [Components](components.md)
- [Marketing layout](marketing-layout.md)

# Accessibility

## Standard

WCAG 2.1 AA is the baseline for **all** core workflows — application and
marketing — not just marketing pages. This is a requirement, not an
aspiration; see [product/requirements.md](../product/requirements.md).

## Requirements

1. **Color contrast.** All text/background and meaningful UI-component
   pairings meet AA contrast ratios (4.5:1 normal text, 3:1 large text
   and UI components). See [colors.md](colors.md).
2. **Never color-only.** Status, error, and required-field indicators
   always pair color with text, icon, or both — never color alone.
3. **Keyboard operability.** Every interactive element (including custom
   components — dialogs, comboboxes, tabs) is fully operable by keyboard,
   with a visible focus indicator at every step.
4. **Semantic structure.** Headings, landmarks, and lists use correct
   semantic HTML/ARIA roles so screen readers can navigate structure, not
   just read a flat stream of text.
5. **Labels and instructions.** Every form field has a programmatically
   associated label; helper and error text are associated via
   `aria-describedby` or equivalent, not conveyed by placement alone.
6. **Touch targets.** Minimum 44x44px touch target on interactive
   elements at mobile/PWA viewports. See
   [spacing.md — touch targets](spacing.md).
7. **Motion.** No motion/animation that cannot be disabled via
   `prefers-reduced-motion`; nothing flashes more than three times per
   second (seizure-safety baseline).
8. **Alt text.** Every meaningful image has descriptive alt text;
   decorative images are marked as such (empty alt) so they're skipped by
   assistive technology.

## Role-specific considerations

- `external_user` and frontline `employee` flows (task completion, form
  submission) are the highest-stakes accessibility surfaces — these users
  often have no alternative path to complete required work, unlike an
  admin who might have other tooling available. Treat these flows as the
  accessibility bar-setters, not an afterthought relative to
  admin/analytics screens.
- `auditor` read-only views must remain fully navigable by screen reader
  even though many controls are intentionally omitted (see
  [application-layout.md](application-layout.md)) — omission must not
  break landmark/heading structure.

## Verification

- Automated checks (e.g. axe-core integrated into Playwright) are added
  starting Phase 1 component work and run against every new view as it's
  built, not deferred to Phase 24 (Complete QA) as a first pass.
- Manual keyboard-only and screen-reader spot checks are part of the exit
  criteria for any phase that ships a new core user-facing flow.

## Related documents

- [Colors](colors.md)
- [Typography](typography.md)
- [Components](components.md)
- [Requirements](../product/requirements.md)

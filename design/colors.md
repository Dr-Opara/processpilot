# Colors

## Palette

| Token                 | Hex       | Usage                                                                      |
| --------------------- | --------- | -------------------------------------------------------------------------- |
| `color-ink`           | `#111318` | Primary text on light surfaces; primary dark-mode surface base             |
| `color-paper`         | `#F7F5F0` | App/marketing background                                                   |
| `color-surface`       | `#FFFFFF` | Cards, panels, modals, elevated content on Paper                           |
| `color-signal-orange` | `#F05A34` | Primary actions, primary brand accent — use deliberately, not decoratively |
| `color-cobalt`        | `#3157D5` | Links, secondary actions, informational emphasis                           |
| `color-success`       | `#287A56` | Completed, published, approved, passing states                             |
| `color-warning`       | `#B7791F` | Pending review, approaching deadline, needs attention                      |
| `color-danger`        | `#C33B3B` | Exception, rejected, overdue, destructive action                           |
| `color-border`        | `#DDDCD7` | Dividers, input borders, card edges                                        |
| `color-muted`         | `#676B73` | Secondary/caption text, metadata, timestamps                               |

## Usage rules

1. **Signal orange is reserved for primary action.** One primary CTA per
   view. Do not use it decoratively (icons, backgrounds) — it must stay
   meaningful as "the thing to do here."
2. **Status colors map to system state, not decoration.** Success,
   Warning, and Danger correspond directly to the state model in
   [docs/architecture/domain-model.md](../docs/architecture/domain-model.md)
   (e.g. a published process, a task approaching its deadline, an open
   exception) — never used arbitrarily for visual variety.
3. **Ink on Paper/Surface is the default text pairing.** Muted text is
   used for secondary information only, never for primary content a user
   must act on.
4. **Contrast.** All text/background pairings must meet WCAG 2.1 AA
   contrast ratios (4.5:1 for normal text, 3:1 for large text/UI
   components) — see [accessibility.md](accessibility.md). Signal orange
   and Warning on Paper/Surface should be checked carefully; use Ink text
   on these colors rather than white where contrast is borderline.

## Dark mode

Dark mode is not committed for Phase 0–1 delivery, but the palette is
chosen to extend cleanly: Ink becomes a background tone, Paper/Surface
invert to dark neutrals, and Signal orange/Cobalt/status colors carry
forward with adjusted lightness to maintain AA contrast. Finalize exact
dark-mode values when a phase actually implements a dark theme — do not
hard-code an unreviewed dark palette into components speculatively.

## What this palette is not

Not a gradient system, not a "brand color + 10 auto-generated tints from a
color picker" system, and not decorated with glow/blur effects — see
[avoid list in branding.md](branding.md). Every additional shade used in
implementation (e.g. hover/active states) should be a deliberate,
documented adjustment of one of the ten tokens above, not an arbitrary
new hex value introduced ad hoc in component code.

## Related documents

- [Branding](branding.md)
- [Accessibility](accessibility.md)
- [Components](components.md)

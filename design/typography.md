# Typography

## Principles

Typography should read as precise and operational, not decorative —
consistent with [brand personality](branding.md). A system-first sans
serif (e.g. the platform system-font stack, or a single well-chosen
web font selected during Phase 1 implementation) is appropriate; no
display/script fonts, no more than one typeface family in the product
(a second, monospace family is acceptable for code/IDs/technical values
only).

Exact font family selection is an implementation decision for Phase 1,
constrained by:

- Must be legible at small sizes on mobile (frontline employee use on
  Phase 20's responsive/PWA surface).
- Must support the full character set needed for target markets.
- Must not be a typeface strongly associated with a specific well-known
  competitor's brand identity.

## Type scale (target)

| Token          | Size / line-height    | Usage                                    |
| -------------- | --------------------- | ---------------------------------------- |
| `text-display` | 32–40px / 1.2         | Marketing hero headlines only            |
| `text-h1`      | 28px / 1.25           | Page-level heading                       |
| `text-h2`      | 22px / 1.3            | Section heading                          |
| `text-h3`      | 18px / 1.4            | Subsection / card heading                |
| `text-body`    | 16px / 1.5            | Default body text                        |
| `text-body-sm` | 14px / 1.5            | Secondary text, table cells, form labels |
| `text-caption` | 12px / 1.4            | Metadata, timestamps, helper text        |
| `text-mono`    | 14px / 1.5, monospace | IDs, codes, technical/system values      |

## Weight usage

- Regular (400) for body text.
- Medium (500) for emphasis within body text and for labels.
- Semibold/Bold (600–700) reserved for headings and the single primary
  action per view — not applied broadly for "importance," which dilutes
  its signal.

## Rules

1. Never rely on color alone to convey meaning that typography/iconography
   could also convey — supports [accessibility.md](accessibility.md).
2. Line length for body text should stay within a readable measure
   (roughly 60–80 characters) in both marketing and application contexts.
3. No more than three type sizes visible in a single, focused view
   (e.g. a task-completion screen) to keep frontline-facing surfaces calm
   or precise per brand personality — dashboards/analytics views may use
   the fuller scale.

## Related documents

- [Branding](branding.md)
- [Spacing](spacing.md)
- [Accessibility](accessibility.md)

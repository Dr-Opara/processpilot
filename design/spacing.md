# Spacing

## Base unit

4px base unit, scaled in a consistent progression. Use Tailwind's default
spacing scale (already 4px-based) as the implementation vehicle in Phase
1 rather than inventing a parallel custom scale.

| Token      | Value | Typical usage                                |
| ---------- | ----- | -------------------------------------------- |
| `space-1`  | 4px   | Icon-to-label gap, tight inline spacing      |
| `space-2`  | 8px   | Compact control padding                      |
| `space-3`  | 12px  | Default form-field padding                   |
| `space-4`  | 16px  | Default gap between related elements         |
| `space-6`  | 24px  | Gap between distinct groups within a section |
| `space-8`  | 32px  | Section padding                              |
| `space-12` | 48px  | Gap between major page sections              |
| `space-16` | 64px  | Marketing section padding (large viewports)  |

## Principles

1. **Consistency over precision-tuning.** Use scale tokens, not one-off
   pixel values, so density stays predictable across the whole
   application — this matters more for an operational tool used daily
   than for a marketing page seen occasionally.
2. **Density favors operational clarity over marketing spaciousness.**
   Application views (task lists, tables, forms) should feel efficient,
   not airy — reserve generous spacing (`space-12`/`space-16`) for the
   marketing site, and keep application views closer to `space-2`–`space-6`
   for information-dense contexts like **My Work** or **Analytics**.
3. **Touch targets.** Interactive elements on mobile/PWA views (Phase 20)
   maintain a minimum 44x44px touch target regardless of the visual
   spacing scale, per [accessibility.md](accessibility.md).

## Related documents

- [Typography](typography.md)
- [Application layout](application-layout.md)
- [Accessibility](accessibility.md)

# Components

Component implementation happens in Phase 1; this document defines the
required primitive set and the rules governing them so implementation has
a clear brief rather than defaulting to an unmodified UI library look
(explicitly disallowed — see [branding.md](branding.md)).

## Primitive inventory

| Component                    | Notes                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                       | Primary (Signal orange), Secondary (Ink/Border outline), Destructive (Danger), Ghost/Text. One primary button per view.                                                                                                                                                                   |
| Input / Textarea             | Includes label, helper text, and error-state slots — errors are never color-only (see [accessibility.md](accessibility.md)).                                                                                                                                                              |
| Select / Combobox            | Accessible listbox pattern, keyboard-navigable.                                                                                                                                                                                                                                           |
| Checkbox / Radio / Switch    | Used for genuinely binary/choice state — not repurposed as a styling trick for something else.                                                                                                                                                                                            |
| Badge / Status pill          | Maps directly to domain state (draft/in review/published; assigned/in progress/complete/exception) — see [colors.md — status colors](colors.md). Avoid excessive pill-shaped containers elsewhere per [branding.md](branding.md) — status pills are the deliberate, sanctioned exception. |
| Card                         | Used for discrete, scannable units (a process summary, a task) — not the default wrapper for every block of content (avoids "excessive rounded cards," see [branding.md](branding.md)).                                                                                                   |
| Table                        | Primary pattern for dense operational data — task lists, member lists, audit logs. Sortable/filterable where the underlying view needs it.                                                                                                                                                |
| Modal / Dialog               | Reserved for focused, blocking decisions (confirm publish, confirm destructive action) — not used for primary navigation flows.                                                                                                                                                           |
| Toast / Inline notice        | Toast for transient confirmation; inline notice for persistent, in-context status (e.g. "this process has unpublished changes").                                                                                                                                                          |
| Tabs                         | For switching between views of the same resource (e.g. a process's Steps / History / Settings).                                                                                                                                                                                           |
| Empty state                  | Every list/table view has a designed empty state — never a blank white area.                                                                                                                                                                                                              |
| Form field group             | Composes Input/Select/Checkbox with consistent label/helper/error layout, shared across marketing (contact/demo forms) and application (process/task forms).                                                                                                                              |
| Avatar / Member chip         | Represents a `Member` consistently across assignment, approval, and audit contexts.                                                                                                                                                                                                       |
| Navigation shell (app)       | See [application-layout.md](application-layout.md).                                                                                                                                                                                                                                       |
| Navigation shell (marketing) | See [marketing-layout.md](marketing-layout.md).                                                                                                                                                                                                                                           |

## Rules

1. **Accessible by construction.** Every interactive primitive is
   keyboard-operable, has visible focus states, and correct ARIA
   semantics — not retrofitted after visual design. See
   [accessibility.md](accessibility.md).
2. **One component, one job.** Do not reuse a Card where a Table row
   would represent the data more scannably, or a Modal where an inline
   notice would be less disruptive — component choice follows the
   information's actual shape.
3. **State-driven visuals come from tokens, not one-off styling.** Status
   pills, buttons, and form error states pull from
   [colors.md](colors.md) tokens — no inline hex values in component
   implementations.
4. **No unmodified library defaults.** If a headless/accessible primitive
   library is used as an implementation base (e.g. for listbox/dialog
   behavior) in Phase 1, its visual output must be fully re-themed to
   this design system before shipping — shipping default styling from any
   component library is explicitly disallowed.

## Related documents

- [Colors](colors.md)
- [Typography](typography.md)
- [Spacing](spacing.md)
- [Application layout](application-layout.md)
- [Accessibility](accessibility.md)

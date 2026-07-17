# Content Style

Written-language expression of [brand personality](branding.md): calm,
precise, operational, trustworthy, human, modern, enterprise-ready.

## Voice

- **Direct, not hyped.** State what the product does; avoid superlatives
  ("revolutionary," "game-changing," "effortless") that a compliance
  buyer will discount on sight.
- **Plain language over jargon.** Prefer "published" over "deployed to
  production state," prefer "task" over "actionable work item" — use the
  precise terms in [product/terminology.md](../product/terminology.md),
  not invented synonyms for the same concept.
- **Second person for product copy, third person for documentation.**
  In-app copy speaks to "you" (the signed-in member); this repository's
  documentation speaks in third person/imperative.
- **No manufactured urgency.** No countdown timers, no "only 3 spots
  left"-style pressure tactics, consistent with
  [product/product-principles.md — calm operational software](../product/product-principles.md).

## Terminology discipline

Use [product/terminology.md](../product/terminology.md) exactly — in
particular, "process," "workflow," and "task" are never used
interchangeably in UI copy, error messages, marketing content, or
documentation. If a sentence is ambiguous about which of the three it
means, rewrite it rather than relying on context.

## UI copy rules

1. **Button labels are verbs that state the action** ("Publish process,"
   not "Submit" or "OK") — a member should never have to guess what a
   button does from generic labels.
2. **Error messages state what happened and what to do next** — not just
   "Something went wrong." Reference the specific field, resource, or
   constraint involved.
3. **Empty states explain what will appear here and, where relevant, the
   action that produces it** ("No exceptions yet — they'll appear here
   automatically when a task misses its deadline.").
4. **Numbers are always real.** No placeholder statistics in copy, ever
   — including in design mockups meant for internal review (mark mockup
   data explicitly as illustrative if numbers must appear before real
   data exists).

## Marketing content rules

- No fabricated customer names, logos, testimonials, or statistics — see
  [marketing-layout.md — content integrity rules](marketing-layout.md).
- Security and compliance claims are reviewed against actual
  implementation status (see [docs/architecture](../docs/architecture/))
  before publishing — never aspirational claims presented as current
  fact.

## Related documents

- [Branding](branding.md)
- [Terminology](../product/terminology.md)
- [Marketing layout](marketing-layout.md)

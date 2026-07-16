# Branding

## Brand personality

ProcessPilot should feel:

- **Calm** — no manufactured urgency, no gamification, no dark patterns.
- **Precise** — exact language, exact numbers, no vague claims.
- **Operational** — built for people doing real work under real
  constraints, not a lifestyle or consumer product.
- **Trustworthy** — every claim is verifiable; every action is
  accountable.
- **Human** — plain language, not corporate jargon or robotic AI-speak.
- **Modern** — contemporary, uncluttered visual language.
- **Enterprise-ready** — credible to a compliance professional and an
  auditor, not just a marketing audience.

This personality applies to visual design, product copy, and marketing
content equally — see [content-style.md](content-style.md) for the
written-language expression of the same personality.

## Asset status

No approved ProcessPilot logo or icon asset has been supplied to the
project as of Phase 0. `design/logo/` and `design/icons/` are placeholder
directories (see their `README.md` files) until real assets are
provided. Do not fabricate a logo or icon in the meantime — the
[application favicon](../src/app/favicon.ico) currently in the
repository is the unmodified Next.js default and must be replaced with an
approved asset before any public-facing release, not treated as final.

## Core colors

| Name          | Hex       | Role                                                  |
| ------------- | --------- | ----------------------------------------------------- |
| Ink           | `#111318` | Primary text, high-emphasis UI                        |
| Paper         | `#F7F5F0` | Primary background (warm, not stark white)            |
| Surface       | `#FFFFFF` | Cards, elevated surfaces on Paper                     |
| Signal orange | `#F05A34` | Primary brand accent, primary CTA                     |
| Cobalt        | `#3157D5` | Secondary accent, links, informational                |
| Success       | `#287A56` | Positive status (completed, published, approved)      |
| Warning       | `#B7791F` | Caution status (approaching deadline, pending review) |
| Danger        | `#C33B3B` | Negative status (exception, rejected, overdue)        |
| Border        | `#DDDCD7` | Dividers, input borders, card edges                   |
| Muted text    | `#676B73` | Secondary text, captions, metadata                    |

Full usage guidance, contrast pairings, and dark-mode treatment are in
[colors.md](colors.md).

## What to avoid

Per product principles ([real numbers or no numbers](../product/product-principles.md)),
these are not stylistic suggestions — they are hard constraints on every
surface, marketing or product:

- Purple AI gradients
- Glassmorphism
- Glowing decorative effects
- Generic robot illustrations
- Excessive rounded cards
- Excessive pill-shaped containers
- Fake customer logos
- Fake testimonials
- Fake certifications
- Fake success statistics
- Copied competitor interfaces
- Default unmodified component-library styling

A screen that could be mistaken for a generic AI-startup template has
failed this brief, regardless of how polished it looks.

## Related documents

- [Colors](colors.md)
- [Typography](typography.md)
- [Content style](content-style.md)
- [Product principles](../product/product-principles.md)

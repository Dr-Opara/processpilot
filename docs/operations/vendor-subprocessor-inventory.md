# Vendor and Subprocessor Inventory

The customer-facing version of this list is
[/legal/subprocessors](../../src/app/legal/subprocessors/page.tsx)
(rendered from `src/content/legal.ts`'s `subprocessors` array — the same
source of truth, not a separately maintained copy). This document adds
the internal-only fields a subprocessor list needs beyond what's safe to
publish.

| Vendor    | Purpose            | Data processing agreement on file | Security review completed |
| --------- | ------------------ | --------------------------------- | ------------------------- |
| Clerk     | Authentication     | Not yet — no production account   | No                        |
| Supabase  | Database + storage | Not yet                           | No                        |
| Vercel    | Hosting            | Not yet                           | No                        |
| Stripe    | Billing            | Not yet                           | No                        |
| Resend    | Email              | Not yet                           | No                        |
| Anthropic | AI features        | Not yet                           | No                        |

None of these vendor relationships have a signed DPA or a completed
internal security review in this environment — real accounts with these
providers, if any, exist as development/free-tier credentials, not
production commercial agreements. This must be completed before
production launch — see
[legal-operational-readiness-checklist.md](legal-operational-readiness-checklist.md).

## Related documents

- [Data classification framework](data-classification.md)
- [Subprocessors page](../../src/app/legal/subprocessors/page.tsx)

# Pricing Hypotheses

**Status: hypotheses, not committed pricing.** Nothing in this document
should appear on the public marketing site as a live price until validated
with design partners and explicitly promoted out of this document. See
[product principles — real numbers or no numbers](product-principles.md).

## Working model: per-seat + tier, with usage guardrails

A hybrid of the two most common B2B SaaS models, chosen because
ProcessPilot has both a clear per-employee usage driver (frontline
employees executing tasks) and clear tier-worthy feature depth (AI
copilot, audit/compliance center, integrations).

| Tier (working name) | Hypothesized audience                  | Hypothesized inclusions                                                                                                                           |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starter             | Single-location small business         | Core loop (knowledge → process → workflow → evidence), limited seats, community/email support                                                     |
| Business            | Multi-location mid-market              | Everything in Starter, plus training/certification, analytics, approvals/escalations, standard integrations                                       |
| Enterprise          | Regulated / multi-entity organizations | Everything in Business, plus audit/compliance center, AI copilot at scale, SSO, custom roles, dedicated support, higher storage/seat entitlements |

## Entitlement dimensions (see [terminology](terminology.md))

- Seats (billable members; `external_user` access is not assumed to be
  seat-billed the same way — hypothesis to validate).
- AI usage (copilot requests per period).
- Storage (evidence/document storage volume).
- Advanced features gated by tier (audit export, custom roles, SSO,
  integrations) via [entitlements](../docs/architecture/billing-architecture.md).

## Open questions to validate before committing pricing

- Is per-seat billing based on all members, or only members with
  `workflow.complete`-class execution roles (i.e., should
  `auditor`/read-only roles be free or discounted)?
- Does `external_user` access consume a seat, a metered unit, or is it
  unlimited within a tier?
- What is the right AI-usage unit (requests, tokens, or a simplified
  "copilot actions per month") for customer-legible billing?
- Annual vs. monthly billing discount structure.
- Whether a free trial is time-boxed, usage-boxed, or both.

## Related documents

- [Success metrics](success-metrics.md)
- [Assumptions and risks](assumptions-and-risks.md)
- [Billing architecture](../docs/architecture/billing-architecture.md)

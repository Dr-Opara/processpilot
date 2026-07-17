# Assumptions and Risks

## Product assumptions

| Assumption                                                                                            | Why it matters if wrong                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customers already have SOPs/policies in some document form to import                                  | If knowledge is purely tacit (in people's heads, not written down), the "import knowledge" stage of the product loop needs a much heavier authoring-from-scratch experience than currently scoped.                                        |
| AI extraction from source documents is accurate enough to be a genuine time-saver, not just a novelty | If extraction quality is poor, process owners may find manual authoring faster, undermining a core value proposition. Mitigated by always treating AI output as a draft (see [AI architecture](../docs/architecture/ai-architecture.md)). |
| Frontline employees will engage with a new tool if it's simple enough                                 | Adoption is the highest-risk part of any operations tool — if **My Work** isn't dramatically simpler than existing methods (paper, spreadsheets, group chat), frontline adoption fails regardless of admin-side feature depth.            |
| Regulated/operationally-intensive verticals value audit trails enough to pay for them                 | If the target market undervalues auditability relative to price, the enterprise tier's core differentiator weakens.                                                                                                                       |

## Architectural assumptions

| Assumption                                                                                                 | Why it matters if wrong                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clerk + Supabase + Vercel + Stripe is the right managed-services stack for the full product lifecycle      | Switching a core managed service after significant integration work is expensive; provider-neutral adapters (AI, email, queues) are deliberately used to reduce this specific risk for those three services — see [system overview](../docs/architecture/system-overview.md). |
| PostgreSQL Row-Level Security plus application-layer checks is sufficient tenant isolation at target scale | If RLS performance degrades at high tenant/row counts, isolation strategy may need revisiting — tracked as a revisit condition in [ADR-0005](../docs/architecture/decisions/0005-postgresql-row-level-security.md).                                                           |
| An event-driven workflow engine (vs. a simpler synchronous state machine) is warranted from the start      | Adds complexity earlier than a synchronous model would; justified by the need for scheduled/triggered workflow starts and escalations — see [ADR-0010](../docs/architecture/decisions/0010-event-driven-workflow-execution.md).                                               |

## Commercial risks

- **Pricing model unvalidated.** See [pricing hypotheses](pricing-hypotheses.md)
  — nothing here is committed; validating with design partners is a
  prerequisite for GA, per [release plan](release-plan.md).
- **Long sales cycle for regulated industries.** Enterprise buyers in
  healthcare/financial services may require security certifications
  (SOC 2, HIPAA-adjacent posture) before purchase — tracked as a
  dependency of Phase 25 (Legal and trust readiness).
- **Competitive category ambiguity.** ProcessPilot sits between workflow
  automation, QMS (quality management systems), and LMS (learning
  management) categories — go-to-market messaging risk if the category
  isn't clearly claimed. Owned by marketing/positioning work, not
  engineering.

## Security and compliance risks

- **AI governance boundary enforcement.** The rule that AI cannot
  independently publish, approve, or close records must be enforced in
  code (server-side), not just documented policy — tracked as a
  mandatory exit criterion for Phase 13.
- **External user access scope creep.** A resource-scoped `external_user`
  invitation must not be capable of privilege escalation into
  organization-wide access — mandatory test coverage for Phase 19.
- **Suspended-member access lag.** Any caching layer introduced later
  (sessions, permission caches) must not allow a suspended member's
  access to outlive the suspension — tracked in
  [authentication and authorization](../docs/architecture/authentication-and-authorization.md).

## Revisiting this document

Update this document whenever a listed assumption is validated,
invalidated, or a new material risk is identified — do not let it go
stale while the roadmap advances. Cross-reference from the relevant ADR
"Revisit conditions" section when an assumption underlies an architecture
decision.

## Related documents

- [Roadmap](roadmap.md)
- [Pricing hypotheses](pricing-hypotheses.md)
- [Architecture decisions](../docs/architecture/architecture-decisions.md)

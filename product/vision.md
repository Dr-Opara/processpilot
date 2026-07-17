# Vision

## Statement

**ProcessPilot is the operating system for repeatable business work.**

## Value proposition

ProcessPilot turns company procedures into guided, executable work that
employees can complete, managers can monitor, and organizations can
continuously improve.

Most organizations already have policies, SOPs, checklists, and know-how —
scattered across documents, spreadsheets, email threads, and the memory of
whoever has been there longest. That knowledge rarely becomes something a
new employee can actually execute correctly, a manager can observe in real
time, or an auditor can verify happened. ProcessPilot closes that gap: it
converts static knowledge into governed, versioned processes; turns
processes into assignable, trackable workflows; and turns workflow
execution into evidence, analytics, and continuous improvement.

## Who it is for

Mid-market and enterprise organizations in operationally intensive,
regulated, or franchise-style industries (healthcare, manufacturing, food
service, field services, financial services, logistics) where:

- Work must be done the same correct way every time.
- Deviation has safety, quality, or compliance consequences.
- Proof that work happened is required for audits, certifications, or
  customers.
- Institutional knowledge is currently trapped in documents or people.

## The product loop

ProcessPilot's core loop is the same for every customer, regardless of
industry:

1. **Import company knowledge** — upload policies, SOPs, forms, and other
   source documents into a governed knowledge base.
2. **Structure and govern the knowledge** — organize, version, and assign
   ownership so knowledge has a clear source of truth.
3. **Generate a draft process** — AI proposes structured process steps from
   source knowledge; a human always reviews the proposal.
4. **Review and publish the process** — a process owner approves and
   publishes an immutable, versioned process.
5. **Assign and execute workflows** — published processes are instantiated
   as workflows and assigned to people, teams, locations, or schedules.
6. **Capture approvals and evidence** — workflow execution produces forms,
   uploaded evidence, and approvals as it runs.
7. **Manage exceptions** — deviations from the expected path are captured,
   triaged, and resolved with corrective actions, not silently dropped.
8. **Train employees** — processes drive training assignments and
   certifications so people are equipped before they execute.
9. **Analyze performance** — completion rates, cycle time, exception rates,
   and compliance posture are visible to operations leaders in real time.
10. **Improve the process** — analytics, exceptions, and AI-assisted review
    feed back into the next version of the process, closing the loop.

This loop is the organizing structure for the entire product. Every feature
in the [feature catalog](feature-catalog.md) exists to serve one of these
ten stages.

## What ProcessPilot is not

- Not a generic project-management or task-tracking tool — work is derived
  from governed processes, not ad hoc lists.
- Not a document repository — knowledge documents exist to be turned into
  executable processes, not merely stored and searched.
- Not a fully autonomous AI system — AI assists at every stage of the loop
  but never has independent authority to publish, approve, or close on a
  human's behalf (see [AI architecture](../docs/architecture/ai-architecture.md)).
- Not a single-tenant tool retrofitted for multiple customers — multi-tenancy
  and data isolation are foundational, not bolted on later (see
  [multi-tenancy](../docs/architecture/multi-tenancy.md)).

## Related documents

- [Product principles](product-principles.md)
- [Feature catalog](feature-catalog.md)
- [Roadmap](roadmap.md)
- [Terminology](terminology.md)

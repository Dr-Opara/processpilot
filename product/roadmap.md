# Roadmap

Directional, not a committed release schedule. The authoritative,
sequenced breakdown of work lives in the
[phase tracker](../docs/project/phase-tracker.md). This document explains
the shape of the roadmap; the phase tracker explains the detail.

## Horizon 1 — Foundation (Phases 0–4)

Product/engineering documentation, repository and design foundation,
marketing site, authentication and organizations, database and tenant
isolation. No end-user product features yet — this horizon exists so every
later phase is built on governed, secure, well-documented ground.

## Horizon 2 — Core loop, stages 1–4 (Phases 5–8)

Business onboarding, employee management, knowledge management, process
builder, workflow execution engine. This horizon delivers the first
end-to-end slice of the [product loop](vision.md): import knowledge,
structure it, build a process, execute it as a workflow.

## Horizon 3 — Core loop, stages 5–8 (Phases 9–12)

Forms and evidence, approvals and escalations, exception management,
training and certifications. This horizon completes execution-side
governance: proof of work, accountability, and readiness.

## Horizon 4 — Intelligence and insight (Phases 13–15)

AI ingestion and copilot, analytics, audit and compliance center. This
horizon closes the loop — turning execution data into insight and
improvement, with AI as an assistant throughout (see
[AI architecture](../docs/architecture/ai-architecture.md)).

## Horizon 5 — Commercial readiness (Phases 16–20)

Notifications, billing and entitlements, integrations, external portal,
responsive PWA. This horizon makes the product sellable and usable by
audiences beyond the core internal org (external users, mobile-first
usage) and financially operable (billing).

## Horizon 6 — Hardening and launch (Phases 21–30)

Organization administration depth, security hardening, reliability and
observability, complete QA, legal and trust readiness, deployment,
internal support console, demo workspace, final audit, release candidate.
This horizon is about correctness, trust, and operability at commercial
scale, not new end-user surface area.

## How the roadmap is used

- Each phase in the [phase tracker](../docs/project/phase-tracker.md) has
  explicit entry/exit criteria — a phase does not start until its
  dependencies are marked complete, and does not close until its exit
  criteria are verifiably met.
- The roadmap is revisited when [assumptions and risks](assumptions-and-risks.md)
  materially change (e.g. a pricing hypothesis is invalidated, a
  regulatory requirement is discovered).
- No phase after Phase 4 begins implementation before this document,
  the phase tracker, and the relevant architecture documents agree on
  scope.

## Related documents

- [Phase tracker](../docs/project/phase-tracker.md)
- [Release plan](release-plan.md)
- [Vision](vision.md)

# Notifications

In-app notification feed, a provider-neutral email adapter, and
delivery triggers tied to the event model, per
[integration-architecture.md](integration-architecture.md)'s "Email"
adapter and [phase-tracker.md](../project/phase-tracker.md)'s Phase 16
entry. Implemented in Phase 16
([src/lib/services/notifications.ts](../../src/lib/services/notifications.ts),
[src/lib/notifications/](../../src/lib/notifications/),
[src/lib/jobs/notification-handlers.ts](../../src/lib/jobs/notification-handlers.ts)).

## No real email provider is configured in this environment

Same posture as Phase 13's `ANTHROPIC_API_KEY`: only a placeholder
`EMAIL_PROVIDER_API_KEY=replace-me` exists in `.env.local`. Everything
in this phase is built and tested against deterministic mocks; live
Resend delivery is unverified end-to-end until a real key is supplied.
**Live email delivery is not marked production-verified by this
phase.** In-app notifications (the feed, unread counts, mark-read) work
regardless — email is one channel, not a dependency of the feature.

## Provider-neutral email adapter

`src/lib/notifications/adapter.ts` defines `EmailProvider` (one method,
`send(message)`), mirroring `src/lib/ai/adapter.ts`'s pattern for the
AI provider (ADR-0008). `providers/resend-provider.ts` is the one
concrete implementation — a direct `fetch()` call to Resend's HTTP API
rather than the `resend` SDK, keeping this on the same "no new
dependency for a single JSON POST endpoint" footing as
`src/lib/services/csv.ts`. `get-provider.ts` is the one place that
names a concrete provider; every caller goes through
`getEmailProvider()`, never a vendor call directly.

`availability.ts`'s `isEmailConfigured()` treats
`EMAIL_PROVIDER_API_KEY`/`EMAIL_FROM_ADDRESS` as unset when either is
missing, empty, or still the literal `.env.local` placeholder — the
same check `isAiConfigured()` established for `ANTHROPIC_API_KEY`.

## No fake successful sends

Every send is recorded as a `notification_deliveries` row with an
explicit status: `pending` → `sent` (real provider success,
`provider_message_id` recorded) or `failed` (real provider error,
retried per the background-job worker's own backoff) — or, when the
environment has no real credential, `skipped_not_configured`, set
without throwing so a static misconfiguration doesn't retry every
notification in the environment forever into a dead letter. A `skipped_preference`
status marks a delivery that was never attempted because the recipient
opted out of email for that notification type. None of these ever
fabricate a `sent` status.

## Data model

- **`notifications`** — the in-app feed. One row per event, always
  created regardless of the recipient's email preference (email and
  in-app are independent channels in this phase; in-app is not itself
  preference-gated). Own-resource RLS: a recipient sees only their own
  rows.
- **`notification_deliveries`** — one row per (notification, channel)
  send attempt, written exclusively by the `deliver-notification-email`
  background job via the admin client (no `authenticated`-role
  insert/update grant, mirroring `webhook_events`). Read-only visibility
  for `audit.view` holders — delivery status is an operational/
  compliance concern, not a personal-inbox one.
- **`notification_preferences`** — `member_id is null` rows are the
  organization default for a `notification_type`; non-null rows are a
  specific member's override. Two partial unique indexes (rather than
  one plain unique constraint) because Postgres treats every `NULL` as
  distinct under a normal unique constraint. Writing an org-default row
  requires `organization.settings` (reused, not a new permission);
  writing your own override requires only being that member.

## Delivery flow

`createNotification()` (`src/lib/services/notifications.ts`) is the
one entry point every trigger calls, from within its own already-open
transaction — same "trusted caller inside an already-authorized
transaction" posture as `recordAuditEvent()`/`enqueueJob()`. It inserts
the `notifications` row, resolves the effective email preference
(member override → org default → `true`), and if enabled, inserts a
`pending` `notification_deliveries` row and enqueues a
`deliver-notification-email` background job keyed by the delivery's id
— never sends synchronously inside the triggering transaction.

`src/lib/jobs/notification-handlers.ts`'s job handler is idempotent
("check status before acting," the same shape as `evidence.ts`'s
`expireEvidence()`/`waivers.ts`'s `expireWaiver()`): a delivery already
`sent` or `skipped_*` is a no-op on a retried/duplicate job claim.
`failed` is deliberately **not** treated as final, so the worker's own
exponential-backoff/dead-letter mechanics
(`src/lib/jobs/worker.ts`) can retry a transient provider error up to
the job's `max_attempts` — this handler does not reimplement retry
policy, it reuses the one every other job type already has.

## Delivery triggers

Per the phase goal's four named categories — assignments, approvals,
deadlines, and exceptions — wired at one representative call site each,
not exhaustively at every possible sub-path:

- **Assignment** — `workflow-engine.ts`'s `activateNode()`, when a task
  is created with a directly-resolved `assignee_member_id`.
- **Approval requested** — `approval-resolution.ts`'s
  `createApprovalDecisions()`, notifying every resolved approver when
  the chain opens. Known simplification: this does not yet distinguish
  a sequential policy's later-turn approvers from the approver whose
  turn is actually open — everyone resolved is notified up front, only
  their actual turn to act is still gated by the approval RLS/action
  layer itself.
- **Deadline** — `escalation.ts`'s `checkTaskReminders()` (a reminder
  threshold firing → `deadline_approaching`) and `checkTaskEscalations()`
  (a past-due escalation level firing with a resolved target →
  `deadline_breached`).
- **Exception** — `exceptions.ts`'s `createException()` (an owner set
  at creation) and `triageException()` (an owner newly assigned during
  triage) → `exception_assigned`.

## Known gaps

- Only the four trigger categories above are wired; other plausible
  notification moments (e.g. CAPA plan approval, certification
  expiring, AI draft ready) are not — a deliberate v1 scope bound, not
  an oversight, left for follow-up once real delivery is verified end
  to end.
- No digest/batching — every triggering event schedules its own
  delivery job immediately; a burst of assignments produces a burst of
  emails, not a single summary.
- In-app visibility is not itself preference-gated (only the email
  channel is) — there is no "hide this type from my feed entirely"
  setting in this phase.

## Related documents

- [Integration architecture](integration-architecture.md)
- [Event model](event-model.md)
- [AI architecture](ai-architecture.md) — the sibling provider-neutral
  adapter this one's structure mirrors
- [ADR-0009: Provider-neutral background jobs](decisions/0009-provider-neutral-background-jobs.md)

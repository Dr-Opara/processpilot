# User Journeys

Representative end-to-end journeys through the [product loop](vision.md),
one per key persona. These drive prioritization and are the basis for
future end-to-end (Playwright) test coverage.

## 1. Process owner: from source document to published process

1. Process owner (or admin) uploads an existing SOP as a knowledge
   document (`knowledge.create`).
2. AI proposes structured process steps extracted from the document
   (`ai.use`) — a draft only.
3. Process owner reviews, edits, and reorders the proposed steps
   (`process.edit`).
4. Process owner submits the process for review (`process.review`), or
   publishes directly if self-reviewing is permitted for their scope.
5. Process is published as version 1 (`process.publish`) — immutable from
   this point; further edits create version 2.

## 2. Manager: assigning and monitoring a workflow

1. Manager selects a published process and starts a workflow
   (`workflow.start`), targeting a location, team, or individual employees.
2. Manager assigns specific tasks within the workflow (`workflow.assign`).
3. Manager monitors progress from **My Work**-equivalent team views and
   **Analytics** (`analytics.view`, scoped).
4. A task misses its deadline; an exception is automatically created.
   Manager triages it (`exception.manage`) and assigns a corrective action.

## 3. Employee: executing an assigned task

1. Employee opens **My Work** and sees a task assigned to them
   (`workflow.complete`).
2. Employee completes the task: fills out an attached form
   (`form.submit`), uploads a required photo as evidence
   (`evidence.upload`).
3. If the task includes an approval step, the assigned approver is
   notified; the employee sees the task move to "awaiting approval."
4. Task is marked complete once approved; it disappears from the
   employee's active queue and becomes part of their completion history.

## 4. Compliance professional: preparing for an external audit

1. Compliance professional filters **Audit** to a specific process and
   date range (`audit.view`).
2. Reviews evidence and approval records attached to completed workflow
   instances (`evidence.review`).
3. Exports the audit trail for the auditor (`audit.export`).
4. Grants a scoped, time-boxed `auditor` role to the external reviewer
   limited to the relevant processes and date range.

## 5. Auditor: reviewing evidence within a granted scope

1. Auditor signs in with a role scoped to a specific set of processes and
   a date range.
2. Auditor reviews workflow completion history, evidence, and approvals
   read-only (`audit.view`, `evidence.review`).
3. Access automatically expires at the end of the granted engagement
   window; no manual revocation step required (though available).

## 6. External user: completing a single assigned form

1. External user (e.g. a vendor) receives an invitation link scoped to
   one workflow task.
2. They authenticate via a lightweight, resource-specific flow — no
   standing organizational account.
3. They see only the one form or approval they were invited to act on,
   submit it (`form.submit`), and their session access ends.

## 7. Organization admin: onboarding a new employee

1. Admin invites a new member (`member.invite`), assigning role,
   department, and location.
2. New member's required training is auto-assigned based on their role
   and department (`training.manage` configuration triggers
   `training.view` assignment for the new member).
3. New member completes onboarding training and certification before
   being assigned live workflow tasks in a safety- or compliance-relevant
   department.

## 8. Operations leader: analyzing performance and closing the loop

1. Operations leader reviews cross-process analytics: completion rate,
   average cycle time, exception rate by location (`analytics.view`).
2. Leader identifies a process with elevated exception rates.
3. Leader (or the accountable process owner) uses AI-assisted process
   improvement suggestions, grounded in the actual exception history
   (`ai.use`), to propose a revised process version.
4. Revised process goes through review and publish again, closing the
   loop back to step 1 of the product loop.

## Related documents

- [Vision — the product loop](vision.md)
- [Personas](personas.md)
- [Feature catalog](feature-catalog.md)

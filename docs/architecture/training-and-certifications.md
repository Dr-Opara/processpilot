# Training and Certifications

Course authoring/versioning, assignment (role/department/team/
individual), completion tracking with an optional embedded assessment,
and certification issuance/expiry/renewal, per
[domain-model.md](domain-model.md)'s `TrainingCourse -> TrainingAssignment
-> Certification` relationship. Implemented in Phase 12
([src/lib/services/training-courses.ts](../../src/lib/services/training-courses.ts),
[training-assessment.ts](../../src/lib/services/training-assessment.ts),
[training-assignments.ts](../../src/lib/services/training-assignments.ts),
[certifications.ts](../../src/lib/services/certifications.ts)).

## Courses and versions

A `TrainingCourse` follows the same mutable-shell/immutable-published-
version split [ADR-0011](decisions/0011-immutable-published-versions.md)
established for Document/Process/Form —
[forms-and-evidence.md](forms-and-evidence.md) is the closest precedent.
`training_courses` is the shell (title, description, category, owner,
`current_version_id`); `training_course_versions` holds the actual
content, one immutable-once-published version at a time. `status`:
`draft` → `published` → `superseded`, enforced by the same
"published rows are frozen, only a title/content-preserving transition
to `superseded` is allowed" trigger `form_versions` uses.

A version optionally carries a multiple-choice assessment
(`has_assessment`, `assessment_questions`, `passing_score_percent`) —
`training-assessment.ts`'s `scoreAssessment()` is deliberately a plain
scoring function (one correct option per question, no partial credit,
no branching), not a general assessment engine. The course-detail
route's assessment-question editor is a raw JSON textarea, same
simplification Phase 9's process-builder field-settings editor already
established for structured-but-nested input.

## Assignment

`training-assignments.ts`'s `assignTraining()` fans a **published**
course version out to one `training_assignments` row per member
resolved from an assignment rule (`individual`/`role`/`department`/
`team`) via `resolveTrainingAssignees()` — the training-specific
counterpart to [approvals-and-slas.md](approvals-and-slas.md)'s
`resolveMemberIdsForRule()`, which resolves to a single owner/manager
rather than every member of a department/team/role. One row per
`(course_version, assignee)` (`unique` constraint) — re-running the
same assignment rule is a no-op for members already assigned, not a
duplicate.

### Lifecycle

`status`: `assigned` → `in_progress` → `completed`, with `overdue`
(reached automatically, see below) and `waived` (an explicit
`training.manage` override with a required reason) as side states.
`completeTrainingAssignment()` scores the linked assessment (or treats
a version with no assessment as an automatic pass), and on a pass,
issues a certification for the parent course via
`certifications.ts`'s `issueCertification()` — called from within the
same transaction, same "no separate permission gate for a
system-triggered write" posture Phase 10/11's job-triggered inserts
already established. A failed attempt leaves the assignment `assigned`
(not a separate `failed` status) so the same completion form can be
resubmitted directly — `retakeTrainingAssignment()` exists as an
explicit reset action for a manager-initiated retake, distinct from
the learner just resubmitting.

`training.complete` (new this phase) is the assignee's own
narrower grant for starting/completing/retaking _their own_
assignment — distinct from `training.manage` (creating courses,
assigning to others, waiving, issuing/renewing/revoking
certifications), the same "own resource, narrower permission" pattern
`workflow.complete` draws against `workflow.manage`.

### Overdue detection

A due assignment's `training-assignment-overdue-check` job is
scheduled per-assignment at `assignTraining()` time (when a `dueAt` is
given), same per-record scheduling pattern Phase 9's
`evidence-expiration-check` and Phase 11's `waiver-expiration-check`
use rather than a periodic sweep — `markAssignmentOverdue()` is
idempotent, a no-op if the assignment was since completed/waived or is
no longer past its due date.

## Certifications

`certifications.ts`'s `issueCertification()` records `issued_at`, a
nullable `expires_at` (nullable is itself the explicit "does not
expire" choice — `issueCertification()` has no default, so omitting it
is deliberate, never accidental), and links back to the
`training_assignment` that earned it. `renewCertification()` inserts a
**new** row chained via `renewed_from_certification_id` rather than
mutating the expiring one in place, so a member's full certification
history stays traceable. `revokeCertification()` requires a reason and
only applies to an `active` certification. The
`certification-expiry-check` background job (scheduled per-certification
at issuance/renewal, same pattern as the overdue check above) flips an
active certification to `expired` once past its `expires_at`.

## Tenant isolation, RLS, and authorization

All 5 new tables (`training_courses`, `training_course_versions`,
`training_assignments`, `training_assignment_history`,
`certifications`) have RLS enabled and an `organization_id` policy,
following [multi-tenancy.md](multi-tenancy.md). Permissions:
`training.view`/`training.manage` (already reserved since Phase 0,
first used by this phase) plus the new `training.complete`. Every
mutating service call goes through `requirePermission()` before
`withTenantContext()`, except `issueCertification()`/
`markAssignmentOverdue()`/`expireCertification()`, called from within
an already-open transaction by trusted service/job code — same posture
every other phase's system-triggered writes already established.

## Known gaps

Course content is a single markdown/plain-text field, not a structured
authoring/media pipeline — "course authoring/import" per this phase's
deliverables, not a full LMS content model. No notification delivery
for assignment/due-date/certification-expiry events — Phase 16's job,
same deferred posture as every prior phase. No reminder emails before a
due date (only the overdue transition itself is automatic).

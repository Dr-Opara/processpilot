# Forms and Evidence

Reusable dynamic forms and governed evidence capture, layered on top of
Phase 8's workflow engine per
[workflow-engine.md](workflow-engine.md#node-types)'s `form`/`evidence`
node-type entries. Implemented in Phase 9
([src/lib/services/forms.ts](../../src/lib/services/forms.ts),
[form-submissions.ts](../../src/lib/services/form-submissions.ts),
[evidence.ts](../../src/lib/services/evidence.ts)).

## Forms

A `Form` follows the same mutable-shell/immutable-version split
[ADR-0011](decisions/0011-immutable-published-versions.md) established
for `Process` and `Document`, without a separate review stage — `form.edit`
and `form.publish` are still distinct permissions, so authoring and
publishing stay separable duties even without one.

- `forms` — the shell: title, description, category, owner, department
  scope, `current_version_id`, `status` (`draft`/`published`/`archived`).
- `form_versions` — one immutable-once-published version per form.
  `status`: `draft` → `published` → `superseded`. A published version's
  `title`/`definition` can never change (enforced by a DB trigger,
  same pattern as `document_versions`/`process_versions`); publishing a
  replacement supersedes the prior one and repoints
  `forms.current_version_id`.
- `definition` is `{ fields: FormFieldDefinition[] }` — see
  [form-schema.ts](../../src/lib/services/form-schema.ts) for the full
  shape. Supported field types: `text`, `number`, `date`, `select`,
  `checkbox`, `file`, `table`, `signature`. A `table` field's `columns`
  are the only nesting allowed (one level; a column may not itself be
  `table`/`file`/`signature`).

### Conditional visibility and validation

A field's `visibleWhen` is a small condition string,
`<fieldKey> <op> <value>` (`==`, `!=`, `>`, `>=`, `<`, `<=`), evaluated
against the submission's own answers — deliberately not a general
expression language, mirroring
[workflow-condition.ts](../../src/lib/services/workflow-condition.ts)'s
grammar. A field hidden by `visibleWhen` is never required, regardless of
its own `required` flag. `validateAnswers()` runs in two modes: draft
save type-checks whatever's present but doesn't require anything; final
submit additionally requires every _visible_ required field. Text and
table-cell string values are rejected if they'd read as a spreadsheet
formula on export (leading `=`/`+`/`-`/`@` — OWASP CSV-injection
guidance), even though no CSV/XLSX export exists yet in this phase.

### Linking a form to a process step

A `form`-type `ProcessNode`'s `data.formId` (optional) references a real
`Form`. When set, `workflow-engine.ts`'s `activateNode()` snapshots the
form's _current published version_ onto `tasks.form_version_id` at
task-creation time — the same immutable-reference pattern
`workflows.process_version_id` already uses, so a form republished
mid-instance never changes what an in-flight task renders. A `form` node
without a linked form (or a task predating this feature) still completes
generically via `completeTask()`, exactly as Phase 8 left it.

### Submissions

`form_submissions` ties one member's answers to the exact `workflow`,
`task`, `process_version`, and `form_version` involved — never a
standalone/unlinked submission. `status`: `draft` (in progress,
mutable) → `submitted` (immutable, enforced by a DB trigger). `submitForm()`
validates every visible required field, then does everything
`completeTask()` does (status/output update, `task_history`, audit event,
`advanceFrom()`) inside the same transaction, using the validated
answers as the task's `output`.

**Amendments.** A submitted row is never edited in place. `amendForm()`
creates a new row (`amends_submission_id` pointing at the original,
`amendment_reason` required) and sets the original's
`superseded_by_submission_id` — the one mutation a submitted row still
allows. The full chain is preserved for audit; only the original
submitter or a `workflow.manage` holder may amend.

## Evidence

Private file uploads with integrity hashing, review, and full
chain-of-custody logging, stored in a dedicated `evidence` Supabase
Storage bucket (private, no Storage-level RLS — same posture as
`knowledge-documents`, see [file-storage.md](file-storage.md)) via
[evidence-storage.ts](../../src/lib/services/evidence-storage.ts).

- Attached to a task directly (an `evidence` node) and/or to a specific
  field of a form submission (a `file`-type field — the form's answer
  never carries raw bytes, only `{ evidenceId }`; `submitForm()`
  cross-checks that the referenced evidence row genuinely exists, belongs
  to the organization, and is attached to that task before accepting a
  final submit).
- `sha256_hash` is computed server-side from the actual uploaded bytes,
  never trusted from the client — see
  [evidence-upload-validation.ts](../../src/lib/services/evidence-upload-validation.ts)
  for the signature-based file-type detection (images, PDF, MP4,
  DOCX/XLSX/PPTX, plain text/CSV — the same "verify actual bytes, not the
  declared extension" posture as `document-parsing.ts`).
- `status`: `pending_review` → `accepted` | `rejected`, or → `expired`
  (past `expires_at`, checked by the `evidence-expiration-check`
  background job — same job-adapter pattern as Phase 8's
  `workflow-deadline-check`) → `replaced` (a new upload supersedes a
  rejected/expired one; the old file is never overwritten, only its
  `status` changes — file-storage.md principle 3).
- The file itself (`storage_path`/`sha256_hash`/`original_filename`/
  `mime_type`/`file_size_bytes`) is immutable once inserted, enforced by
  a DB trigger — only the review/lifecycle columns may change afterward.
- `evidence_events` is the append-only chain-of-custody log
  (`uploaded`/`downloaded`/`accepted`/`rejected`/`replaced`/`expired`),
  same shape as Phase 8's `workflow_history`/`task_history`. Every
  signed download URL issuance is logged as a `downloaded` event.
- `evidence.review` is a distinct permission from `evidence.upload` —
  the uploader cannot accept/reject their own file.

## Permissions

`form.view`/`form.create`/`form.edit`/`form.publish` (builder-side,
added this phase — see
[permissions-matrix.md](../../product/permissions-matrix.md));
`form.submit`/`evidence.upload`/`evidence.review` (runtime, seeded since
Phase 4's original matrix).

## Routes

- `/app/forms`, `/app/forms/new`, `/app/forms/[formId]`,
  `/app/forms/[formId]/edit` — the form builder.
- `/app/tasks/[taskId]` — renders the linked form (if any) via
  `DynamicFormRenderer`, or the evidence upload/review panel for an
  `evidence` node.
- `/app/evidence/upload` (POST), `/app/evidence/[evidenceId]/download`
  (GET, signed-URL redirect) — the only two evidence file-transfer
  endpoints; both re-run their own `requirePermission()`/ownership check
  independent of whatever page linked to them.
- A `form` node in the process builder gains a "Linked form" selector
  (`NodeConfigPanel.tsx`) alongside Phase 7's generic field list, which
  still applies when no form is linked.

## Known gaps

- No malware/virus scanning is wired up for evidence uploads, same
  deferred posture as knowledge-document uploads (`scan_status` sits at
  `pending_scan` until a scanner is chosen).
- An `evidence` node's task still completes generically via
  `completeTask()` — the workflow does not block advancement pending
  evidence acceptance; that gating is not part of this phase's scope.
- The process builder's field editor for `table`/`select`/etc.
  type-specific settings is a raw JSON textarea (`FormBuilder.tsx`), not
  a fully visual sub-editor.

## Related documents

- [Workflow engine](workflow-engine.md)
- [File storage](file-storage.md)
- [ADR-0011: Immutable published document and process versions](decisions/0011-immutable-published-versions.md)

/**
 * Hand-maintained interim types for the tables Phase 4 code actually
 * queries. Regenerate and replace this file with
 * `supabase gen types typescript --linked > src/lib/db/database.types.ts`
 * once a Supabase project exists and the migrations in
 * supabase/migrations/ have been applied to it (see
 * docs/development/database-migrations.md) — keep this file's shape in
 * sync with the migrations until then.
 */

export interface ProfileRow {
  id: string;
  clerk_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrganizationRow {
  id: string;
  clerk_org_id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  industry: string | null;
  employee_count_range: string | null;
  website_url: string | null;
  country: string | null;
  primary_use_case: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export type OnboardingStep =
  | "welcome"
  | "company_profile"
  | "locations"
  | "departments"
  | "teams"
  | "invite_employees"
  | "review"
  | "finished";

export interface OrganizationSettingsRow {
  id: string;
  organization_id: string;
  timezone: string;
  locale: string;
  date_format: string;
  week_start: "sunday" | "monday";
  settings: Record<string, unknown>;
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  onboarding_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type OrganizationMemberStatus = "active" | "suspended" | "removed";

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  profile_id: string;
  clerk_membership_id: string;
  clerk_role: string | null;
  status: OrganizationMemberStatus;
  job_title: string | null;
  start_date: string | null;
  location_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface RoleRow {
  id: string;
  organization_id: string | null;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export interface PermissionRow {
  id: string;
  key: string;
  description: string;
  created_at: string;
}

export type RolePermissionScope = "scoped" | null;

export interface RolePermissionRow {
  role_id: string;
  permission_id: string;
  scope: RolePermissionScope;
  created_at: string;
}

export interface MemberRoleAssignmentRow {
  id: string;
  organization_id: string;
  organization_member_id: string;
  role_id: string;
  created_at: string;
  created_by: string | null;
}

export type AuditEventSource = "app" | "webhook" | "system";

export interface AuditEventRow {
  id: string;
  organization_id: string;
  actor_profile_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  correlation_id: string | null;
  source: AuditEventSource;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OrganizationLocationRow {
  id: string;
  organization_id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  timezone: string | null;
  manager_member_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export interface DepartmentRow {
  id: string;
  organization_id: string;
  location_id: string | null;
  parent_department_id: string | null;
  owner_member_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export interface TeamRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  location_id: string | null;
  manager_member_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export interface TeamMemberRow {
  id: string;
  organization_id: string;
  team_id: string;
  organization_member_id: string;
  created_at: string;
  created_by: string | null;
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface OrganizationInvitationRow {
  id: string;
  organization_id: string;
  clerk_invitation_id: string | null;
  email: string;
  role_id: string | null;
  location_id: string | null;
  department_id: string | null;
  team_id: string | null;
  personal_message: string | null;
  status: InvitationStatus;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  expires_at: string | null;
}

export interface FeatureFlagRow {
  id: string;
  organization_id: string;
  key: string;
  enabled: boolean;
  value: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type MemberImportBatchStatus = "processing" | "completed" | "failed" | "partially_failed";

export interface MemberImportBatchRow {
  id: string;
  organization_id: string;
  status: MemberImportBatchStatus;
  total_rows: number;
  succeeded_rows: number;
  failed_rows: number;
  duplicate_rows: number;
  original_filename: string | null;
  created_at: string;
  completed_at: string | null;
  created_by: string | null;
}

export type MemberImportRowStatus = "pending" | "succeeded" | "failed" | "duplicate_skipped";

export interface MemberImportRowRow {
  id: string;
  organization_id: string;
  batch_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  status: MemberImportRowStatus;
  error_message: string | null;
  invitation_id: string | null;
  created_at: string;
}

export interface IdempotencyKeyRow {
  id: string;
  organization_id: string | null;
  scope: string;
  key: string;
  response_snapshot: Record<string, unknown> | null;
  created_at: string;
  expires_at: string | null;
}

export type KnowledgeDocumentStatus = "draft" | "in_review" | "published" | "archived";

export interface KnowledgeDocumentRow {
  id: string;
  organization_id: string;
  title: string;
  category: string | null;
  tags: string[];
  owner_member_id: string | null;
  department_id: string | null;
  status: KnowledgeDocumentStatus;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export type DocumentVersionSource = "authored" | "uploaded";
export type DocumentVersionScanStatus = "pending_scan" | "clean" | "flagged";
export type DocumentVersionStatus = "draft" | "in_review" | "published" | "superseded" | "rejected";

export interface DocumentVersionRow {
  id: string;
  organization_id: string;
  document_id: string;
  department_id: string | null;
  version_number: number;
  title: string;
  source: DocumentVersionSource;
  content: string | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  extracted_text: string | null;
  scan_status: DocumentVersionScanStatus;
  status: DocumentVersionStatus;
  review_notes: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  created_by: string | null;
}

export type ProcessStatus = "draft" | "in_review" | "approved" | "published" | "archived";

export interface ProcessRow {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  owner_member_id: string | null;
  department_id: string | null;
  location_id: string | null;
  team_id: string | null;
  sla_hours: number | null;
  effective_from: string | null;
  effective_until: string | null;
  source_document_ids: string[];
  status: ProcessStatus;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

/**
 * The version review pipeline separates "a reviewer approved this"
 * from "someone published it" — `in_review` -> `approved` (process.review)
 * -> `published` (process.publish) — rather than combining both into
 * one action, so an approved version can be held back from publishing
 * (e.g. pending an effective date) without re-running review.
 */
export type ProcessVersionStatus =
  "draft" | "in_review" | "approved" | "published" | "superseded" | "rejected";

export type ProcessNodeType =
  | "start"
  | "end"
  | "human_task"
  | "approval"
  | "decision"
  | "parallel_split"
  | "parallel_join"
  | "timer"
  | "notification"
  | "subprocess"
  | "form"
  | "evidence"
  | "system_action";

export type ProcessNodeAssigneeType = "role" | "team";

export interface ProcessNodeFormField {
  label: string;
  type: "text" | "number" | "checkbox";
}

/**
 * Per-node configuration — which fields are meaningful depends on
 * `ProcessNode.type` (e.g. only human_task/approval read
 * assigneeType/assigneeRoleId/assigneeTeamId; only form reads
 * formFields; only timer reads timerDurationMinutes). Kept as one
 * flexible shape rather than a discriminated union so the canvas
 * editor can change a node's type in place without discarding
 * unrelated config the author already entered.
 */
export interface ProcessNodeData {
  label: string;
  /** Read for human_task/approval nodes — the approver on an "approval" node is simply its assignee. */
  assigneeType?: ProcessNodeAssigneeType | null;
  assigneeRoleId?: string | null;
  assigneeTeamId?: string | null;
  required?: boolean;
  /** Read for "form" nodes. */
  formFields?: ProcessNodeFormField[];
  /** Read for "form" nodes — links this step to a specific, real Form (Phase 9). Falls back to the generic formFields/output capture when unset, per workflow-engine.ts. */
  formId?: string | null;
  /** Read for "approval" nodes — links this step to a configurable multi-approver ApprovalPolicy (Phase 10). Falls back to Phase 8's single-assignee decision when unset. */
  approvalPolicyId?: string | null;
  /** Read for any node type that carries a due date (human_task/approval/form/evidence/timer) — resolves a business-calendar-aware due_at via sla.ts (Phase 10) instead of a bare timerDurationMinutes-style offset. */
  slaDefinitionId?: string | null;
  /** Read for "evidence" nodes. */
  evidenceDescription?: string | null;
  /** Read for "timer" nodes. */
  timerDurationMinutes?: number | null;
  /** Read for "notification" nodes. */
  notificationMessage?: string | null;
  /** Read for "subprocess" nodes — the referenced process's id. */
  subprocessId?: string | null;
  /** Read for "system_action" nodes. */
  systemActionType?: string | null;
}

export interface ProcessNode {
  id: string;
  type: ProcessNodeType;
  position: { x: number; y: number };
  data: ProcessNodeData;
}

export interface ProcessEdge {
  id: string;
  source: string;
  target: string;
  label?: string | null;
  /** Free-text branch condition — read by Phase 8 off a decision node's outgoing edges. */
  condition?: string | null;
}

/**
 * The graph Phase 8's workflow engine reads to instantiate a running
 * Workflow: nodes carry type/position/config, edges carry the
 * sequencing (including decision branch conditions). Server-side
 * validation (process-graph-validation.ts) enforces reachability, a
 * single start, at least one reachable end, no cycles, and
 * type-specific required config before a version can be reviewed.
 */
export interface ProcessGraphDefinition {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

export interface ProcessVersionRow {
  id: string;
  organization_id: string;
  process_id: string;
  department_id: string | null;
  version_number: number;
  title: string;
  definition: ProcessGraphDefinition;
  status: ProcessVersionStatus;
  review_notes: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  created_by: string | null;
}

export type WebhookEventStatus = "processed" | "rejected" | "failed";

export interface WebhookEventRow {
  id: string;
  clerk_event_id: string;
  event_type: string;
  status: WebhookEventStatus;
  organization_id: string | null;
  received_at: string;
  processed_at: string | null;
  error_message: string | null;
}

export type BackgroundJobStatus = "pending" | "processing" | "succeeded" | "failed" | "dead_letter";

export interface BackgroundJobRow {
  id: string;
  organization_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: BackgroundJobStatus;
  priority: number;
  scheduled_at: string;
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  last_error_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type WorkflowStatus = "running" | "suspended" | "completed" | "cancelled" | "failed";

export interface WorkflowRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  process_id: string;
  process_version_id: string;
  title: string;
  status: WorkflowStatus;
  started_by: string | null;
  started_at: string;
  due_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  suspended_at: string | null;
  suspended_by: string | null;
  failure_reason: string | null;
  restarted_from_workflow_id: string | null;
  parent_task_id: string | null;
  created_at: string;
  sla_definition_id: string | null;
}

export type TaskStatus =
  "assigned" | "in_progress" | "completed" | "rejected" | "skipped" | "cancelled" | "failed";

export interface TaskRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  workflow_id: string;
  node_id: string;
  node_type: ProcessNodeType;
  label: string;
  required: boolean;
  status: TaskStatus;
  assignee_member_id: string | null;
  assignee_team_id: string | null;
  assignee_role_id: string | null;
  output: Record<string, unknown>;
  started_at: string;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  /** Set at task-creation time for a 'form' node whose ProcessNodeData.formId resolved to a published form — see workflow-engine.ts. */
  form_version_id: string | null;
  /** Set at task-creation time for an 'approval' node whose ProcessNodeData.approvalPolicyId is configured — see approvals.ts. */
  approval_policy_id: string | null;
  /** Set at task-creation time when ProcessNodeData.slaDefinitionId resolves due_at via a business calendar — see sla.ts. */
  sla_definition_id: string | null;
  /** Set while the SLA clock is paused (see sla.ts's pauseTaskSla) — the escalation job skips this task entirely until resumeTaskSla clears it. */
  sla_paused_at: string | null;
  /** Cumulative wall-clock minutes this task has spent paused, across every pause/resume cycle — informational only, not used in due_at math beyond the shift resumeTaskSla already applies. */
  sla_paused_minutes_total: number;
}

export interface WorkflowHistoryRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  workflow_id: string;
  event_type: string;
  actor_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TaskHistoryRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  workflow_id: string;
  task_id: string;
  event_type: string;
  actor_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type FormStatus = "draft" | "published" | "archived";

export interface FormRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: FormStatus;
  current_version_id: string | null;
  owner_member_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export type FormFieldType =
  "text" | "number" | "date" | "select" | "checkbox" | "file" | "table" | "signature";

export interface FormFieldOption {
  value: string;
  label: string;
}

/**
 * One field in a form_version's `definition` (see
 * [form-schema.ts](../services/form-schema.ts) for the zod schema that
 * validates this shape and the validation/conditional-visibility
 * engine that reads it). A `table` field's `columns` are the only
 * nesting allowed — a column may not itself be `table`/`file`/`signature`.
 */
export interface FormFieldDefinition {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  helpText?: string | null;
  visibleWhen?: string | null;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
  options?: FormFieldOption[];
  maxFileSizeBytes?: number;
  allowedMimeTypes?: string[];
  columns?: FormFieldDefinition[];
  minRows?: number;
  maxRows?: number;
}

export interface FormDefinition {
  fields: FormFieldDefinition[];
}

export type FormVersionStatus = "draft" | "published" | "superseded";

export interface FormVersionRow {
  id: string;
  organization_id: string;
  form_id: string;
  department_id: string | null;
  version_number: number;
  title: string;
  definition: FormDefinition;
  status: FormVersionStatus;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  created_by: string | null;
}

export type FormSubmissionStatus = "draft" | "submitted";

export interface FormSubmissionRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  workflow_id: string;
  task_id: string;
  process_version_id: string;
  form_version_id: string;
  member_id: string;
  status: FormSubmissionStatus;
  answers: Record<string, unknown>;
  amendment_reason: string | null;
  amends_submission_id: string | null;
  superseded_by_submission_id: string | null;
  submitted_at: string | null;
  created_at: string;
}

export type EvidenceScanStatus = "pending_scan" | "clean" | "flagged";
export type EvidenceStatus = "pending_review" | "accepted" | "rejected" | "expired" | "replaced";

export interface EvidenceRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  workflow_id: string | null;
  task_id: string | null;
  form_submission_id: string | null;
  field_key: string | null;
  uploaded_by: string | null;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  sha256_hash: string;
  scan_status: EvidenceScanStatus;
  status: EvidenceStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  expires_at: string | null;
  replaces_evidence_id: string | null;
  created_at: string;
}

export type EvidenceEventType =
  "uploaded" | "downloaded" | "accepted" | "rejected" | "replaced" | "expired";

export interface EvidenceEventRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  evidence_id: string;
  event_type: EvidenceEventType;
  actor_member_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ApprovalStrategy =
  "sequential" | "parallel" | "unanimous" | "majority" | "first_response" | "any_one";

export interface ApproverRule {
  type:
    | "user"
    | "role"
    | "manager"
    | "department_owner"
    | "process_owner"
    | "location_manager"
    | "team_manager"
    | "runtime_expression";
  value: string | null;
}

export type ApprovalPolicyStatus = "active" | "archived";

export interface ApprovalPolicyRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  name: string;
  strategy: ApprovalStrategy;
  approver_rules: ApproverRule[];
  allow_delegation: boolean;
  allow_abstain: boolean;
  prevent_self_approval: boolean;
  status: ApprovalPolicyStatus;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export type ApprovalDecisionStatus =
  "pending" | "approved" | "rejected" | "changes_requested" | "abstained" | "delegated";

export interface ApprovalDecisionRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  task_id: string;
  approval_policy_id: string;
  approver_member_id: string;
  sequence_order: number;
  status: ApprovalDecisionStatus;
  comment: string | null;
  decided_at: string | null;
  delegated_to_member_id: string | null;
  delegated_from_member_id: string | null;
  is_override: boolean;
  override_by_member_id: string | null;
  override_reason: string | null;
  created_at: string;
}

export interface BusinessCalendarRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  name: string;
  timezone: string;
  work_days: number[];
  work_start_minutes: number;
  work_end_minutes: number;
  created_at: string;
}

export interface BusinessCalendarHolidayRow {
  id: string;
  organization_id: string;
  calendar_id: string;
  holiday_date: string;
  name: string;
}

export type SlaTargetType = "task" | "approval" | "workflow";
export type SlaDefinitionStatus = "active" | "archived";

export interface SlaDefinitionRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  name: string;
  target_type: SlaTargetType;
  target_minutes: number;
  business_calendar_id: string | null;
  reminder_minutes_before_due: number[];
  created_at: string;
  status: SlaDefinitionStatus;
}

export type EscalationAction =
  "remind" | "reassign" | "escalate_manager" | "escalate_process_owner" | "escalate_admin";

export interface EscalationRuleRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  sla_definition_id: string;
  level: number;
  trigger_after_minutes_past_due: number;
  action: EscalationAction;
  reassign_target: ApproverRule | null;
  created_at: string;
}

export interface EscalationEventRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  task_id: string | null;
  workflow_id: string | null;
  escalation_rule_id: string | null;
  level: number;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

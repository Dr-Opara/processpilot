/**
 * Canonical action/resourceType strings for every user-initiated
 * (source: "app") audit event, so every service module calling
 * recordAuditEvent() uses the same spelling. Phase 4's
 * identity-sync.ts established the "resource.verb" / snake_case-singular-
 * resource-type convention this extends (see src/lib/db/audit.ts).
 * Started in Phase 5 (business onboarding and employee management);
 * extended in Phase 6 (knowledge management) for the document
 * import/authoring/governance loop, and in Phase 7 (process builder)
 * for the analogous process authoring/review/publish loop.
 */
export const AuditAction = {
  CompanyProfileChanged: "organization.profile_changed",
  OnboardingStepAdvanced: "organization.onboarding_step_advanced",
  OnboardingCompleted: "organization.onboarding_completed",

  LocationCreated: "location.created",
  LocationUpdated: "location.updated",
  LocationArchived: "location.archived",
  LocationRestored: "location.restored",

  DepartmentCreated: "department.created",
  DepartmentUpdated: "department.updated",
  DepartmentArchived: "department.archived",
  DepartmentRestored: "department.restored",

  TeamCreated: "team.created",
  TeamUpdated: "team.updated",
  TeamArchived: "team.archived",
  TeamRestored: "team.restored",

  InvitationCreated: "invitation.created",
  InvitationResent: "invitation.resent",
  InvitationRevoked: "invitation.revoked",
  InvitationAccepted: "invitation.accepted",

  MemberRoleChanged: "member.role_changed",
  MemberSuspended: "member.suspended",
  MemberRestored: "member.restored",
  MemberRemoved: "member.removed",
  MemberUpdated: "member.updated",
  OwnershipTransferred: "organization.ownership_transferred",

  ImportStarted: "member_import.started",
  ImportCompleted: "member_import.completed",
  ImportPartiallyFailed: "member_import.partially_failed",

  KnowledgeDocumentCreated: "knowledge_document.created",
  KnowledgeDocumentArchived: "knowledge_document.archived",
  KnowledgeDocumentRestored: "knowledge_document.restored",

  DocumentVersionCreated: "document_version.created",
  DocumentVersionUpdated: "document_version.updated",
  DocumentVersionSubmittedForReview: "document_version.submitted_for_review",
  DocumentVersionApproved: "document_version.approved",
  DocumentVersionRejected: "document_version.rejected",
  DocumentVersionPublished: "document_version.published",
  DocumentVersionSuperseded: "document_version.superseded",

  ProcessCreated: "process.created",
  ProcessUpdated: "process.updated",
  ProcessArchived: "process.archived",
  ProcessRestored: "process.restored",

  ProcessVersionCreated: "process_version.created",
  ProcessVersionUpdated: "process_version.updated",
  ProcessVersionSubmittedForReview: "process_version.submitted_for_review",
  ProcessVersionApproved: "process_version.approved",
  ProcessVersionRejected: "process_version.rejected",
  ProcessVersionPublished: "process_version.published",
  ProcessVersionSuperseded: "process_version.superseded",

  // source: "system" — recorded by the background-job worker
  // (src/lib/jobs/worker.ts), not a user action.
  BackgroundJobDeadLettered: "background_job.dead_lettered",

  // Phase 8 (Workflow execution engine). Only the governance-relevant
  // subset of workflow_history/task_history events per event-model.md —
  // the full instance timeline (including system-executed node visits)
  // lives in those two append-only tables, not audit_events.
  WorkflowStarted: "workflow.started",
  WorkflowCompleted: "workflow.completed",
  WorkflowFailed: "workflow.failed",
  WorkflowSuspended: "workflow.suspended",
  WorkflowResumed: "workflow.resumed",
  WorkflowCancelled: "workflow.cancelled",
  WorkflowRestarted: "workflow.restarted",
  // source: "system" — recorded by the deadline-check background job.
  WorkflowDeadlineBreached: "workflow.deadline_breached",
  TaskCompleted: "task.completed",
  TaskApprovalDecided: "task.approval_decided",
  TaskReassigned: "task.reassigned",

  // Phase 9 (Forms and evidence management).
  FormCreated: "form.created",
  FormArchived: "form.archived",
  FormRestored: "form.restored",

  FormVersionCreated: "form_version.created",
  FormVersionUpdated: "form_version.updated",
  FormVersionPublished: "form_version.published",
  FormVersionSuperseded: "form_version.superseded",

  FormSubmissionSaved: "form_submission.saved",
  FormSubmissionSubmitted: "form_submission.submitted",
  FormSubmissionAmended: "form_submission.amended",

  EvidenceUploaded: "evidence.uploaded",
  EvidenceDownloaded: "evidence.downloaded",
  EvidenceAccepted: "evidence.accepted",
  EvidenceRejected: "evidence.rejected",
  EvidenceReplaced: "evidence.replaced",
  // source: "system" — recorded by the evidence-expiration background job.
  EvidenceExpired: "evidence.expired",

  // Phase 10 (Approvals, SLAs, and escalations).
  ApprovalPolicyCreated: "approval_policy.created",
  ApprovalPolicyUpdated: "approval_policy.updated",
  ApprovalPolicyArchived: "approval_policy.archived",
  ApprovalPolicyRestored: "approval_policy.restored",
  ApprovalDelegated: "approval.delegated",
  ApprovalOverridden: "approval.overridden",
  SlaDefinitionCreated: "sla_definition.created",
  SlaDefinitionUpdated: "sla_definition.updated",
  BusinessCalendarCreated: "business_calendar.created",
  BusinessCalendarUpdated: "business_calendar.updated",
  EscalationRuleCreated: "escalation_rule.created",
  EscalationRuleDeleted: "escalation_rule.deleted",
  // source: "system" — recorded by the escalation-check background job.
  EscalationFired: "escalation.fired",
  TaskSlaPaused: "task.sla_paused",
  TaskSlaResumed: "task.sla_resumed",
  TaskDueAtRecalculated: "task.due_at_recalculated",

  // Phase 11 (Exceptions and CAPA).
  ExceptionCreated: "exception.created",
  ExceptionUpdated: "exception.updated",
  ExceptionTriaged: "exception.triaged",
  ExceptionSeverityChanged: "exception.severity_changed",
  ExceptionOwnerAssigned: "exception.owner_assigned",
  ExceptionInvestigationStarted: "exception.investigation_started",
  ExceptionRootCauseAdded: "exception.root_cause_added",
  ExceptionContainmentActionCreated: "exception.containment_action_created",
  ExceptionContainmentActionCompleted: "exception.containment_action_completed",
  ExceptionClosed: "exception.closed",
  ExceptionRejected: "exception.rejected",
  ExceptionReopened: "exception.reopened",
  CapaPlanCreated: "capa_plan.created",
  CapaPlanApproved: "capa_plan.approved",
  CapaPlanRejected: "capa_plan.rejected",
  CapaActionCompleted: "capa_action.completed",
  CapaEffectivenessCheckCompleted: "capa_effectiveness_check.completed",
  CapaPlanMarkedIneffective: "capa_plan.marked_ineffective",
  CapaPlanClosed: "capa_plan.closed",
  WaiverRequested: "waiver.requested",
  WaiverApproved: "waiver.approved",
  WaiverRejected: "waiver.rejected",
  WaiverRenewed: "waiver.renewed",
  WaiverRevoked: "waiver.revoked",
  // source: "system" — recorded by the waiver-expiration background job.
  WaiverExpired: "waiver.expired",

  // Phase 12 (Training and certifications).
  TrainingCourseCreated: "training_course.created",
  TrainingCourseVersionPublished: "training_course_version.published",
  TrainingAssignmentCreated: "training_assignment.created",
  TrainingAssignmentCompleted: "training_assignment.completed",
  TrainingAssignmentWaived: "training_assignment.waived",
  CertificationIssued: "certification.issued",
  CertificationRenewed: "certification.renewed",
  CertificationRevoked: "certification.revoked",
  // source: "system" — recorded by the certification-expiry-check background job.
  CertificationExpired: "certification.expired",

  // Phase 13 (AI ingestion and copilot).
  AiDraftGenerated: "ai_draft.generated",
  AiDraftAccepted: "ai_draft.accepted",
  AiDraftDismissed: "ai_draft.dismissed",

  // Phase 15 (Audit and compliance center). Exporting the audit log is
  // itself governance-relevant — who pulled a compliance export, and
  // when, is exactly the kind of question an audit trail exists to
  // answer — so it produces its own audit event.
  AuditEventsExported: "audit_events.exported",

  // Phase 17 (Billing and entitlements). Subscription state itself
  // (created/renewed/canceled by Stripe) is synced by the webhook
  // handler, not recorded as its own audit action here — the
  // subscriptions table row *is* the durable record of that. Only the
  // app-initiated request to cancel is audited, since Stripe doesn't
  // record "who, inside ProcessPilot, clicked cancel."
  SubscriptionCancellationRequested: "subscription.cancellation_requested",
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditResourceType = {
  Organization: "organization",
  Location: "organization_location",
  Department: "department",
  Team: "team",
  Invitation: "organization_invitation",
  Member: "organization_member",
  ImportBatch: "member_import_batch",
  KnowledgeDocument: "knowledge_document",
  DocumentVersion: "document_version",
  Process: "process",
  ProcessVersion: "process_version",
  BackgroundJob: "background_job",
  Workflow: "workflow",
  Task: "task",
  Form: "form",
  FormVersion: "form_version",
  FormSubmission: "form_submission",
  Evidence: "evidence",
  ApprovalPolicy: "approval_policy",
  SlaDefinition: "sla_definition",
  BusinessCalendar: "business_calendar",
  EscalationRule: "escalation_rule",
  Exception: "exception",
  CapaPlan: "capa_plan",
  TemporaryWaiver: "temporary_waiver",
  TrainingCourse: "training_course",
  TrainingAssignment: "training_assignment",
  Certification: "certification",
  AiDraft: "ai_draft",
  AuditExport: "audit_export",
  Subscription: "subscription",
} as const;

export type AuditResourceTypeValue = (typeof AuditResourceType)[keyof typeof AuditResourceType];

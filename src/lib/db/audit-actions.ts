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
  ProcessArchived: "process.archived",
  ProcessRestored: "process.restored",

  ProcessVersionCreated: "process_version.created",
  ProcessVersionUpdated: "process_version.updated",
  ProcessVersionSubmittedForReview: "process_version.submitted_for_review",
  ProcessVersionRejected: "process_version.rejected",
  ProcessVersionPublished: "process_version.published",
  ProcessVersionSuperseded: "process_version.superseded",
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
} as const;

export type AuditResourceTypeValue = (typeof AuditResourceType)[keyof typeof AuditResourceType];

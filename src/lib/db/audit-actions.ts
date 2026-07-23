/**
 * Canonical action/resourceType strings for every Phase 5 (Business
 * onboarding and employee management) audit event, so every service
 * module calling recordAuditEvent() uses the same spelling. Phase 4's
 * identity-sync.ts established the "resource.verb" / snake_case-singular-
 * resource-type convention this extends (see src/lib/db/audit.ts) — there
 * was no shared constants module yet because no user-initiated (source:
 * "app") audit event existed before this phase.
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
} as const;

export type AuditResourceTypeValue = (typeof AuditResourceType)[keyof typeof AuditResourceType];

import "server-only";
import { z } from "zod";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { ApprovalPolicyRow } from "@/lib/db/database.types";

/**
 * CRUD for reusable ApprovalPolicy records — unlike Form/Process/
 * Document, a policy is not versioned governed content (no draft/
 * published/immutable-version split): it's directly editable
 * configuration, closer in spirit to a role's permission set. A
 * process node references one by id (`ProcessNodeData.approvalPolicyId`);
 * workflow-engine.ts snapshots the *referenced row's current state*
 * onto the task at creation time via `tasks.approval_policy_id`, so an
 * edit here only ever affects workflows instantiated afterward.
 */
const approverRuleSchema = z.object({
  type: z.enum([
    "user",
    "role",
    "manager",
    "department_owner",
    "process_owner",
    "location_manager",
    "team_manager",
    "runtime_expression",
  ]),
  value: z.string().trim().min(1).nullable(),
});

export const approvalPolicyInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(300),
  strategy: z.enum([
    "sequential",
    "parallel",
    "unanimous",
    "majority",
    "first_response",
    "any_one",
  ]),
  approverRules: z.array(approverRuleSchema).min(1, "At least one approver rule is required."),
  allowDelegation: z.boolean().default(true),
  allowAbstain: z.boolean().default(false),
  preventSelfApproval: z.boolean().default(false),
  departmentId: z.string().uuid().optional().nullable(),
});

export type ApprovalPolicyInput = z.infer<typeof approvalPolicyInputSchema>;

function toTenantContext(membership: {
  organization: { id: string };
  member: { id: string };
  profile: { clerk_user_id: string };
}) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export interface ListApprovalPoliciesFilters {
  status?: "active" | "archived" | "all";
}

export async function listApprovalPolicies(
  filters: ListApprovalPoliciesFilters = {},
): Promise<ApprovalPolicyRow[]> {
  const membership = await getCurrentMembership();
  const status = filters.status ?? "active";
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<ApprovalPolicyRow[]>`
      select * from approval_policies
      where organization_id = ${membership.organization.id} and (${status === "all"} or status = ${status})
      order by name asc
    `,
  );
}

export async function getApprovalPolicy(policyId: string): Promise<ApprovalPolicyRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [policy] = await tx<ApprovalPolicyRow[]>`
      select * from approval_policies where id = ${policyId} and organization_id = ${membership.organization.id}
    `;
    if (!policy) throw new AppError("not_found", "Approval policy not found.");
    return policy;
  });
}

export async function createApprovalPolicy(input: ApprovalPolicyInput): Promise<ApprovalPolicyRow> {
  const data = approvalPolicyInputSchema.parse(input);
  const membership = await requirePermission("approval.manage", {
    scope: { departmentId: data.departmentId ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [policy] = await tx<ApprovalPolicyRow[]>`
      insert into approval_policies (
        organization_id, department_id, name, strategy, approver_rules, allow_delegation, allow_abstain,
        prevent_self_approval, created_by
      ) values (
        ${membership.organization.id}, ${data.departmentId ?? null}, ${data.name}, ${data.strategy},
        ${tx.json(data.approverRules as unknown as Parameters<typeof tx.json>[0])}, ${data.allowDelegation},
        ${data.allowAbstain}, ${data.preventSelfApproval}, ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApprovalPolicyCreated,
      resourceType: AuditResourceType.ApprovalPolicy,
      resourceId: policy.id,
      source: "app",
    });

    return policy;
  });
}

async function getOwnPolicyForWrite(policyId: string) {
  const preCheck = await getCurrentMembership();
  return withTenantContext(toTenantContext(preCheck), async (tx) => {
    const [policy] = await tx<ApprovalPolicyRow[]>`
      select * from approval_policies where id = ${policyId} and organization_id = ${preCheck.organization.id}
    `;
    if (!policy) throw new AppError("not_found", "Approval policy not found.");
    return policy;
  });
}

export async function updateApprovalPolicy(
  policyId: string,
  input: ApprovalPolicyInput,
): Promise<ApprovalPolicyRow> {
  const data = approvalPolicyInputSchema.parse(input);
  const existing = await getOwnPolicyForWrite(policyId);
  const membership = await requirePermission("approval.manage", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [policy] = await tx<ApprovalPolicyRow[]>`
      update approval_policies set
        name = ${data.name}, strategy = ${data.strategy},
        approver_rules = ${tx.json(data.approverRules as unknown as Parameters<typeof tx.json>[0])},
        allow_delegation = ${data.allowDelegation}, allow_abstain = ${data.allowAbstain},
        prevent_self_approval = ${data.preventSelfApproval}
      where id = ${policyId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApprovalPolicyUpdated,
      resourceType: AuditResourceType.ApprovalPolicy,
      resourceId: policyId,
      source: "app",
    });

    return policy;
  });
}

export async function archiveApprovalPolicy(policyId: string): Promise<ApprovalPolicyRow> {
  const existing = await getOwnPolicyForWrite(policyId);
  const membership = await requirePermission("approval.manage", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [policy] = await tx<ApprovalPolicyRow[]>`
      update approval_policies set status = 'archived', archived_at = now() where id = ${policyId} returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApprovalPolicyArchived,
      resourceType: AuditResourceType.ApprovalPolicy,
      resourceId: policyId,
      source: "app",
    });
    return policy;
  });
}

export async function restoreApprovalPolicy(policyId: string): Promise<ApprovalPolicyRow> {
  const existing = await getOwnPolicyForWrite(policyId);
  const membership = await requirePermission("approval.manage", {
    scope: { departmentId: existing.department_id ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [policy] = await tx<ApprovalPolicyRow[]>`
      update approval_policies set status = 'active', archived_at = null where id = ${policyId} returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApprovalPolicyRestored,
      resourceType: AuditResourceType.ApprovalPolicy,
      resourceId: policyId,
      source: "app",
    });
    return policy;
  });
}

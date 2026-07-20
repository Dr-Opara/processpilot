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
  created_at: string;
  updated_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export type OrganizationMemberStatus = "active" | "suspended" | "removed";

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  profile_id: string;
  clerk_membership_id: string;
  clerk_role: string | null;
  status: OrganizationMemberStatus;
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

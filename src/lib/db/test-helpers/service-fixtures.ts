import type { CurrentMembership } from "@/lib/authz";
import type { OrganizationMemberRow, OrganizationRow, ProfileRow } from "@/lib/db/database.types";

/**
 * Shared fixture builder for the Phase 5 service unit tests
 * (departments/locations/teams/members/invitations/organizations/roles/
 * member-import) — every one of those services calls
 * getCurrentMembership()/requirePermission() directly rather than taking
 * a membership as a parameter, so each test file mocks @/lib/authz and
 * seeds it with a CurrentMembership built here rather than duplicating
 * nine near-identical fixture objects.
 */
export function makeProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "profile-1",
    clerk_user_id: "user_1",
    email: "owner@example.com",
    first_name: "Ada",
    last_name: "Owner",
    avatar_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

export function makeOrganization(overrides: Partial<OrganizationRow> = {}): OrganizationRow {
  return {
    id: "org-1",
    clerk_org_id: "org_1",
    name: "Acme Co",
    slug: "acme-co",
    legal_name: null,
    industry: null,
    employee_count_range: null,
    website_url: null,
    country: null,
    primary_use_case: null,
    logo_url: null,
    stripe_customer_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    archived_at: null,
    ...overrides,
  };
}

export function makeOrganizationMember(
  overrides: Partial<OrganizationMemberRow> = {},
): OrganizationMemberRow {
  return {
    id: "member-1",
    organization_id: "org-1",
    profile_id: "profile-1",
    clerk_membership_id: "orgmem_1",
    clerk_role: "org:admin",
    status: "active",
    job_title: null,
    start_date: null,
    location_id: null,
    department_id: null,
    manager_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    ...overrides,
  };
}

export function makeMembership(
  overrides: {
    profile?: Partial<ProfileRow>;
    organization?: Partial<OrganizationRow>;
    member?: Partial<OrganizationMemberRow>;
    permissions?: string[];
    scopedPermissions?: string[];
  } = {},
): CurrentMembership {
  return {
    profile: makeProfile(overrides.profile),
    organization: makeOrganization(overrides.organization),
    member: makeOrganizationMember(overrides.member),
    permissions: overrides.permissions ?? [],
    scopedPermissions: overrides.scopedPermissions ?? [],
  };
}

import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/db/tenant-context";

/**
 * Resolves a `TenantContext` for a public-API request authenticated by
 * an API key rather than a Clerk session — there is no `auth()` cookie
 * to read, so `getCurrentMembership()` can't be used. A key acts as its
 * creator (`api_keys.created_by`): the RLS-visible permission set is
 * exactly that member's real role grants, dynamically re-checked on
 * every query the same way any session-based request is, not a
 * separate "API keys bypass RLS" path. Scope-checking (does this key's
 * `scopes` array include what the endpoint needs) happens in
 * authenticate.ts *before* this is ever called — this only establishes
 * *whose* RLS visibility the request runs under.
 */
export async function resolveApiTenantContext(
  organizationId: string,
  createdByProfileId: string | null,
): Promise<TenantContext> {
  if (!createdByProfileId) {
    throw new AppError("unavailable", "This API key has no associated member to act as.");
  }
  const sql = getAdminSql();
  const [row] = await sql<{ member_id: string; clerk_user_id: string }[]>`
    select om.id as member_id, p.clerk_user_id
    from organization_members om
    join profiles p on p.id = om.profile_id
    where om.organization_id = ${organizationId} and om.profile_id = ${createdByProfileId} and om.status = 'active'
    limit 1
  `;
  if (!row) {
    throw new AppError(
      "unavailable",
      "This API key's creator is no longer an active member of this organization.",
    );
  }
  return { organizationId, memberId: row.member_id, clerkUserId: row.clerk_user_id };
}

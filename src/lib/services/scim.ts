import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import type { CurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { getAdminSql } from "@/lib/db/client-admin";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { ScimTokenRow } from "@/lib/db/database.types";

/**
 * SCIM-ready provisioning scaffolding — a real, minimal SCIM 2.0 Users
 * resource (GET /api/scim/v2/Users, list-only) authenticated by a
 * dedicated bearer token, same hash-only-storage pattern as api_keys
 * (src/lib/services/api-keys.ts). Never validated against a real
 * identity-provider SCIM client (Okta/Azure AD/OneLogin) — see
 * docs/architecture/organization-administration.md's known gaps. No
 * POST/PATCH/DELETE, no Groups resource, no /ServiceProviderConfig — a
 * deliberately bounded subset, not a full SCIM implementation
 * pretending otherwise.
 */

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export function hashScimToken(rawToken: string): string {
  // codeql[js/insufficient-password-hash]: hashes a high-entropy random token (randomBytes(24) below), not a user-chosen password — see api-keys.ts's hashApiKey() for the identical rationale.
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken(): { rawToken: string; prefix: string } {
  const token = randomBytes(24).toString("base64url");
  const rawToken = `pp_scim_${token}`;
  return { rawToken, prefix: rawToken.slice(0, 16) };
}

export const createScimTokenInputSchema = z.object({
  name: z.string().trim().min(1, "A name is required").max(200),
});
export type CreateScimTokenInput = z.infer<typeof createScimTokenInputSchema>;

export interface CreatedScimToken {
  token: ScimTokenRow;
  rawToken: string;
}

export async function createScimToken(input: CreateScimTokenInput): Promise<CreatedScimToken> {
  const data = createScimTokenInputSchema.parse(input);
  const membership = await requirePermission("integration.manage");
  const { rawToken, prefix } = generateRawToken();

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [token] = await tx<ScimTokenRow[]>`
      insert into scim_tokens (organization_id, name, token_prefix, token_hash, created_by)
      values (
        ${membership.organization.id}, ${data.name}, ${prefix}, ${hashScimToken(rawToken)},
        ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ScimTokenCreated,
      resourceType: AuditResourceType.ScimToken,
      resourceId: token.id,
      source: "app",
      metadata: { name: data.name },
    });

    return { token, rawToken };
  });
}

export async function listScimTokens(): Promise<ScimTokenRow[]> {
  const membership = await requirePermission("integration.manage");
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<ScimTokenRow[]>`
      select * from scim_tokens
      where organization_id = ${membership.organization.id}
      order by created_at desc
    `,
  );
}

export async function revokeScimToken(tokenId: string): Promise<void> {
  const membership = await requirePermission("integration.manage");

  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [token] = await tx<ScimTokenRow[]>`
      update scim_tokens set status = 'revoked', revoked_at = now()
      where id = ${tokenId} and organization_id = ${membership.organization.id} and status = 'active'
      returning *
    `;
    if (!token) throw new AppError("not_found", "Token not found or already revoked.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ScimTokenRevoked,
      resourceType: AuditResourceType.ScimToken,
      resourceId: tokenId,
      source: "app",
    });
  });
}

export interface AuthenticatedScimToken {
  tokenId: string;
  organizationId: string;
}

/** Route-handler-side verification — mirrors api-keys.ts's verifyApiKey() exactly. */
export async function verifyScimToken(rawToken: string): Promise<AuthenticatedScimToken | null> {
  if (!rawToken.startsWith("pp_scim_")) return null;
  const sql = getAdminSql();
  const [row] = await sql<ScimTokenRow[]>`
    select * from scim_tokens where token_hash = ${hashScimToken(rawToken)} and status = 'active'
  `;
  if (!row) return null;

  await sql`update scim_tokens set last_used_at = now() where id = ${row.id}`;
  return { tokenId: row.id, organizationId: row.organization_id };
}

export interface ScimUser {
  id: string;
  userName: string;
  name: { givenName: string | null; familyName: string | null };
  active: boolean;
}

/** GET /api/scim/v2/Users — list only, no filtering beyond SCIM's basic pagination. */
export async function listScimUsers(
  organizationId: string,
  { startIndex, count }: { startIndex: number; count: number },
): Promise<{ users: ScimUser[]; totalResults: number }> {
  const sql = getAdminSql();

  const rows = await sql<
    {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      status: string;
    }[]
  >`
    select om.id, p.email, p.first_name, p.last_name, om.status
    from organization_members om
    join profiles p on p.id = om.profile_id
    where om.organization_id = ${organizationId} and om.status <> 'removed'
    order by p.email asc
    offset ${startIndex - 1} limit ${count}
  `;
  const [{ total }] = await sql<{ total: string }[]>`
    select count(*) as total from organization_members
    where organization_id = ${organizationId} and status <> 'removed'
  `;

  return {
    users: rows.map((row) => ({
      id: row.id,
      userName: row.email,
      name: { givenName: row.first_name, familyName: row.last_name },
      active: row.status === "active",
    })),
    totalResults: Number(total),
  };
}

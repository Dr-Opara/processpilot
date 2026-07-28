import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { getAdminSql } from "@/lib/db/client-admin";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { ApiKeyRow } from "@/lib/db/database.types";

/**
 * Public-API keys — see docs/architecture/public-api.md. Only
 * `key_hash` (sha256 of the raw key) is ever persisted; the raw key is
 * returned to the caller exactly once, at creation, and is
 * unrecoverable afterward — same posture password storage uses
 * industry-wide. `key_prefix` (shown in the admin UI for
 * identification, e.g. "pp_live_a1b2c3d4...") is the only
 * partially-identifying fragment stored in the clear.
 */

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

export const API_KEY_SCOPES = ["processes:read", "workflows:read", "webhooks:inbound"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

// rawKey is a 192-bit cryptographically random token (randomBytes(24)
// below), not a user-chosen, guessable password — a slow KDF (bcrypt/
// scrypt/argon2) exists specifically to defend against brute-forcing a
// *low-entropy* human-chosen secret. A 192-bit random value has no
// meaningful brute-force surface regardless of hash speed; sha256 is
// the same approach Stripe/GitHub/AWS-style API-key storage uses. A
// slow KDF here would only add a real, unnecessary latency/DoS cost to
// every authenticated API request (this hash runs on every call).
export function hashApiKey(rawKey: string): string {
  // codeql[js/insufficient-password-hash]: see the function-level comment above — this hashes a high-entropy random token, not a password.
  return createHash("sha256").update(rawKey).digest("hex");
}

function generateRawKey(): { rawKey: string; prefix: string } {
  const token = randomBytes(24).toString("base64url");
  const rawKey = `pp_live_${token}`;
  return { rawKey, prefix: rawKey.slice(0, 16) };
}

export const createApiKeyInputSchema = z.object({
  name: z.string().trim().min(1, "A name is required").max(200),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, "At least one scope is required"),
  expiresAt: z.string().datetime().optional().nullable(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;

export interface CreatedApiKey {
  row: ApiKeyRow;
  /** The only time the raw key is ever available — the caller must show/copy it now. */
  rawKey: string;
}

export async function createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
  const data = createApiKeyInputSchema.parse(input);
  const membership = await requirePermission("integration.manage");
  const { rawKey, prefix } = generateRawKey();
  const keyHash = hashApiKey(rawKey);

  const row = await withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<ApiKeyRow[]>`
      insert into api_keys (organization_id, name, key_prefix, key_hash, scopes, expires_at, created_by)
      values (${membership.organization.id}, ${data.name}, ${prefix}, ${keyHash}, ${data.scopes}, ${data.expiresAt ?? null}, ${membership.profile.id})
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApiKeyCreated,
      resourceType: AuditResourceType.ApiKey,
      resourceId: row.id,
      source: "app",
      metadata: { name: data.name, scopes: data.scopes },
    });
    return row;
  });

  return { row, rawKey };
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const membership = await requirePermission("integration.manage");
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<ApiKeyRow[]>`
      select * from api_keys where organization_id = ${membership.organization.id} order by created_at desc
    `,
  );
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const membership = await requirePermission("integration.manage");
  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<ApiKeyRow[]>`
      update api_keys set status = 'revoked', revoked_at = now()
      where id = ${keyId} and organization_id = ${membership.organization.id} and status = 'active'
      returning *
    `;
    if (!row) throw new AppError("not_found", "Active API key not found.");
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApiKeyRevoked,
      resourceType: AuditResourceType.ApiKey,
      resourceId: keyId,
      source: "app",
    });
  });
}

/** "Rotation" = revoke the old key and create a fresh one with the same name/scopes — there is no in-place key replacement, since the whole point of a hash-only store is that no key value can ever be recovered or reused. */
export async function rotateApiKey(keyId: string): Promise<CreatedApiKey> {
  const membership = await requirePermission("integration.manage");
  const [existing] = await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<ApiKeyRow[]>`
      select * from api_keys where id = ${keyId} and organization_id = ${membership.organization.id}
    `,
  );
  if (!existing) throw new AppError("not_found", "API key not found.");

  await revokeApiKey(keyId).catch(() => {
    // Already revoked/expired — rotation still proceeds with a new key.
  });

  return createApiKey({
    name: `${existing.name} (rotated)`,
    scopes: existing.scopes as ApiKeyScope[],
    expiresAt: existing.expires_at,
  });
}

export interface AuthenticatedApiKey {
  apiKeyId: string;
  organizationId: string;
  scopes: string[];
  createdByProfileId: string | null;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

/**
 * Verifies a raw `Authorization: Bearer <key>` value against
 * `api_keys` — used only by src/lib/api/authenticate.ts's public-API
 * route middleware, which is the sole caller. Runs through the admin
 * client (no organization context exists yet at this point — the
 * lookup itself is what establishes it), scoped explicitly to
 * `status = 'active'` and a not-yet-expired key, same "narrow,
 * explicit admin-client read" posture as billing.ts's
 * getEntitlements().
 */
export async function verifyApiKey(rawKey: string): Promise<AuthenticatedApiKey | null> {
  if (!rawKey.startsWith("pp_live_")) return null;
  const sql = getAdminSql();
  const keyHash = hashApiKey(rawKey);
  const [row] = await sql<ApiKeyRow[]>`
    select * from api_keys
    where key_hash = ${keyHash} and status = 'active' and (expires_at is null or expires_at > now())
  `;
  if (!row) return null;

  await sql`update api_keys set last_used_at = now() where id = ${row.id}`;
  return {
    apiKeyId: row.id,
    organizationId: row.organization_id,
    scopes: row.scopes,
    createdByProfileId: row.created_by,
  };
}

export async function recordApiUsage(
  apiKeyId: string,
  organizationId: string,
  method: string,
  path: string,
  statusCode: number,
): Promise<void> {
  const sql = getAdminSql();
  await sql`
    insert into api_key_usage_log (api_key_id, organization_id, method, path, status_code)
    values (${apiKeyId}, ${organizationId}, ${method}, ${path}, ${statusCode})
  `;
}

/** A simple fixed-window rate limit — counts this key's requests in the trailing 60s directly from api_key_usage_log rather than a separate counter table, since the usage log already has to exist for the "API usage logs" deliverable. */
export async function checkRateLimit(
  apiKeyId: string,
): Promise<{ limited: boolean; count: number }> {
  const sql = getAdminSql();
  const [row] = await sql<{ count: string }[]>`
    select count(*) as count from api_key_usage_log
    where api_key_id = ${apiKeyId} and created_at > now() - (${RATE_LIMIT_WINDOW_MS}::text || ' milliseconds')::interval
  `;
  const count = Number(row?.count ?? 0);
  return { limited: count >= RATE_LIMIT_MAX_REQUESTS, count };
}

export async function listApiUsage(
  limit = 100,
): Promise<{ method: string; path: string; status_code: number; created_at: string }[]> {
  const membership = await requirePermission("integration.manage");
  const capped = Math.min(Math.max(limit, 1), 200);
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<{ method: string; path: string; status_code: number; created_at: string }[]>`
      select method, path, status_code, created_at from api_key_usage_log
      where organization_id = ${membership.organization.id}
      order by created_at desc
      limit ${capped}
    `,
  );
}

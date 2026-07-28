import "server-only";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/lib/crypto/secret-box";
import { createOAuthState, verifyOAuthState } from "@/lib/integrations/oauth-state";
import { getIntegrationAdapter, listIntegrationCatalog } from "@/lib/integrations/registry";
import type { IntegrationCredentials } from "@/lib/integrations/adapter";
import type { IntegrationConnectionRow, IntegrationProviderKey } from "@/lib/db/database.types";

/**
 * Organization-scoped third-party connections — see
 * docs/architecture/integration-architecture.md. Credentials are
 * encrypted (src/lib/crypto/secret-box.ts) before ever reaching the
 * database and decrypted only transiently, inside this module, to call
 * an adapter — never returned to a page/action.
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

export interface IntegrationCatalogEntry {
  provider: IntegrationProviderKey;
  displayName: string;
  description: string;
  authType: "oauth2" | "api_key";
  implemented: boolean;
  connection: IntegrationConnectionRow | null;
}

/** Merges the static provider catalog with this organization's actual connection rows, so the admin UI can render every provider (connected or not) in one list. */
export async function listIntegrations(): Promise<IntegrationCatalogEntry[]> {
  const membership = await requirePermission("integration.manage");
  const rows = await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<IntegrationConnectionRow[]>`
      select * from integration_connections where organization_id = ${membership.organization.id}
    `,
  );
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return listIntegrationCatalog().map((adapter) => ({
    provider: adapter.provider,
    displayName: adapter.displayName,
    description: adapter.description,
    authType: adapter.authType,
    implemented: adapter.implemented,
    connection: byProvider.get(adapter.provider) ?? null,
  }));
}

export async function getConnectAuthorizationUrl(
  provider: IntegrationProviderKey,
  redirectUri: string,
): Promise<string> {
  const membership = await requirePermission("integration.manage");
  const adapter = getIntegrationAdapter(provider);
  if (!adapter.implemented || !adapter.getAuthorizationUrl) {
    throw new AppError("unavailable", `${adapter.displayName} is not yet available to connect.`);
  }
  if (!isEncryptionConfigured()) {
    throw new AppError(
      "unavailable",
      "Integration credential storage is not configured in this environment.",
    );
  }
  const state = createOAuthState(membership.organization.id, provider);
  return adapter.getAuthorizationUrl(state, redirectUri);
}

export async function handleOAuthCallback(
  provider: IntegrationProviderKey,
  code: string,
  state: string,
  redirectUri: string,
): Promise<void> {
  const payload = verifyOAuthState(state, provider);
  if (!payload)
    throw new AppError("bad_request", "This connection request is invalid or has expired.");

  const membership = await requirePermission("integration.manage");
  if (membership.organization.id !== payload.organizationId) {
    throw new AppError("forbidden", "This connection request belongs to a different organization.");
  }

  const adapter = getIntegrationAdapter(provider);
  if (!adapter.implemented || !adapter.exchangeCodeForCredentials) {
    throw new AppError("unavailable", `${adapter.displayName} is not yet available to connect.`);
  }

  let credentials: IntegrationCredentials;
  let verification: Awaited<ReturnType<typeof adapter.verifyConnection>>;
  try {
    credentials = await adapter.exchangeCodeForCredentials(code, redirectUri);
    verification = await adapter.verifyConnection(credentials);
  } catch (error) {
    console.error(`Failed to connect ${provider}`, error);
    throw new AppError("conflict", `Could not connect ${adapter.displayName}. Please try again.`);
  }

  await upsertConnection(membership, provider, adapter.authType, credentials, verification);
}

async function upsertConnection(
  membership: Awaited<ReturnType<typeof requirePermission>>,
  provider: IntegrationProviderKey,
  authType: "oauth2" | "api_key",
  credentials: IntegrationCredentials,
  verification: { ok: boolean; accountLabel?: string; error?: string },
): Promise<IntegrationConnectionRow> {
  const encrypted = encryptSecret(JSON.stringify(credentials));

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<IntegrationConnectionRow[]>`
      insert into integration_connections (
        organization_id, provider, status, auth_type, encrypted_credentials,
        external_account_label, last_verified_at, last_error, connected_by
      ) values (
        ${membership.organization.id}, ${provider}, ${verification.ok ? "connected" : "error"}, ${authType},
        ${encrypted}, ${verification.accountLabel ?? null}, ${verification.ok ? new Date() : null},
        ${verification.error ?? null}, ${membership.profile.id}
      )
      on conflict (organization_id, provider) do update set
        status = excluded.status,
        auth_type = excluded.auth_type,
        encrypted_credentials = excluded.encrypted_credentials,
        external_account_label = excluded.external_account_label,
        last_verified_at = excluded.last_verified_at,
        last_error = excluded.last_error,
        connected_by = excluded.connected_by,
        updated_at = now()
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.IntegrationConnected,
      resourceType: AuditResourceType.IntegrationConnection,
      resourceId: row.id,
      source: "app",
      metadata: { provider, status: row.status },
    });
    return row;
  });
}

export async function connectWithApiKey(
  provider: IntegrationProviderKey,
  apiKey: string,
): Promise<IntegrationConnectionRow> {
  if (!apiKey.trim()) throw new AppError("bad_request", "An API key is required.");
  const membership = await requirePermission("integration.manage");
  const adapter = getIntegrationAdapter(provider);
  if (!adapter.implemented || adapter.authType !== "api_key") {
    throw new AppError("unavailable", `${adapter.displayName} is not yet available to connect.`);
  }
  if (!isEncryptionConfigured()) {
    throw new AppError(
      "unavailable",
      "Integration credential storage is not configured in this environment.",
    );
  }

  const credentials: IntegrationCredentials = { apiKey: apiKey.trim() };
  let verification: Awaited<ReturnType<typeof adapter.verifyConnection>>;
  try {
    verification = await adapter.verifyConnection(credentials);
  } catch (error) {
    console.error(`Failed to verify ${provider}`, error);
    throw new AppError("conflict", `Could not verify the ${adapter.displayName} API key.`);
  }
  if (!verification.ok) {
    throw new AppError("conflict", verification.error ?? "The provided API key was rejected.");
  }

  return upsertConnection(membership, provider, "api_key", credentials, verification);
}

export async function disconnectIntegration(provider: IntegrationProviderKey): Promise<void> {
  const membership = await requirePermission("integration.manage");
  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<IntegrationConnectionRow[]>`
      update integration_connections set
        status = 'disconnected', encrypted_credentials = null, last_error = null
      where organization_id = ${membership.organization.id} and provider = ${provider}
      returning *
    `;
    if (!row) throw new AppError("not_found", "This provider isn't connected.");
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.IntegrationDisconnected,
      resourceType: AuditResourceType.IntegrationConnection,
      resourceId: row.id,
      source: "app",
      metadata: { provider },
    });
  });
}

/** Re-runs the adapter's health check against the stored credentials and updates status/last_verified_at — the "integration health and connection-status monitoring" surface. */
export async function verifyIntegration(
  provider: IntegrationProviderKey,
): Promise<IntegrationConnectionRow> {
  const membership = await requirePermission("integration.manage");
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [existing] = await tx<IntegrationConnectionRow[]>`
      select * from integration_connections
      where organization_id = ${membership.organization.id} and provider = ${provider}
    `;
    if (!existing || !existing.encrypted_credentials) {
      throw new AppError("not_found", "This provider isn't connected.");
    }

    const adapter = getIntegrationAdapter(provider);
    const credentials = JSON.parse(
      decryptSecret(existing.encrypted_credentials),
    ) as IntegrationCredentials;
    const verification = await adapter.verifyConnection(credentials);

    const [updated] = await tx<IntegrationConnectionRow[]>`
      update integration_connections set
        status = ${verification.ok ? "connected" : "degraded"},
        last_verified_at = ${verification.ok ? new Date() : existing.last_verified_at},
        last_error = ${verification.error ?? null},
        external_account_label = ${verification.accountLabel ?? existing.external_account_label}
      where id = ${existing.id}
      returning *
    `;
    return updated;
  });
}

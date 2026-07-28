import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { clerkClient } from "@clerk/nextjs/server";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { SsoConnectionRow } from "@/lib/db/database.types";

/**
 * SSO/SAML — the Phase 18 integration target (per explicit instruction,
 * chosen for its fit with product/user-roles.md's external_user and the
 * Enterprise-tier hypothesis in pricing-hypotheses.md). This module is
 * deliberately a thin admin wrapper over Clerk's Enterprise Connections
 * API (clerkClient().enterpriseConnections — @clerk/backend), not a
 * from-scratch SAML/OIDC implementation.
 *
 * Per ADR-0003 (Clerk for identity), Clerk is already the sole identity
 * provider; Clerk's Enterprise Connections API both performs the actual
 * SAML/OIDC handshake and stores the IdP credential material (X.509
 * certificate, OIDC client secret, metadata) encrypted on Clerk's side.
 * `sso_connections` therefore never persists that material — only a
 * label (name/provider/domain/active) so ProcessPilot's own admin UI
 * and audit trail can show "what's configured" without a second,
 * redundant, weaker-security copy of the credential itself. Never pass
 * idpCertificate/idpMetadata/clientSecret to recordAuditEvent()'s
 * metadata — only non-secret fields.
 *
 * Graceful degradation (integration-architecture.md's design
 * principle) is inherent, not something this module has to implement:
 * Clerk's native email/password sign-in remains available regardless
 * of whether an organization has an SSO connection configured, since
 * this module only ever *adds* an enterprise connection scoped to a
 * domain — it never disables Clerk's other sign-in strategies.
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

const samlConfigSchema = z.object({
  idpEntityId: z.string().trim().min(1, "The IdP Entity ID is required."),
  idpSsoUrl: z.string().trim().url("The IdP SSO URL must be a valid URL."),
  idpCertificate: z.string().trim().min(1).optional(),
  idpMetadataUrl: z.string().trim().url().optional(),
});

const oidcConfigSchema = z.object({
  clientId: z.string().trim().min(1, "The OIDC client ID is required."),
  clientSecret: z.string().trim().min(1, "The OIDC client secret is required."),
  discoveryUrl: z.string().trim().url("The OIDC discovery URL must be a valid URL."),
});

export const createSsoConnectionInputSchema = z
  .object({
    name: z.string().trim().min(1, "A label is required").max(200),
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a valid domain, e.g. acme.com"),
    provider: z.enum(["saml_custom", "oidc_custom"]),
    saml: samlConfigSchema.optional(),
    oidc: oidcConfigSchema.optional(),
  })
  .refine(
    (data) =>
      (data.provider === "saml_custom" &&
        data.saml &&
        (data.saml.idpCertificate || data.saml.idpMetadataUrl)) ||
      (data.provider === "oidc_custom" && data.oidc),
    { message: "Provide the identity provider details for the selected provider type." },
  );

export type CreateSsoConnectionInput = z.infer<typeof createSsoConnectionInputSchema>;

export async function listSsoConnections(): Promise<SsoConnectionRow[]> {
  const membership = await requirePermission("integration.manage");
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<SsoConnectionRow[]>`
      select * from sso_connections
      where organization_id = ${membership.organization.id}
      order by created_at desc
    `,
  );
}

export async function createSsoConnection(
  input: CreateSsoConnectionInput,
): Promise<SsoConnectionRow> {
  const data = createSsoConnectionInputSchema.parse(input);
  const membership = await requirePermission("integration.manage");

  const [existingDomain] = await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<{ id: string }[]>`
      select id from sso_connections where organization_id = ${membership.organization.id} and domain = ${data.domain}
    `,
  );
  if (existingDomain) {
    throw new AppError("conflict", `An SSO connection already exists for domain "${data.domain}".`);
  }

  let clerkConnectionId: string;
  try {
    const client = await clerkClient();
    const connection = await client.enterpriseConnections.createEnterpriseConnection({
      name: data.name,
      domains: [data.domain],
      organizationId: membership.organization.clerk_org_id,
      active: true,
      saml: data.provider === "saml_custom" ? data.saml : undefined,
      oidc: data.provider === "oidc_custom" ? data.oidc : undefined,
    });
    clerkConnectionId = connection.id;
  } catch (error) {
    console.error("Failed to create Clerk enterprise connection", error);
    throw new AppError(
      "conflict",
      "Could not create the SSO connection with the identity provider. Check the configuration and try again.",
    );
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<SsoConnectionRow[]>`
      insert into sso_connections (organization_id, clerk_connection_id, name, provider, domain, created_by)
      values (${membership.organization.id}, ${clerkConnectionId}, ${data.name}, ${data.provider}, ${data.domain}, ${membership.profile.id})
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.SsoConnectionCreated,
      resourceType: AuditResourceType.SsoConnection,
      resourceId: row.id,
      source: "app",
      metadata: { provider: data.provider, domain: data.domain },
    });
    return row;
  });
}

async function getOwnConnection(
  organizationId: string,
  connectionId: string,
  tx: postgres.TransactionSql,
): Promise<SsoConnectionRow> {
  const [row] = await tx<SsoConnectionRow[]>`
    select * from sso_connections where id = ${connectionId} and organization_id = ${organizationId}
  `;
  if (!row) throw new AppError("not_found", "SSO connection not found.");
  return row;
}

export async function setSsoConnectionActive(
  connectionId: string,
  active: boolean,
): Promise<SsoConnectionRow> {
  const membership = await requirePermission("integration.manage");
  const existing = await withTenantContext(toTenantContext(membership), (tx) =>
    getOwnConnection(membership.organization.id, connectionId, tx),
  );

  try {
    const client = await clerkClient();
    await client.enterpriseConnections.updateEnterpriseConnection(existing.clerk_connection_id, {
      active,
    });
  } catch (error) {
    console.error("Failed to update Clerk enterprise connection", error);
    throw new AppError("conflict", "Could not update the SSO connection. Please try again.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<SsoConnectionRow[]>`
      update sso_connections set active = ${active} where id = ${connectionId} returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.SsoConnectionUpdated,
      resourceType: AuditResourceType.SsoConnection,
      resourceId: connectionId,
      source: "app",
      metadata: { active },
    });
    return updated;
  });
}

export async function deleteSsoConnection(connectionId: string): Promise<void> {
  const membership = await requirePermission("integration.manage");
  const existing = await withTenantContext(toTenantContext(membership), (tx) =>
    getOwnConnection(membership.organization.id, connectionId, tx),
  );

  try {
    const client = await clerkClient();
    await client.enterpriseConnections.deleteEnterpriseConnection(existing.clerk_connection_id);
  } catch (error) {
    console.error("Failed to delete Clerk enterprise connection", error);
    throw new AppError("conflict", "Could not delete the SSO connection. Please try again.");
  }

  await withTenantContext(toTenantContext(membership), async (tx) => {
    await tx`delete from sso_connections where id = ${connectionId}`;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.SsoConnectionDeleted,
      resourceType: AuditResourceType.SsoConnection,
      resourceId: connectionId,
      source: "app",
      metadata: { domain: existing.domain },
    });
  });
}

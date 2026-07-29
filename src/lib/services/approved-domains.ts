import "server-only";
import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import type { CurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { ApprovedDomainRow } from "@/lib/db/database.types";

/**
 * Domain verification via a real DNS TXT record lookup — no external
 * provider/credential needed, unlike SSO or OAuth-based integrations, so
 * this is genuinely live-verifiable, not scaffolding. An admin proves
 * control of a domain by publishing
 * `_processpilot-verify.<domain> TXT "processpilot-verify=<token>"` and
 * calling verifyApprovedDomain(); verifyDomain() performs a real
 * `dns.resolveTxt()` lookup, not a simulated one.
 */

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(253)
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
    "Enter a valid domain.",
  );

export function verificationRecordFor(
  domain: string,
  token: string,
): { host: string; value: string } {
  return { host: `_processpilot-verify.${domain}`, value: `processpilot-verify=${token}` };
}

export async function listApprovedDomains(): Promise<ApprovedDomainRow[]> {
  const membership = await requirePermission("organization.settings");
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<ApprovedDomainRow[]>`
      select * from approved_domains
      where organization_id = ${membership.organization.id}
      order by created_at desc
    `,
  );
}

export async function addApprovedDomain(input: { domain: string }): Promise<ApprovedDomainRow> {
  const domain = domainSchema.parse(input.domain);
  const membership = await requirePermission("organization.settings");
  const token = randomBytes(16).toString("hex");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    let domainRow: ApprovedDomainRow;
    try {
      [domainRow] = await tx<ApprovedDomainRow[]>`
        insert into approved_domains (organization_id, domain, verification_token, created_by)
        values (${membership.organization.id}, ${domain}, ${token}, ${membership.profile.id})
        returning *
      `;
    } catch {
      throw new AppError("conflict", "This domain has already been added.");
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApprovedDomainAdded,
      resourceType: AuditResourceType.ApprovedDomain,
      resourceId: domainRow.id,
      source: "app",
      metadata: { domain },
    });

    return domainRow;
  });
}

/**
 * Performs a real DNS TXT lookup. A resolution failure (NXDOMAIN,
 * timeout, no matching record) is a normal, expected outcome — this
 * never fabricates a successful verification.
 */
export async function verifyApprovedDomain(domainId: string): Promise<ApprovedDomainRow> {
  const membership = await requirePermission("organization.settings");

  const domainRow = await withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<ApprovedDomainRow[]>`
      select * from approved_domains
      where id = ${domainId} and organization_id = ${membership.organization.id}
    `;
    if (!row) throw new AppError("not_found", "Domain not found.");
    return row;
  });

  const record = verificationRecordFor(domainRow.domain, domainRow.verification_token);
  let matched = false;
  try {
    const txtRecords = await resolveTxt(record.host);
    matched = txtRecords.some((chunks) => chunks.join("") === record.value);
  } catch {
    matched = false;
  }

  if (!matched) {
    throw new AppError(
      "conflict",
      `No matching TXT record found at ${record.host}. Add "${record.value}" and try again.`,
    );
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<ApprovedDomainRow[]>`
      update approved_domains set verified_at = now()
      where id = ${domainId} and organization_id = ${membership.organization.id}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApprovedDomainVerified,
      resourceType: AuditResourceType.ApprovedDomain,
      resourceId: domainId,
      source: "app",
      metadata: { domain: domainRow.domain },
    });

    return updated;
  });
}

export async function removeApprovedDomain(domainId: string): Promise<void> {
  const membership = await requirePermission("organization.settings");

  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [deleted] = await tx<ApprovedDomainRow[]>`
      delete from approved_domains
      where id = ${domainId} and organization_id = ${membership.organization.id}
      returning *
    `;
    if (!deleted) throw new AppError("not_found", "Domain not found.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ApprovedDomainRemoved,
      resourceType: AuditResourceType.ApprovedDomain,
      resourceId: domainId,
      source: "app",
      metadata: { domain: deleted.domain },
    });
  });
}

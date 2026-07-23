import "server-only";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { OrganizationLocationRow } from "@/lib/db/database.types";

/**
 * location.manage has no "Scoped" grant in product/permissions-matrix.md
 * (only organization_owner/organization_admin hold it, both unscoped) —
 * so every mutation here calls requirePermission("location.manage")
 * without a scope option, unlike departments.ts/teams.ts.
 */

export const locationInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(30).optional(),
  country: z.string().trim().max(100).optional(),
  timezone: z.string().trim().max(100).optional(),
  managerMemberId: z.string().uuid().optional().nullable(),
});

export type LocationInput = z.infer<typeof locationInputSchema>;

export interface ListLocationsFilters {
  search?: string;
  status?: "active" | "archived" | "all";
}

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

export async function listLocations(
  filters: ListLocationsFilters = {},
): Promise<OrganizationLocationRow[]> {
  const membership = await requirePermission("location.manage");
  const status = filters.status ?? "active";
  const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;

  return withTenantContext(toTenantContext(membership), async (tx) => {
    return tx<OrganizationLocationRow[]>`
      select * from organization_locations
      where organization_id = ${membership.organization.id}
        and (${status === "all"} or archived_at is ${status === "archived" ? tx`not null` : tx`null`})
        and (${search === null} or name ilike ${search})
      order by name asc
    `;
  });
}

export async function getLocation(locationId: string): Promise<OrganizationLocationRow> {
  const membership = await requirePermission("location.manage");
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [location] = await tx<OrganizationLocationRow[]>`
      select * from organization_locations where id = ${locationId} and organization_id = ${membership.organization.id}
    `;
    if (!location) throw new AppError("not_found", "Location not found.");
    return location;
  });
}

export async function createLocation(input: LocationInput): Promise<OrganizationLocationRow> {
  const data = locationInputSchema.parse(input);
  const membership = await requirePermission("location.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [existing] = await tx<{ id: string }[]>`
      select id from organization_locations
      where organization_id = ${membership.organization.id}
        and lower(name) = lower(${data.name})
        and archived_at is null
    `;
    if (existing) {
      throw new AppError("conflict", "A location with this name already exists.");
    }

    const [location] = await tx<OrganizationLocationRow[]>`
      insert into organization_locations (
        organization_id, name, address_line1, address_line2, city, region,
        postal_code, country, timezone, manager_member_id, created_by
      ) values (
        ${membership.organization.id}, ${data.name}, ${data.addressLine1 ?? null}, ${data.addressLine2 ?? null},
        ${data.city ?? null}, ${data.region ?? null}, ${data.postalCode ?? null}, ${data.country ?? null},
        ${data.timezone ?? null}, ${data.managerMemberId ?? null}, ${membership.profile.id}
      )
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.LocationCreated,
      resourceType: AuditResourceType.Location,
      resourceId: location.id,
      source: "app",
    });

    return location;
  });
}

export async function updateLocation(
  locationId: string,
  input: Partial<LocationInput>,
): Promise<OrganizationLocationRow> {
  const data = locationInputSchema.partial().parse(input);
  const membership = await requirePermission("location.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [existing] = await tx<OrganizationLocationRow[]>`
      select * from organization_locations where id = ${locationId} and organization_id = ${membership.organization.id}
    `;
    if (!existing) throw new AppError("not_found", "Location not found.");

    const [location] = await tx<OrganizationLocationRow[]>`
      update organization_locations set
        name = ${data.name ?? existing.name},
        address_line1 = ${data.addressLine1 ?? existing.address_line1},
        address_line2 = ${data.addressLine2 ?? existing.address_line2},
        city = ${data.city ?? existing.city},
        region = ${data.region ?? existing.region},
        postal_code = ${data.postalCode ?? existing.postal_code},
        country = ${data.country ?? existing.country},
        timezone = ${data.timezone ?? existing.timezone},
        manager_member_id = ${data.managerMemberId === undefined ? existing.manager_member_id : data.managerMemberId}
      where id = ${locationId}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.LocationUpdated,
      resourceType: AuditResourceType.Location,
      resourceId: location.id,
      source: "app",
    });

    return location;
  });
}

export async function archiveLocation(locationId: string): Promise<OrganizationLocationRow> {
  const membership = await requirePermission("location.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [location] = await tx<OrganizationLocationRow[]>`
      update organization_locations set archived_at = now()
      where id = ${locationId} and organization_id = ${membership.organization.id} and archived_at is null
      returning *
    `;
    if (!location) throw new AppError("not_found", "Location not found or already archived.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.LocationArchived,
      resourceType: AuditResourceType.Location,
      resourceId: location.id,
      source: "app",
    });

    return location;
  });
}

export async function restoreLocation(locationId: string): Promise<OrganizationLocationRow> {
  const membership = await requirePermission("location.manage");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [target] = await tx<OrganizationLocationRow[]>`
      select * from organization_locations where id = ${locationId} and organization_id = ${membership.organization.id}
    `;
    if (!target || !target.archived_at) {
      throw new AppError("not_found", "Location not found or not archived.");
    }

    const [conflict] = await tx<{ id: string }[]>`
      select id from organization_locations
      where organization_id = ${membership.organization.id}
        and lower(name) = lower(${target.name})
        and archived_at is null
        and id <> ${locationId}
    `;
    if (conflict) {
      throw new AppError("conflict", "Another active location already uses this name.");
    }

    const [location] = await tx<OrganizationLocationRow[]>`
      update organization_locations set archived_at = null where id = ${locationId} returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.LocationRestored,
      resourceType: AuditResourceType.Location,
      resourceId: location.id,
      source: "app",
    });

    return location;
  });
}

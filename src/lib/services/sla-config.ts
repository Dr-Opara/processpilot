import "server-only";
import { z } from "zod";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { BusinessCalendarRow, SlaDefinitionRow } from "@/lib/db/database.types";

/** CRUD for BusinessCalendar and SlaDefinition — both directly editable configuration (sla.manage), same non-versioned posture as ApprovalPolicy. See sla.ts for runtime due-date resolution and business-calendar.ts for the actual calendar math. */

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

export const businessCalendarInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(300),
  timezone: z.string().trim().min(1, "Time zone is required").max(100),
  workDays: z.array(z.number().int().min(0).max(6)).min(1, "At least one work day is required"),
  workStartMinutes: z.number().int().min(0).max(1439),
  workEndMinutes: z.number().int().min(1).max(1440),
  departmentId: z.string().uuid().optional().nullable(),
});

export type BusinessCalendarInput = z.infer<typeof businessCalendarInputSchema>;

export async function listBusinessCalendars(): Promise<BusinessCalendarRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<BusinessCalendarRow[]>`
      select * from business_calendars where organization_id = ${membership.organization.id} order by name asc
    `,
  );
}

export async function createBusinessCalendar(
  input: BusinessCalendarInput,
): Promise<BusinessCalendarRow> {
  const data = businessCalendarInputSchema.parse(input);
  if (data.workStartMinutes >= data.workEndMinutes) {
    throw new AppError("conflict", "Work start time must be before work end time.");
  }
  const membership = await requirePermission("sla.manage", {
    scope: { departmentId: data.departmentId ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [calendar] = await tx<BusinessCalendarRow[]>`
      insert into business_calendars (organization_id, department_id, name, timezone, work_days, work_start_minutes, work_end_minutes)
      values (
        ${membership.organization.id}, ${data.departmentId ?? null}, ${data.name}, ${data.timezone},
        ${data.workDays}, ${data.workStartMinutes}, ${data.workEndMinutes}
      )
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.BusinessCalendarCreated,
      resourceType: AuditResourceType.BusinessCalendar,
      resourceId: calendar.id,
      source: "app",
    });
    return calendar;
  });
}

export async function addBusinessCalendarHoliday(
  calendarId: string,
  input: { date: string; name: string },
): Promise<void> {
  const preCheck = await getCurrentMembership();
  const calendar = await withTenantContext(toTenantContext(preCheck), async (tx) => {
    const [row] = await tx<BusinessCalendarRow[]>`
      select * from business_calendars where id = ${calendarId} and organization_id = ${preCheck.organization.id}
    `;
    if (!row) throw new AppError("not_found", "Business calendar not found.");
    return row;
  });
  const membership = await requirePermission("sla.manage", {
    scope: { departmentId: calendar.department_id ?? undefined },
  });

  await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx`
      insert into business_calendar_holidays (organization_id, calendar_id, holiday_date, name)
      values (${membership.organization.id}, ${calendarId}, ${input.date}, ${input.name})
    `,
  );
}

export const slaDefinitionInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(300),
  targetType: z.enum(["task", "approval", "workflow"]),
  targetMinutes: z.number().int().positive(),
  businessCalendarId: z.string().uuid().optional().nullable(),
  reminderMinutesBeforeDue: z.array(z.number().int().nonnegative()).default([]),
  departmentId: z.string().uuid().optional().nullable(),
});

export type SlaDefinitionInput = z.infer<typeof slaDefinitionInputSchema>;

export async function listSlaDefinitions(): Promise<SlaDefinitionRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<SlaDefinitionRow[]>`
      select * from sla_definitions where organization_id = ${membership.organization.id} order by name asc
    `,
  );
}

export async function getSlaDefinition(slaDefinitionId: string): Promise<SlaDefinitionRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<SlaDefinitionRow[]>`
      select * from sla_definitions where id = ${slaDefinitionId} and organization_id = ${membership.organization.id}
    `;
    if (!row) throw new AppError("not_found", "SLA definition not found.");
    return row;
  });
}

export async function createSlaDefinition(input: SlaDefinitionInput): Promise<SlaDefinitionRow> {
  const data = slaDefinitionInputSchema.parse(input);
  const membership = await requirePermission("sla.manage", {
    scope: { departmentId: data.departmentId ?? undefined },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [definition] = await tx<SlaDefinitionRow[]>`
      insert into sla_definitions (
        organization_id, department_id, name, target_type, target_minutes, business_calendar_id, reminder_minutes_before_due
      ) values (
        ${membership.organization.id}, ${data.departmentId ?? null}, ${data.name}, ${data.targetType},
        ${data.targetMinutes}, ${data.businessCalendarId ?? null}, ${data.reminderMinutesBeforeDue}
      )
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.SlaDefinitionCreated,
      resourceType: AuditResourceType.SlaDefinition,
      resourceId: definition.id,
      source: "app",
    });
    return definition;
  });
}

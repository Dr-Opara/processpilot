"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  addBusinessCalendarHoliday,
  createBusinessCalendar,
  createSlaDefinition,
  slaDefinitionInputSchema,
} from "@/lib/services/sla-config";
import {
  createEscalationRule,
  deleteEscalationRule,
  escalationRuleInputSchema,
} from "@/lib/services/escalation";

export async function createBusinessCalendarAction(formData: FormData): Promise<void> {
  await runFormAction("/app/sla/calendars", async () => {
    await createBusinessCalendar({
      name: String(formData.get("name") ?? ""),
      timezone: String(formData.get("timezone") ?? "UTC"),
      workDays: formData
        .getAll("workDays")
        .map((v) => Number(v))
        .filter((n) => !Number.isNaN(n)),
      workStartMinutes: Number(formData.get("workStartMinutes") ?? 540),
      workEndMinutes: Number(formData.get("workEndMinutes") ?? 1020),
    });
    revalidatePath("/app/sla/calendars");
    return "/app/sla/calendars";
  });
}

export async function addBusinessCalendarHolidayAction(
  calendarId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction("/app/sla/calendars", async () => {
    await addBusinessCalendarHoliday(calendarId, {
      date: String(formData.get("date") ?? ""),
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath("/app/sla/calendars");
    return "/app/sla/calendars";
  });
}

export async function createSlaDefinitionAction(formData: FormData): Promise<void> {
  await runFormAction("/app/sla/definitions/new", async () => {
    const businessCalendarId = String(formData.get("businessCalendarId") ?? "");
    const reminders = String(formData.get("reminderMinutesBeforeDue") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number);

    const input = slaDefinitionInputSchema.parse({
      name: String(formData.get("name") ?? ""),
      targetType: String(formData.get("targetType") ?? "task"),
      targetMinutes: Number(formData.get("targetMinutes") ?? 0),
      businessCalendarId: businessCalendarId || null,
      reminderMinutesBeforeDue: reminders,
    });
    const definition = await createSlaDefinition(input);

    revalidatePath("/app/sla/definitions");
    return `/app/sla/definitions/${definition.id}`;
  });
}

export async function createEscalationRuleAction(
  slaDefinitionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/sla/definitions/${slaDefinitionId}`, async () => {
    const action = String(formData.get("action") ?? "remind");
    const reassignValue = String(formData.get("reassignValue") ?? "").trim();

    const input = escalationRuleInputSchema.parse({
      slaDefinitionId,
      level: Number(formData.get("level") ?? 1),
      triggerAfterMinutesPastDue: Number(formData.get("triggerAfterMinutesPastDue") ?? 0),
      action,
      reassignTarget: action === "reassign" ? { type: "user", value: reassignValue || null } : null,
    });
    await createEscalationRule(input);

    revalidatePath(`/app/sla/definitions/${slaDefinitionId}`);
    return `/app/sla/definitions/${slaDefinitionId}`;
  });
}

export async function deleteEscalationRuleAction(
  slaDefinitionId: string,
  ruleId: string,
): Promise<void> {
  await deleteEscalationRule(ruleId);
  revalidatePath(`/app/sla/definitions/${slaDefinitionId}`);
}

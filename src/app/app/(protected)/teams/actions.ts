"use server";

import { revalidatePath } from "next/cache";
import {
  archiveTeam,
  createTeam,
  restoreTeam,
  setTeamMembers,
  updateTeam,
} from "@/lib/services/teams";
import { runFormAction } from "@/lib/form-actions";

function formToInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    departmentId: String(formData.get("departmentId") ?? "") || null,
    locationId: String(formData.get("locationId") ?? "") || null,
    managerMemberId: String(formData.get("managerMemberId") ?? "") || null,
  };
}

export async function createTeamAction(formData: FormData): Promise<void> {
  await runFormAction("/app/teams/new", async () => {
    const team = await createTeam(formToInput(formData));
    revalidatePath("/app/teams");
    return `/app/teams/${team.id}`;
  });
}

export async function updateTeamAction(teamId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/teams/${teamId}/edit`, async () => {
    await updateTeam(teamId, formToInput(formData));
    revalidatePath("/app/teams");
    revalidatePath(`/app/teams/${teamId}`);
    return `/app/teams/${teamId}`;
  });
}

export async function archiveTeamAction(teamId: string): Promise<void> {
  await archiveTeam(teamId);
  revalidatePath("/app/teams");
  revalidatePath(`/app/teams/${teamId}`);
}

export async function restoreTeamAction(teamId: string): Promise<void> {
  await restoreTeam(teamId);
  revalidatePath("/app/teams");
  revalidatePath(`/app/teams/${teamId}`);
}

export async function setTeamMembersAction(teamId: string, formData: FormData): Promise<void> {
  const memberIds = formData.getAll("memberIds").map(String);
  await setTeamMembers(teamId, memberIds);
  revalidatePath(`/app/teams/${teamId}`);
}

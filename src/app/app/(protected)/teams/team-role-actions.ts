"use server";

import { revalidatePath } from "next/cache";
import { assignRoleToTeam, unassignRoleFromTeam } from "@/lib/services/team-role-assignments";
import { runFormAction } from "@/lib/form-actions";

export async function assignRoleToTeamAction(teamId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/teams/${teamId}`, async () => {
    await assignRoleToTeam({ teamId, roleId: String(formData.get("roleId") ?? "") });
    revalidatePath(`/app/teams/${teamId}`);
    return `/app/teams/${teamId}`;
  });
}

export async function unassignRoleFromTeamAction(teamId: string, roleId: string): Promise<void> {
  await unassignRoleFromTeam(teamId, roleId);
  revalidatePath(`/app/teams/${teamId}`);
}

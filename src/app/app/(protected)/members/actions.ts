"use server";

import { revalidatePath } from "next/cache";
import {
  changeMemberRole,
  removeMember,
  restoreMember,
  suspendMember,
  transferOwnership,
  updateMemberFields,
} from "@/lib/services/members";
import { createInvitation } from "@/lib/services/invitations";
import { runFormAction } from "@/lib/form-actions";

export async function updateMemberFieldsAction(
  memberId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/members/${memberId}/edit`, async () => {
    await updateMemberFields(memberId, {
      jobTitle: String(formData.get("jobTitle") ?? "") || null,
      locationId: String(formData.get("locationId") ?? "") || null,
      departmentId: String(formData.get("departmentId") ?? "") || null,
      managerId: String(formData.get("managerId") ?? "") || null,
      startDate: String(formData.get("startDate") ?? "") || null,
    });
    revalidatePath("/app/members");
    revalidatePath(`/app/members/${memberId}`);
    return `/app/members/${memberId}`;
  });
}

export async function changeMemberRoleAction(memberId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/members/${memberId}`, async () => {
    await changeMemberRole(memberId, String(formData.get("roleId") ?? ""));
    revalidatePath(`/app/members/${memberId}`);
    return `/app/members/${memberId}`;
  });
}

export async function suspendMemberAction(memberId: string): Promise<void> {
  await runFormAction(`/app/members/${memberId}`, async () => {
    await suspendMember(memberId);
    revalidatePath("/app/members");
    revalidatePath(`/app/members/${memberId}`);
    return `/app/members/${memberId}`;
  });
}

export async function restoreMemberAction(memberId: string): Promise<void> {
  await runFormAction(`/app/members/${memberId}`, async () => {
    await restoreMember(memberId);
    revalidatePath("/app/members");
    revalidatePath(`/app/members/${memberId}`);
    return `/app/members/${memberId}`;
  });
}

export async function removeMemberAction(memberId: string): Promise<void> {
  await runFormAction(`/app/members/${memberId}`, async () => {
    await removeMember(memberId);
    revalidatePath("/app/members");
    revalidatePath(`/app/members/${memberId}`);
    return "/app/members";
  });
}

export async function transferOwnershipAction(formData: FormData): Promise<void> {
  const newOwnerMemberId = String(formData.get("newOwnerMemberId") ?? "");
  await runFormAction("/app/members", async () => {
    await transferOwnership(newOwnerMemberId);
    revalidatePath("/app/members");
    return "/app/members";
  });
}

export async function createInvitationAction(formData: FormData): Promise<void> {
  await runFormAction("/app/members/invite", async () => {
    await createInvitation({
      email: String(formData.get("email") ?? ""),
      roleId: String(formData.get("roleId") ?? ""),
      locationId: String(formData.get("locationId") ?? "") || null,
      departmentId: String(formData.get("departmentId") ?? "") || null,
      teamId: String(formData.get("teamId") ?? "") || null,
      personalMessage: String(formData.get("personalMessage") ?? "") || null,
    });
    revalidatePath("/app/members");
    return "/app/members?invited=1";
  });
}

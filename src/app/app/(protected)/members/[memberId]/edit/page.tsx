import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { getMemberProfile, listMembers } from "@/lib/services/members";
import { listDepartments } from "@/lib/services/departments";
import { listLocations } from "@/lib/services/locations";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import { updateMemberFieldsAction } from "../../actions";

export default async function EditMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { memberId } = await params;
  const { error } = await searchParams;

  let profile;
  try {
    profile = await getMemberProfile(memberId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const [departments, locations, membersResult] = await Promise.all([
    listDepartments({ status: "active" }).catch(() => []),
    listLocations({ status: "active" }).catch(() => []),
    listMembers({ status: "active", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
  ]);
  const managerCandidates = membersResult.members.filter((m) => m.id !== memberId);
  const updateAction = updateMemberFieldsAction.bind(null, memberId);

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Edit member</Heading>
        <Text className="text-muted">
          {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email}
        </Text>
      </Stack>

      {error && <Alert title="Could not update member" description={error} />}

      <form action={updateAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input
            id="jobTitle"
            name="jobTitle"
            maxLength={200}
            defaultValue={profile.member.job_title ?? ""}
          />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="departmentId">Department (optional)</Label>
          <Select
            id="departmentId"
            name="departmentId"
            defaultValue={profile.member.department_id ?? ""}
          >
            <option value="">No specific department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="locationId">Location (optional)</Label>
          <Select id="locationId" name="locationId" defaultValue={profile.member.location_id ?? ""}>
            <option value="">No specific location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="managerId">Manager (optional)</Label>
          <Select id="managerId" name="managerId" defaultValue={profile.member.manager_id ?? ""}>
            <option value="">No manager assigned</option>
            {managerCandidates.map((member) => (
              <option key={member.id} value={member.id}>
                {memberDisplayName(member)}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="startDate">Start date (optional)</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={profile.member.start_date ?? ""}
          />
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href={`/app/members/${memberId}`} variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </Cluster>
      </form>
    </Stack>
  );
}

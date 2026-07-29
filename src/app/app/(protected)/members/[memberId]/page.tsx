import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { getMemberProfile } from "@/lib/services/members";
import { listRoles } from "@/lib/services/roles";
import { listDepartments } from "@/lib/services/departments";
import { listLocations } from "@/lib/services/locations";
import { listTeams } from "@/lib/services/teams";
import { memberStatusBadgeStatus } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import {
  changeMemberRoleAction,
  removeMemberAction,
  restoreMemberAction,
  suspendMemberAction,
  transferOwnershipAction,
} from "../actions";
import { delegateAdministratorAction } from "../delegated-admin-actions";

export default async function MemberDetailPage({
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

  const [roles, currentMembership, departments, locations, teams] = await Promise.all([
    listRoles().catch(() => []),
    getCurrentMembership().catch(() => null),
    listDepartments({ status: "active" }).catch(() => []),
    listLocations({ status: "active" }).catch(() => []),
    listTeams({ status: "active" }).catch(() => []),
  ]);

  const isSelf = currentMembership?.member.id === memberId;
  const canTransferOwnership = Boolean(
    currentMembership?.permissions.includes("organization.manage"),
  );
  const canDelegateAdmin = Boolean(currentMembership?.permissions.includes("role.manage"));
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email;

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">{displayName}</Heading>
            <StatusBadge status={memberStatusBadgeStatus(profile.member.status)}>
              {profile.member.status}
            </StatusBadge>
          </Cluster>
          <Text className="text-muted">{profile.email}</Text>
        </Stack>
        <Button href={`/app/members/${memberId}/edit`} variant="secondary">
          Edit
        </Button>
      </Cluster>

      {error && <Alert title="Action could not be completed" description={error} />}

      <Stack className="gap-2 rounded-md border border-border p-4">
        <Cluster className="justify-between">
          <Text>Job title</Text>
          <Text className="text-muted">{profile.member.job_title ?? "—"}</Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Department</Text>
          <Text className="text-muted">{profile.departmentName ?? "—"}</Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Location</Text>
          <Text className="text-muted">{profile.locationName ?? "—"}</Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Manager</Text>
          <Text className="text-muted">{profile.managerName ?? "—"}</Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Teams</Text>
          <Text className="text-muted">{profile.teams.map((t) => t.name).join(", ") || "—"}</Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Start date</Text>
          <Text className="text-muted">{profile.member.start_date ?? "—"}</Text>
        </Cluster>
      </Stack>

      <Stack className="gap-3">
        <Heading as="h2">Role</Heading>
        <form
          action={changeMemberRoleAction.bind(null, memberId)}
          className="flex flex-wrap items-end gap-3"
        >
          <Stack className="min-w-[240px] gap-1">
            <Label htmlFor="roleId">Assigned role</Label>
            <Select
              id="roleId"
              name="roleId"
              defaultValue={profile.roles[0]?.id ?? ""}
              disabled={isSelf}
            >
              {roles.map(({ role }) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </Stack>
          <Button type="submit" variant="secondary" disabled={isSelf}>
            Change role
          </Button>
        </form>
        {isSelf && <Text className="text-muted text-xs">You cannot change your own role.</Text>}
      </Stack>

      <Stack className="gap-3">
        <Heading as="h2">Membership</Heading>
        <Cluster className="gap-2">
          {profile.member.status === "active" && (
            <form action={suspendMemberAction.bind(null, memberId)}>
              <Button type="submit" variant="secondary" disabled={isSelf}>
                Suspend
              </Button>
            </form>
          )}
          {profile.member.status === "suspended" && (
            <form action={restoreMemberAction.bind(null, memberId)}>
              <Button type="submit" variant="secondary">
                Restore
              </Button>
            </form>
          )}
          {profile.member.status !== "removed" && (
            <form action={removeMemberAction.bind(null, memberId)}>
              <Button type="submit" variant="secondary" disabled={isSelf}>
                Remove
              </Button>
            </form>
          )}
        </Cluster>
        {isSelf && (
          <Text className="text-muted text-xs">
            You cannot suspend or remove your own membership.
          </Text>
        )}
      </Stack>

      {canTransferOwnership && !isSelf && profile.member.status === "active" && (
        <Stack className="gap-3">
          <Heading as="h2">Transfer ownership</Heading>
          <Text className="text-muted">
            Makes {displayName} the organization owner and removes ownership from your account.
          </Text>
          <form action={transferOwnershipAction} className="flex items-end gap-3">
            <input type="hidden" name="newOwnerMemberId" value={memberId} />
            <Button type="submit" variant="secondary">
              Transfer ownership to {displayName}
            </Button>
          </form>
        </Stack>
      )}

      {canDelegateAdmin && !isSelf && profile.member.status === "active" && (
        <Stack className="gap-3">
          <Heading as="h2">Delegate administration</Heading>
          <Text className="text-muted text-xs">
            Grants a role scoped to one department, location, or team, and records {displayName} as
            its owner/manager. You can only delegate a role whose permissions you already hold.
          </Text>
          <form
            action={delegateAdministratorAction.bind(null, memberId)}
            className="flex flex-wrap items-end gap-3"
          >
            <Stack className="min-w-[200px] gap-1">
              <Label htmlFor="delegateRoleId">Role</Label>
              <Select id="delegateRoleId" name="roleId" required defaultValue="">
                <option value="" disabled>
                  Select a role
                </option>
                {roles.map(({ role }) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Stack>
            <Stack className="min-w-[200px] gap-1">
              <Label htmlFor="delegateDepartmentId">Department</Label>
              <Select id="delegateDepartmentId" name="departmentId" defaultValue="">
                <option value="">—</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </Stack>
            <Stack className="min-w-[200px] gap-1">
              <Label htmlFor="delegateLocationId">Location</Label>
              <Select id="delegateLocationId" name="locationId" defaultValue="">
                <option value="">—</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Stack>
            <Stack className="min-w-[200px] gap-1">
              <Label htmlFor="delegateTeamId">Team</Label>
              <Select id="delegateTeamId" name="teamId" defaultValue="">
                <option value="">—</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </Stack>
            <Button type="submit" variant="secondary">
              Delegate
            </Button>
          </form>
        </Stack>
      )}

      <Stack className="gap-3">
        <Heading as="h2">Recent activity</Heading>
        {profile.recentActivity.length === 0 ? (
          <Text className="text-muted">No recorded activity yet.</Text>
        ) : (
          <Stack className="gap-2">
            {profile.recentActivity.map((event) => (
              <Cluster key={event.id} className="justify-between border-b border-border/60 pb-2">
                <Text>{event.action}</Text>
                <Text className="text-muted text-xs">
                  {new Date(event.created_at).toLocaleString()}
                </Text>
              </Cluster>
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

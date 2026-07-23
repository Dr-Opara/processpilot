import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName, memberStatusBadgeStatus } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; invited?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as "active" | "suspended" | "removed" | "all") ?? "active";

  let members: Awaited<ReturnType<typeof listMembers>>["members"] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await listMembers({ search: params.search, status, pageSize: 100 });
    members = result.members;
    total = result.total;
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load members.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Members</Heading>
          <Text className="text-muted">People with access to this organization.</Text>
        </Stack>
        <Cluster className="gap-2">
          <Button href="/app/members/import" variant="secondary">
            Import CSV
          </Button>
          <Button href="/app/members/invite">Invite member</Button>
        </Cluster>
      </Cluster>

      {params.invited && (
        <Alert title="Invitation sent" description="The invitation email is on its way." />
      )}

      <form className="flex flex-wrap items-end gap-3" method="get">
        <Stack className="gap-1">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Name or email"
          />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status} className="w-40">
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="removed">Removed</option>
            <option value="all">All</option>
          </Select>
        </Stack>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {loadError && <Alert title="Could not load members" description={loadError} />}
      {!loadError && members.length === 0 && (
        <Alert title="No members yet" description="Invite your first employee to get started." />
      )}

      {!loadError && members.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Job title</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium">Location</th>
                <th className="py-2 pr-4 font-medium">Roles</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <a href={`/app/members/${member.id}`} className="font-medium text-cobalt">
                      {memberDisplayName(member)}
                    </a>
                  </td>
                  <td className="py-3 pr-4">{member.job_title ?? "—"}</td>
                  <td className="py-3 pr-4">{member.department_name ?? "—"}</td>
                  <td className="py-3 pr-4">{member.location_name ?? "—"}</td>
                  <td className="py-3 pr-4">{member.role_names.join(", ") || "—"}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={memberStatusBadgeStatus(member.status)}>
                      {member.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > members.length && (
            <Text className="text-muted mt-2 text-xs">
              Showing {members.length} of {total} members. Narrow your search to see more specific
              results.
            </Text>
          )}
        </ScrollArea>
      )}
    </Stack>
  );
}

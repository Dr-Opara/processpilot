import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listRoles } from "@/lib/services/roles";
import { AppError } from "@/lib/errors";

export default async function RolesPage() {
  let roles: Awaited<ReturnType<typeof listRoles>> = [];
  let loadError: string | null = null;
  try {
    roles = await listRoles();
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load roles.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Roles</Heading>
          <Text className="text-muted">
            System roles are fixed. Custom roles can only grant permissions you currently hold.
          </Text>
        </Stack>
        <Button href="/app/roles/new">Create custom role</Button>
      </Cluster>

      {loadError && <Alert title="Could not load roles" description={loadError} />}

      {!loadError && (
        <ScrollArea>
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Permissions</th>
                <th className="py-2 pr-4 font-medium">Members</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(({ role, permissions, memberCount }) => (
                <tr key={role.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    {role.is_system || role.archived_at ? (
                      <span className="font-medium">{role.name}</span>
                    ) : (
                      <a href={`/app/roles/${role.id}/edit`} className="font-medium text-cobalt">
                        {role.name}
                      </a>
                    )}
                    {role.archived_at && (
                      <span className="ml-2 text-xs text-muted">(archived)</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={role.is_system ? "neutral" : "success"}>
                      {role.is_system ? "System" : "Custom"}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4">{permissions.length}</td>
                  <td className="py-3 pr-4">{memberCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Stack>
  );
}

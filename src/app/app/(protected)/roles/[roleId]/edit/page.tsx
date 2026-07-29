import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Alert";
import { listRoles } from "@/lib/services/roles";
import { listPermissions } from "@/lib/services/custom-roles";
import { getCurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { archiveCustomRoleAction, updateCustomRoleAction } from "../../actions";

export default async function EditRolePage({
  params,
  searchParams,
}: {
  params: Promise<{ roleId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { roleId } = await params;
  const { error } = await searchParams;

  let roles: Awaited<ReturnType<typeof listRoles>> = [];
  let permissions: Awaited<ReturnType<typeof listPermissions>> = [];
  let loadError: string | null = null;
  const membership = await getCurrentMembership();
  try {
    [roles, permissions] = await Promise.all([listRoles(), listPermissions()]);
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load role.";
  }

  const entry = roles.find(({ role }) => role.id === roleId);
  if (!loadError && !entry) notFound();
  if (entry?.role.is_system) notFound();

  const heldPermissions = new Set(membership.permissions);
  const currentPermissionKeys = new Set(entry?.permissions.map((p) => p.key) ?? []);

  const updateAction = updateCustomRoleAction.bind(null, roleId);
  const archiveAction = archiveCustomRoleAction.bind(null, roleId);

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Edit role</Heading>
        <Text className="text-muted">
          Currently assigned to {entry?.memberCount ?? 0} member(s).
        </Text>
      </Stack>

      {(loadError ?? error) && (
        <Alert title="Could not update role" description={loadError ?? error ?? ""} />
      )}

      {entry && !entry.role.archived_at && (
        <>
          <form action={updateAction} className="flex flex-col gap-4">
            <Stack className="gap-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={entry.role.name}
                required
                maxLength={100}
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={entry.role.description ?? ""}
                maxLength={500}
                rows={2}
              />
            </Stack>
            <Stack className="gap-2">
              <Label>Permissions</Label>
              <Stack className="max-h-96 gap-2 overflow-y-auto rounded-md border border-border p-3">
                {permissions.map((permission) => {
                  const held = heldPermissions.has(permission.key);
                  return (
                    <label
                      key={permission.id}
                      className={`flex items-start gap-2 text-sm ${held ? "" : "opacity-40"}`}
                    >
                      <Checkbox
                        name="permissionKeys"
                        value={permission.key}
                        defaultChecked={currentPermissionKeys.has(permission.key)}
                        disabled={!held}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium">{permission.key}</span>
                        <span className="block text-xs text-muted">{permission.description}</span>
                      </span>
                    </label>
                  );
                })}
              </Stack>
            </Stack>
            <Cluster className="justify-end gap-3">
              <Button href="/app/roles" variant="secondary">
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </Cluster>
          </form>

          <form action={archiveAction} className="border-t border-border pt-4">
            <Cluster className="justify-between">
              <Text className="text-sm text-muted">
                Archiving prevents this role from being assigned again. It&apos;s blocked while any
                member currently holds it.
              </Text>
              <Button type="submit" variant="secondary">
                Archive role
              </Button>
            </Cluster>
          </form>
        </>
      )}
    </Stack>
  );
}

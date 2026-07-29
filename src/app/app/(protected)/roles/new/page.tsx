import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Alert";
import { listPermissions, listRoleTemplates } from "@/lib/services/custom-roles";
import { getCurrentMembership } from "@/lib/authz";
import { createCustomRoleAction } from "../actions";

export default async function NewRolePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [permissions, templates, membership] = await Promise.all([
    listPermissions().catch(() => []),
    listRoleTemplates().catch(() => []),
    getCurrentMembership(),
  ]);
  const heldPermissions = new Set(membership.permissions);

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Create a custom role</Heading>
        <Text className="text-muted">
          You can only grant permissions you currently hold — this is enforced server-side, not just
          hidden in this form.
        </Text>
      </Stack>

      {error && <Alert title="Could not create role" description={error} />}

      {templates.length > 0 && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Text className="font-medium">Start from a template</Text>
          {templates.map(({ template, permissions: templatePermissions }) => (
            <form
              key={template.id}
              action={createCustomRoleAction}
              className="flex items-center gap-3"
            >
              <input type="hidden" name="templateId" value={template.id} />
              <input type="hidden" name="name" value={template.name} />
              <Stack className="flex-1 gap-0.5">
                <Text className="font-medium">{template.name}</Text>
                <Text className="text-xs text-muted">
                  {template.description} ({templatePermissions.length} permissions)
                </Text>
              </Stack>
              <Button type="submit" variant="secondary">
                Use template
              </Button>
            </form>
          ))}
        </Stack>
      )}

      <form action={createCustomRoleAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={100} autoFocus />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea id="description" name="description" maxLength={500} rows={2} />
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
                    disabled={!held}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{permission.key}</span>
                    <span className="block text-xs text-muted">{permission.description}</span>
                    {!held && (
                      <span className="block text-xs text-red-600">
                        You don&apos;t hold this permission.
                      </span>
                    )}
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
          <Button type="submit">Create role</Button>
        </Cluster>
      </form>
    </Stack>
  );
}

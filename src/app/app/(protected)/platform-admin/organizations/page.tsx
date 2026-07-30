import Link from "next/link";
import { Heading, Label } from "@/components/ui/Typography";
import { Stack, ScrollArea } from "@/components/ui/Layout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listOrganizationsForPlatformAdmin } from "@/lib/services/platform-admin";
import { AppError } from "@/lib/errors";

export default async function PlatformAdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;

  let organizations: Awaited<ReturnType<typeof listOrganizationsForPlatformAdmin>> = [];
  let loadError: string | null = null;
  try {
    organizations = await listOrganizationsForPlatformAdmin(search);
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load organizations.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Stack className="gap-1">
        <Link href="/app/platform-admin" className="text-sm text-cobalt">
          ← Platform administration
        </Link>
        <Heading as="h1">Organizations</Heading>
      </Stack>

      {loadError && <Alert title="Access denied" description={loadError} />}

      {!loadError && (
        <>
          <form className="flex items-end gap-3" method="get">
            <Stack className="gap-1">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Name or slug"
              />
            </Stack>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          <ScrollArea>
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Members</th>
                  <th className="py-2 pr-4 font-medium">Subscription</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map(
                  ({ organization, memberCount, subscriptionStatus, isSuspended }) => (
                    <tr key={organization.id} className="border-b border-border/60">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/app/platform-admin/organizations/${organization.id}`}
                          className="font-medium text-cobalt"
                        >
                          {organization.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{memberCount}</td>
                      <td className="py-3 pr-4">{subscriptionStatus ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={isSuspended ? "danger" : "success"}>
                          {isSuspended ? "Suspended" : "Active"}
                        </StatusBadge>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </ScrollArea>
        </>
      )}
    </Stack>
  );
}

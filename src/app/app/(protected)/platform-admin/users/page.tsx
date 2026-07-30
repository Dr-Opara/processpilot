import Link from "next/link";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { lookupUserByEmail } from "@/lib/services/platform-admin";
import { AppError } from "@/lib/errors";

export default async function PlatformAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  let result: Awaited<ReturnType<typeof lookupUserByEmail>> = null;
  let loadError: string | null = null;
  if (email) {
    try {
      result = await lookupUserByEmail(email);
    } catch (err) {
      loadError = err instanceof AppError ? err.message : "Could not look up this user.";
    }
  }

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Link href="/app/platform-admin" className="text-sm text-cobalt">
          ← Platform administration
        </Link>
        <Heading as="h1">User lookup</Heading>
      </Stack>

      {loadError && <Alert title="Access denied" description={loadError} />}

      <form className="flex items-end gap-3" method="get">
        <Stack className="gap-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={email ?? ""} required />
        </Stack>
        <Button type="submit" variant="secondary">
          Look up
        </Button>
      </form>

      {email && !loadError && !result && (
        <Text className="text-sm text-muted">No account found for that email.</Text>
      )}

      {result && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Text className="font-semibold">
            {[result.firstName, result.lastName].filter(Boolean).join(" ") || result.email}
          </Text>
          <Text className="text-sm text-muted">{result.email}</Text>
          <Stack className="gap-2">
            {result.memberships.map((m) => (
              <Cluster key={m.organizationId} className="justify-between">
                <Link
                  href={`/app/platform-admin/organizations/${m.organizationId}`}
                  className="text-cobalt"
                >
                  {m.organizationName}
                </Link>
                <Text className="text-sm text-muted">{m.status}</Text>
              </Cluster>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

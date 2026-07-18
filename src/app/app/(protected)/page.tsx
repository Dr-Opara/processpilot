import { auth, currentUser } from "@clerk/nextjs/server";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export default async function DashboardPage() {
  const { orgId, orgSlug } = await auth();
  const user = await currentUser();

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Welcome{user?.firstName ? `, ${user.firstName}` : ""}</Heading>
        <Text className="text-muted">
          This is a placeholder dashboard proving sign-in, session verification, and organization
          context work end to end. The real product surface (My Work, Processes, Knowledge, and so
          on, per product/information-architecture.md) is built starting in Phase 5.
        </Text>
      </Stack>

      {orgId ? (
        <Alert
          title="Organization active"
          description={`You're viewing data as a member of ${orgSlug ?? orgId}.`}
        />
      ) : (
        <Stack className="gap-3">
          <Alert
            title="No organization yet"
            description="Create an organization to continue, or ask an admin to invite you to theirs."
          />
          <Button href="/app/create-organization" className="self-start">
            Create an organization
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { DemoGuidedTour } from "@/components/app/DemoGuidedTour";

export default async function DashboardPage() {
  const { orgId, orgSlug } = await auth();
  const user = await currentUser();
  const membership = await getCurrentMembership().catch(() => null);

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      {membership?.organization.is_demo && <DemoGuidedTour />}
      <Stack className="gap-1">
        <Heading as="h1">Welcome{user?.firstName ? `, ${user.firstName}` : ""}</Heading>
        <Text className="text-muted">
          Use the navigation to get started with My Work, Processes, Knowledge, Workflows, and the
          rest of ProcessPilot&apos;s product surface.
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

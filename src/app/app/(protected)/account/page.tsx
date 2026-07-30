import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCurrentMembership } from "@/lib/authz";
import { getTermsAcceptance } from "@/lib/services/legal";

export default async function AccountPage() {
  const membership = await getCurrentMembership();
  const terms = await getTermsAcceptance().catch(() => null);
  const isOwner = membership.permissions.includes("organization.manage");

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">My account</Heading>
        <Text className="text-muted">Your profile, data, and legal agreement status.</Text>
      </Stack>

      <Stack className="gap-2 rounded-md border border-border p-4">
        <Cluster className="justify-between">
          <Text>Email</Text>
          <Text className="text-muted">{membership.profile.email}</Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Organization</Text>
          <Text className="text-muted">{membership.organization.name}</Text>
        </Cluster>
      </Stack>

      <Stack className="gap-3">
        <Heading as="h2">Terms of Service</Heading>
        {terms?.accepted ? (
          <Cluster className="items-center gap-2">
            <StatusBadge status="success">Accepted</StatusBadge>
            <Text className="text-sm text-muted">
              v{terms.version} on{" "}
              {terms.acceptedAt ? new Date(terms.acceptedAt).toLocaleDateString() : "—"}
            </Text>
          </Cluster>
        ) : (
          <StatusBadge status="warning">Not yet accepted</StatusBadge>
        )}
        <Text className="text-sm text-muted">
          Read the current{" "}
          <Link href="/terms" className="text-cobalt">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-cobalt">
            Privacy Policy
          </Link>
          .
        </Text>
      </Stack>

      <Stack className="gap-3">
        <Heading as="h2">Your data</Heading>
        <Text className="text-sm text-muted">
          Download your profile, membership, and recent activity as JSON.
        </Text>
        <Button href="/app/account/export" variant="secondary" className="w-fit">
          Export my data
        </Button>
        {isOwner && (
          <Text className="text-sm text-muted">
            As an organization owner, you can also request a full organization export or deletion
            from{" "}
            <Link href="/app/organization/settings" className="text-cobalt">
              Organization Settings
            </Link>
            .
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

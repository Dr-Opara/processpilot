import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { ApprovalPolicyForm } from "../ApprovalPolicyForm";
import { createApprovalPolicyAction } from "../actions";

export default async function NewApprovalPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add approval policy</Heading>
        <Text className="text-muted">
          Define who must approve and how their decisions combine into an outcome.
        </Text>
      </Stack>

      {error && <Alert title="Could not save policy" description={error} />}

      <ApprovalPolicyForm action={createApprovalPolicyAction} cancelHref="/app/approval-policies" />
    </Stack>
  );
}

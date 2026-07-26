import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { createExceptionAction } from "../actions";
import { ExceptionForm } from "../ExceptionForm";

export default async function NewExceptionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Report an exception</Heading>
        <Text className="text-muted">Flag a deviation for triage and corrective action.</Text>
      </Stack>

      {error && <Alert title="Could not report this exception" description={error} />}

      <ExceptionForm action={createExceptionAction} />
    </Stack>
  );
}

import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { FormBuilder } from "../FormBuilder";
import { createFormAction } from "../actions";

export default async function NewFormPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Stack className="mx-auto max-w-3xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add form</Heading>
        <Text className="text-muted">
          Define the fields this form captures. It&rsquo;s created as a draft — publish it once
          it&rsquo;s ready.
        </Text>
      </Stack>

      {error && <Alert title="Could not save form" description={error} />}

      <FormBuilder action={createFormAction} cancelHref="/app/forms" />
    </Stack>
  );
}

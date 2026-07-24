import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { getForm } from "@/lib/services/forms";
import { AppError } from "@/lib/errors";
import { FormBuilder } from "../../FormBuilder";
import { createNewVersionAction, updateDraftVersionAction } from "../../actions";

export default async function EditFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { formId } = await params;
  const { error } = await searchParams;

  let detail;
  try {
    detail = await getForm(formId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }
  const { form, currentVersion, versions } = detail;
  const draftVersion = versions.find((v) => v.status === "draft");
  const base = draftVersion ?? currentVersion;

  const action = draftVersion
    ? updateDraftVersionAction.bind(null, form.id, draftVersion.id)
    : createNewVersionAction.bind(null, form.id);

  return (
    <Stack className="mx-auto max-w-3xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">{draftVersion ? "Edit draft" : "Create a new version"}</Heading>
        <Text className="text-muted">{form.title}</Text>
      </Stack>

      {error && <Alert title="Could not save form" description={error} />}

      <FormBuilder
        action={action}
        initialTitle={base?.title ?? form.title}
        initialFields={base?.definition.fields ?? []}
        cancelHref={`/app/forms/${form.id}`}
      />
    </Stack>
  );
}

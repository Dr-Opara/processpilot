import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { getDocument } from "@/lib/services/knowledge-documents";
import { AppError } from "@/lib/errors";
import { NewVersionForm } from "./NewVersionForm";

export default async function NewVersionPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { documentId } = await params;
  const { error } = await searchParams;

  let detail;
  try {
    detail = await getDocument(documentId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Create a new version</Heading>
        <Text className="text-muted">{detail.document.title}</Text>
      </Stack>

      {error && <Alert title="Could not create version" description={error} />}

      <NewVersionForm documentId={documentId} defaultTitle={detail.document.title} />
    </Stack>
  );
}

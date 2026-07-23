import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { getDocument } from "@/lib/services/knowledge-documents";
import { AppError } from "@/lib/errors";
import { updateDraftVersionAction } from "../../actions";

export default async function EditKnowledgeDocumentPage({
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
  const draft = detail.versions.find((v) => v.status === "draft");
  if (!draft) notFound();

  if (draft.source !== "authored") {
    return (
      <Stack className="mx-auto max-w-xl gap-6">
        <Alert
          title="This draft can't be edited in place"
          description="Uploaded-file versions aren't editable — archive this draft's content by creating a new version instead."
        />
        <Button href={`/app/knowledge/${documentId}`} variant="secondary">
          Back to document
        </Button>
      </Stack>
    );
  }

  const updateAction = updateDraftVersionAction.bind(null, documentId, draft.id);

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Edit draft</Heading>
        <Text className="text-muted">{detail.document.title}</Text>
      </Stack>

      {error && <Alert title="Could not save changes" description={error} />}

      <form action={updateAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required maxLength={300} defaultValue={draft.title} />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="content">Content</Label>
          <Textarea id="content" name="content" rows={12} defaultValue={draft.content ?? ""} />
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href={`/app/knowledge/${documentId}`} variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </Cluster>
      </form>
    </Stack>
  );
}

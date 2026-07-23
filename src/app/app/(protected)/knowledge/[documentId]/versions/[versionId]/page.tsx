import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getDocument } from "@/lib/services/knowledge-documents";
import { AppError } from "@/lib/errors";

function statusBadgeStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "in_review") return "warning";
  if (status === "archived" || status === "rejected") return "danger";
  return "neutral";
}

export default async function DocumentVersionPage({
  params,
}: {
  params: Promise<{ documentId: string; versionId: string }>;
}) {
  const { documentId, versionId } = await params;

  let detail;
  try {
    detail = await getDocument(documentId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }
  const version = detail.versions.find((v) => v.id === versionId);
  if (!version) notFound();

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">
              {detail.document.title} — v{version.version_number}
            </Heading>
            <StatusBadge status={statusBadgeStatus(version.status)}>{version.status}</StatusBadge>
          </Cluster>
          <Text className="text-muted">
            {version.source === "uploaded"
              ? `Uploaded file: ${version.original_filename}`
              : "Authored in-app"}
          </Text>
        </Stack>
        <Button href={`/app/knowledge/${documentId}`} variant="secondary">
          Back to document
        </Button>
      </Cluster>

      {version.review_notes && <Alert title="Review notes" description={version.review_notes} />}

      <Stack className="gap-2 rounded-md border border-border p-4">
        <Cluster className="justify-between">
          <Text>Submitted</Text>
          <Text className="text-muted">
            {version.submitted_at ? new Date(version.submitted_at).toLocaleString() : "—"}
          </Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Reviewed</Text>
          <Text className="text-muted">
            {version.reviewed_at ? new Date(version.reviewed_at).toLocaleString() : "—"}
          </Text>
        </Cluster>
        <Cluster className="justify-between">
          <Text>Published</Text>
          <Text className="text-muted">
            {version.published_at ? new Date(version.published_at).toLocaleString() : "—"}
          </Text>
        </Cluster>
      </Stack>

      {version.source === "uploaded" ? (
        <Cluster>
          <Button
            href={`/app/knowledge/${documentId}/versions/${versionId}/download`}
            variant="secondary"
          >
            Download {version.original_filename}
          </Button>
        </Cluster>
      ) : (
        <Stack className="gap-2 rounded-md border border-border p-4">
          <pre className="whitespace-pre-wrap font-sans text-sm text-ink">{version.content}</pre>
        </Stack>
      )}
    </Stack>
  );
}

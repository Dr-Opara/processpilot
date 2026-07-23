import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Textarea } from "@/components/ui/Textarea";
import { getCurrentMembership } from "@/lib/authz";
import { getDocument } from "@/lib/services/knowledge-documents";
import { listDepartments } from "@/lib/services/departments";
import { listMembers } from "@/lib/services/members";
import { memberDisplayName } from "@/lib/services/member-display";
import { AppError } from "@/lib/errors";
import {
  approveAndPublishAction,
  archiveDocumentAction,
  rejectReviewAction,
  restoreDocumentAction,
  submitForReviewAction,
} from "../actions";

function statusBadgeStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "in_review") return "warning";
  if (status === "archived" || status === "rejected") return "danger";
  if (status === "superseded") return "neutral";
  return "neutral";
}

export default async function KnowledgeDocumentDetailPage({
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
  const { document, currentVersion, versions } = detail;

  const [departments, membersResult, currentMembership] = await Promise.all([
    listDepartments({ status: "all" }).catch(() => []),
    listMembers({ status: "all", pageSize: 100 }).catch(() => ({ members: [], total: 0 })),
    getCurrentMembership().catch(() => null),
  ]);

  const departmentName = document.department_id
    ? (departments.find((d) => d.id === document.department_id)?.name ?? "—")
    : null;
  const owner = document.owner_member_id
    ? membersResult.members.find((m) => m.id === document.owner_member_id)
    : null;

  const draftVersion = versions.find((v) => v.status === "draft");
  const inReviewVersion = versions.find((v) => v.status === "in_review");
  const canReview = Boolean(
    currentMembership?.permissions.includes("knowledge.review") ||
    currentMembership?.scopedPermissions.includes("knowledge.review"),
  );
  const canPublish = Boolean(
    currentMembership?.permissions.includes("knowledge.publish") ||
    currentMembership?.scopedPermissions.includes("knowledge.publish"),
  );

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">{document.title}</Heading>
            <StatusBadge status={statusBadgeStatus(document.status)}>{document.status}</StatusBadge>
          </Cluster>
          <Text className="text-muted">
            {[document.category, departmentName].filter(Boolean).join(" · ") || "Organization-wide"}
          </Text>
          {owner && <Text className="text-muted">Owner: {memberDisplayName(owner)}</Text>}
          {document.tags.length > 0 && (
            <Text className="text-muted">Tags: {document.tags.join(", ")}</Text>
          )}
        </Stack>
        <Cluster className="gap-2">
          {document.archived_at ? (
            <form action={restoreDocumentAction.bind(null, document.id)}>
              <Button type="submit" variant="secondary">
                Restore
              </Button>
            </form>
          ) : (
            <form action={archiveDocumentAction.bind(null, document.id)}>
              <Button type="submit" variant="secondary">
                Archive
              </Button>
            </form>
          )}
        </Cluster>
      </Cluster>

      {error && <Alert title="Action could not be completed" description={error} />}

      <Stack className="gap-2 rounded-md border border-border p-4">
        <Heading as="h2">Current published version</Heading>
        {currentVersion ? (
          <Stack className="gap-1">
            <Text>Version {currentVersion.version_number}</Text>
            <Text className="text-muted">
              Published{" "}
              {currentVersion.published_at
                ? new Date(currentVersion.published_at).toLocaleString()
                : "—"}
            </Text>
            <Cluster>
              <Button
                href={`/app/knowledge/${document.id}/versions/${currentVersion.id}`}
                variant="secondary"
              >
                View
              </Button>
            </Cluster>
          </Stack>
        ) : (
          <Text className="text-muted">No version has been published yet.</Text>
        )}
      </Stack>

      {draftVersion && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Draft in progress — version {draftVersion.version_number}</Heading>
          <Cluster className="gap-3">
            <Button href={`/app/knowledge/${document.id}/edit`} variant="secondary">
              {draftVersion.source === "authored" ? "Edit draft" : "View draft"}
            </Button>
            <form action={submitForReviewAction.bind(null, document.id, draftVersion.id)}>
              <Button type="submit">Submit for review</Button>
            </form>
          </Cluster>
        </Stack>
      )}

      {inReviewVersion && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">In review — version {inReviewVersion.version_number}</Heading>
          <Cluster className="gap-3">
            <Button
              href={`/app/knowledge/${document.id}/versions/${inReviewVersion.id}`}
              variant="secondary"
            >
              View
            </Button>
            {canPublish && (
              <form action={approveAndPublishAction.bind(null, document.id, inReviewVersion.id)}>
                <Button type="submit">Approve &amp; publish</Button>
              </form>
            )}
          </Cluster>
          {canReview && (
            <form
              action={rejectReviewAction.bind(null, document.id, inReviewVersion.id)}
              className="flex flex-col gap-2"
            >
              <Label htmlFor="reviewNotes">Rejection notes</Label>
              <Textarea id="reviewNotes" name="reviewNotes" rows={2} />
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Reject
                </Button>
              </Cluster>
            </form>
          )}
        </Stack>
      )}

      {!draftVersion && !inReviewVersion && (
        <Cluster>
          <Button href={`/app/knowledge/${document.id}/new-version`} variant="secondary">
            Create a new version
          </Button>
        </Cluster>
      )}

      <Stack className="gap-3">
        <Heading as="h2">Version history</Heading>
        <ScrollArea>
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Version</th>
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">
                    <a
                      href={`/app/knowledge/${document.id}/versions/${version.id}`}
                      className="font-medium text-cobalt"
                    >
                      v{version.version_number}
                    </a>
                  </td>
                  <td className="py-2 pr-4">{version.source}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={statusBadgeStatus(version.status)}>
                      {version.status}
                    </StatusBadge>
                  </td>
                  <td className="py-2 pr-4">{new Date(version.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </Stack>
    </Stack>
  );
}

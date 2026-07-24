import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { getForm } from "@/lib/services/forms";
import { AppError } from "@/lib/errors";
import { archiveFormAction, publishFormVersionAction, restoreFormAction } from "../actions";

function statusBadgeStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "archived" || status === "superseded") return "neutral";
  return "warning";
}

export default async function FormDetailPage({
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

  const currentMembership = await getCurrentMembership().catch(() => null);
  const canPublish = Boolean(
    currentMembership?.permissions.includes("form.publish") ||
    currentMembership?.scopedPermissions.includes("form.publish"),
  );

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">{form.title}</Heading>
            <StatusBadge status={statusBadgeStatus(form.status)}>{form.status}</StatusBadge>
          </Cluster>
          {form.description && <Text className="text-muted">{form.description}</Text>}
        </Stack>
        <Cluster className="gap-2">
          {form.archived_at ? (
            <form action={restoreFormAction.bind(null, form.id)}>
              <Button type="submit" variant="secondary">
                Restore
              </Button>
            </form>
          ) : (
            <form action={archiveFormAction.bind(null, form.id)}>
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
          <Text>
            Version {currentVersion.version_number} — {currentVersion.definition.fields.length}{" "}
            field(s)
          </Text>
        ) : (
          <Text className="text-muted">No version has been published yet.</Text>
        )}
      </Stack>

      {draftVersion ? (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Draft in progress — version {draftVersion.version_number}</Heading>
          <Cluster className="gap-3">
            <Button href={`/app/forms/${form.id}/edit`} variant="secondary">
              Edit draft
            </Button>
            {canPublish && (
              <form action={publishFormVersionAction.bind(null, form.id, draftVersion.id)}>
                <Button type="submit">Publish</Button>
              </form>
            )}
          </Cluster>
        </Stack>
      ) : (
        <Cluster>
          <Button href={`/app/forms/${form.id}/edit`} variant="secondary">
            Create a new version
          </Button>
        </Cluster>
      )}

      <Stack className="gap-3">
        <Heading as="h2">Version history</Heading>
        <ScrollArea>
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Version</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">v{version.version_number}</td>
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

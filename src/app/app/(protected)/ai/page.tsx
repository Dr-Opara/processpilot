import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { isAiConfigured } from "@/lib/ai/availability";
import { isAiCopilotEnabledForOrg } from "@/lib/services/ai-settings";
import { listAiDrafts } from "@/lib/services/ai-drafts";
import { listDocuments } from "@/lib/services/knowledge-documents";
import { listTrainingCourses } from "@/lib/services/training-courses";
import { listProcesses } from "@/lib/services/processes";
import { listExceptions } from "@/lib/services/exceptions";
import type { AiDraftStatus } from "@/lib/db/database.types";
import {
  acceptAiDraftAction,
  askQuestionAction,
  compareDocumentVersionsAction,
  dismissAiDraftAction,
  draftTrainingContentAction,
  extractProcessStepsAction,
  suggestProcessImprovementsAction,
  summarizeExceptionAction,
} from "./actions";

function draftStatusBadge(status: AiDraftStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "accepted") return "success";
  if (status === "dismissed") return "neutral";
  return "warning";
}

export default async function AiCopilotPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = isAiConfigured();
  const currentMembership = await getCurrentMembership().catch(() => null);
  const canUseAi = Boolean(
    currentMembership?.permissions.includes("ai.use") ||
    currentMembership?.scopedPermissions.includes("ai.use"),
  );
  const enabled =
    configured && canUseAi ? await isAiCopilotEnabledForOrg().catch(() => false) : false;
  const available = configured && enabled;

  const [documents, courses, processes, exceptions, drafts] = await Promise.all([
    listDocuments().catch(() => []),
    listTrainingCourses().catch(() => []),
    listProcesses().catch(() => []),
    listExceptions().catch(() => []),
    listAiDrafts().catch(() => []),
  ]);

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">AI copilot</Heading>
        <Text className="text-muted">
          Drafts and suggestions only — every result here requires a separate, explicit human action
          to take effect. Nothing on this page publishes, approves, closes, or certifies anything by
          itself.
        </Text>
      </Stack>

      {error && <Alert title="Could not complete this request" description={error} />}
      {!configured && (
        <Alert
          title="AI is not configured"
          description="No AI provider credential is set up in this environment yet."
        />
      )}
      {configured && !enabled && (
        <Alert
          title="AI copilot is unavailable"
          description="It's disabled for this organization, or you don't have the ai.use permission."
        />
      )}

      {available && (
        <>
          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2">Ask a question</Heading>
            <Text className="text-sm text-muted">
              Answered only from your organization&apos;s published knowledge documents, with
              citations.
            </Text>
            <form action={askQuestionAction} className="flex flex-col gap-2">
              <Textarea
                name="question"
                rows={2}
                placeholder="How do I onboard a new vendor?"
                required
              />
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Ask
                </Button>
              </Cluster>
            </form>
          </Stack>

          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2">Extract process steps from a document</Heading>
            <form action={extractProcessStepsAction} className="flex flex-col gap-2">
              <Select name="knowledgeDocumentId" required className="w-full">
                <option value="">Select a published document</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </Select>
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Draft steps
                </Button>
              </Cluster>
            </form>
          </Stack>

          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2">Draft training content</Heading>
            <form action={draftTrainingContentAction} className="flex flex-col gap-2">
              <Select name="courseId" required className="w-full">
                <option value="">Select a course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
              <Input name="topic" placeholder="Topic" required />
              <Select name="sourceDocumentId" className="w-full">
                <option value="">Ground in a document (optional)</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </Select>
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Draft content
                </Button>
              </Cluster>
            </form>
          </Stack>

          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2">Compare document versions</Heading>
            <Text className="text-sm text-muted">
              Compares a document&apos;s two most recent versions.
            </Text>
            <form action={compareDocumentVersionsAction} className="flex flex-col gap-2">
              <Select name="documentId" required className="w-full">
                <option value="">Select a document</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </Select>
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Compare
                </Button>
              </Cluster>
            </form>
          </Stack>

          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2">Summarize an exception</Heading>
            <form action={summarizeExceptionAction} className="flex flex-col gap-2">
              <Select name="exceptionId" required className="w-full">
                <option value="">Select an exception</option>
                {exceptions.map((exception) => (
                  <option key={exception.id} value={exception.id}>
                    {exception.title}
                  </option>
                ))}
              </Select>
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Summarize
                </Button>
              </Cluster>
            </form>
          </Stack>

          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2">Suggest process improvements</Heading>
            <Text className="text-sm text-muted">
              Grounded in this process&apos;s own exception history.
            </Text>
            <form action={suggestProcessImprovementsAction} className="flex flex-col gap-2">
              <Select name="processId" required className="w-full">
                <option value="">Select a process</option>
                {processes.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.title}
                  </option>
                ))}
              </Select>
              <Cluster className="justify-end">
                <Button type="submit" variant="secondary">
                  Suggest improvements
                </Button>
              </Cluster>
            </form>
          </Stack>
        </>
      )}

      <Stack className="gap-3">
        <Heading as="h2">Drafts and suggestions</Heading>
        {drafts.length === 0 ? (
          <Text className="text-muted">Nothing generated yet.</Text>
        ) : (
          drafts.map((draft) => (
            <Stack key={draft.id} className="gap-2 rounded-md border border-border p-3">
              <Cluster className="justify-between">
                <Text className="text-sm font-medium">{draft.prompt_summary}</Text>
                <StatusBadge status={draftStatusBadge(draft.status)}>{draft.status}</StatusBadge>
              </Cluster>
              <pre className="overflow-x-auto rounded-md bg-paper p-2 text-xs">
                {JSON.stringify(draft.output, null, 2)}
              </pre>
              <Text className="text-xs text-muted">
                {draft.model} · {draft.input_tokens + draft.output_tokens} tokens ·{" "}
                {new Date(draft.created_at).toLocaleString()}
              </Text>
              {draft.status === "pending" && (
                <Cluster className="gap-2">
                  <form action={acceptAiDraftAction.bind(null, draft.id)}>
                    <Button type="submit" variant="secondary">
                      Mark reviewed
                    </Button>
                  </form>
                  <form action={dismissAiDraftAction.bind(null, draft.id)}>
                    <Button type="submit" variant="secondary">
                      Dismiss
                    </Button>
                  </form>
                </Cluster>
              )}
            </Stack>
          ))
        )}
      </Stack>
    </Stack>
  );
}

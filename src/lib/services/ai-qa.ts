import "server-only";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isAiConfigured } from "@/lib/ai/availability";
import { isAiCopilotEnabledForOrg } from "@/lib/services/ai-settings";
import { getAiProvider } from "@/lib/ai/get-provider";
import { GOVERNANCE_SYSTEM_PREAMBLE, validateCitations, wrapSource } from "@/lib/ai/prompt-safety";
import { createAiDraft } from "@/lib/services/ai-drafts";
import type { AiDraftRow, KnowledgeDocumentRow } from "@/lib/db/database.types";

/**
 * Grounded Q&A — answers using only the organization's own approved
 * (published) knowledge documents, never open-web knowledge presented
 * as organizational fact, per ai-architecture.md. Retrieval is a plain
 * keyword search over published document titles/content, scoped to the
 * caller's organization (never another tenant's data, even indirectly)
 * — not a vector store, which this phase's scope doesn't call for.
 */

function toTenantContext(membership: {
  organization: { id: string };
  member: { id: string };
  profile: { clerk_user_id: string };
}) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

const askQuestionInputSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(1000),
});

export interface AskQuestionResult {
  draft: AiDraftRow;
  answer: string;
  citations: { documentId: string; title: string }[];
}

const MAX_SOURCES = 5;
const MAX_SOURCE_CHARS = 4000;

export async function askQuestion(input: { question: string }): Promise<AskQuestionResult> {
  const data = askQuestionInputSchema.parse(input);
  if (!isAiConfigured())
    throw new AppError("unavailable", "AI is not configured for this environment yet.");

  const membership = await requirePermission("ai.use");
  if (!(await isAiCopilotEnabledForOrg())) {
    throw new AppError("unavailable", "The AI copilot is disabled for this organization.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const keywords = data.question
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3)
      .slice(0, 8);
    const likePattern =
      keywords.length > 0 ? `%${keywords.join("%")}%` : `%${data.question.toLowerCase()}%`;

    const matches = await tx<
      (KnowledgeDocumentRow & {
        version_id: string;
        content: string | null;
        extracted_text: string | null;
        title: string;
      })[]
    >`
      select kd.*, dv.id as version_id, dv.content, dv.extracted_text, dv.title
      from knowledge_documents kd
      join document_versions dv on dv.id = kd.current_version_id
      where kd.organization_id = ${membership.organization.id}
        and kd.status = 'published'
        and (lower(dv.title) like ${likePattern} or lower(coalesce(dv.content, dv.extracted_text, '')) like ${likePattern})
      order by kd.updated_at desc
      limit ${MAX_SOURCES}
    `;

    if (matches.length === 0) {
      const [draft] = [
        await createAiDraft(tx, {
          organizationId: membership.organization.id,
          draftType: "qa_answer",
          promptSummary: `Q&A: ${data.question}`,
          output: {
            answer: "No approved organizational sources matched this question.",
            citations: [],
          },
          model: "none",
          inputTokens: 0,
          outputTokens: 0,
          createdByMemberId: membership.member.id,
        }),
      ];
      return {
        draft,
        answer: "No approved organizational sources matched this question.",
        citations: [],
      };
    }

    const availableSources = matches.map((m) => ({ id: m.id, label: m.title }));
    const sourceBlocks = matches
      .map((m) =>
        wrapSource(m.title, m.id, (m.content ?? m.extracted_text ?? "").slice(0, MAX_SOURCE_CHARS)),
      )
      .join("\n\n");

    const userPrompt = `Answer the question using only the <source> blocks below. If the sources don't contain the answer, say so plainly rather than guessing. Respond as JSON: {"answer": string, "citedSourceIds": string[]}.

Question: ${data.question}

${sourceBlocks}`;

    const provider = getAiProvider();
    const result = await provider.complete({
      systemPrompt: GOVERNANCE_SYSTEM_PREAMBLE,
      userPrompt,
    });

    let parsed: { answer: string; citedSourceIds: string[] };
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = { answer: result.text, citedSourceIds: [] };
    }
    const citations = validateCitations(
      (parsed.citedSourceIds ?? []).map((id) => ({ sourceId: id, label: "" })),
      availableSources,
    ).map((c) => ({
      sourceId: c.sourceId,
      label: availableSources.find((s) => s.id === c.sourceId)?.label ?? "",
    }));

    const draft = await createAiDraft(tx, {
      organizationId: membership.organization.id,
      draftType: "qa_answer",
      promptSummary: `Q&A: ${data.question}`,
      output: { answer: parsed.answer, citations },
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      createdByMemberId: membership.member.id,
    });

    return {
      draft,
      answer: parsed.answer,
      citations: citations.map((c) => ({ documentId: c.sourceId, title: c.label })),
    };
  });
}

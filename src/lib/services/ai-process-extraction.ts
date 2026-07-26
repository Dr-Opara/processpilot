import "server-only";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isAiConfigured } from "@/lib/ai/availability";
import { isAiCopilotEnabledForOrg } from "@/lib/services/ai-settings";
import { getAiProvider } from "@/lib/ai/get-provider";
import { GOVERNANCE_SYSTEM_PREAMBLE, wrapSource } from "@/lib/ai/prompt-safety";
import { createAiDraft } from "@/lib/services/ai-drafts";
import { getDocument } from "@/lib/services/knowledge-documents";
import type { AiDraftRow } from "@/lib/db/database.types";

/**
 * Drafts proposed process steps from a published knowledge document —
 * "AI-assisted draft extraction," deferred from Phase 7 to this phase
 * per workflow-engine.md/phase-tracker.md. Output is a plain suggested
 * step list a human reads and manually builds in the process canvas
 * (process-builder.ts's existing create/edit flow) — this module has
 * no import of anything that creates a real Process/ProcessVersion, so
 * there is no code path from a model's output to a published process.
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

const MAX_SOURCE_CHARS = 8000;

export async function extractProcessSteps(knowledgeDocumentId: string): Promise<AiDraftRow> {
  if (!isAiConfigured())
    throw new AppError("unavailable", "AI is not configured for this environment yet.");

  const { document, currentVersion } = await getDocument(knowledgeDocumentId);
  if (!currentVersion)
    throw new AppError("conflict", "This document has no published version to extract from.");

  const membership = await requirePermission("ai.use", {
    scope: { departmentId: document.department_id ?? undefined },
  });
  if (!(await isAiCopilotEnabledForOrg())) {
    throw new AppError("unavailable", "The AI copilot is disabled for this organization.");
  }

  const sourceText = (currentVersion.content ?? currentVersion.extracted_text ?? "").slice(
    0,
    MAX_SOURCE_CHARS,
  );
  const userPrompt = `Read the procedure described in the <source> block and propose a numbered sequence of process steps a manual process author could use as a starting point. Respond as JSON: {"steps": [{"order": number, "label": string, "description": string}]}.

${wrapSource(currentVersion.title, currentVersion.id, sourceText)}`;

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const provider = getAiProvider();
    const result = await provider.complete({
      systemPrompt: GOVERNANCE_SYSTEM_PREAMBLE,
      userPrompt,
    });

    let steps: { order: number; label: string; description: string }[];
    try {
      steps = JSON.parse(result.text).steps ?? [];
    } catch {
      steps = [];
    }

    return createAiDraft(tx, {
      organizationId: membership.organization.id,
      departmentId: document.department_id,
      draftType: "process_extraction",
      sourceType: "knowledge_document",
      sourceId: knowledgeDocumentId,
      promptSummary: `Extract process steps from "${currentVersion.title}"`,
      output: { steps },
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      createdByMemberId: membership.member.id,
    });
  });
}

import "server-only";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isAiConfigured } from "@/lib/ai/availability";
import { isAiCopilotEnabledForOrg } from "@/lib/services/ai-settings";
import { getAiProvider } from "@/lib/ai/get-provider";
import { GOVERNANCE_SYSTEM_PREAMBLE, wrapSource } from "@/lib/ai/prompt-safety";
import { createAiDraft } from "@/lib/services/ai-drafts";
import { getDocument } from "@/lib/services/knowledge-documents";
import type { AiDraftRow } from "@/lib/db/database.types";

/** Summarizes material differences between two versions of the same knowledge document — read-only; never mutates either version. */

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

const MAX_SOURCE_CHARS = 6000;

export async function compareDocumentVersions(
  documentId: string,
  versionAId: string,
  versionBId: string,
): Promise<AiDraftRow> {
  if (!isAiConfigured())
    throw new AppError("unavailable", "AI is not configured for this environment yet.");

  const preCheck = await getCurrentMembership();
  const { document, versions } = await getDocument(documentId);
  const versionA = versions.find((v) => v.id === versionAId);
  const versionB = versions.find((v) => v.id === versionBId);
  if (!versionA || !versionB)
    throw new AppError("not_found", "One or both versions were not found on this document.");

  const membership = await requirePermission("ai.use", {
    scope: { departmentId: document.department_id ?? undefined },
  });
  if (!(await isAiCopilotEnabledForOrg())) {
    throw new AppError("unavailable", "The AI copilot is disabled for this organization.");
  }

  const userPrompt = `Summarize the material differences between these two versions of the same document. Focus on substantive changes (added/removed/changed requirements or steps), not wording style. Respond as JSON: {"summary": string, "materialChanges": string[]}.

${wrapSource(`v${versionA.version_number}`, versionA.id, (versionA.content ?? versionA.extracted_text ?? "").slice(0, MAX_SOURCE_CHARS))}

${wrapSource(`v${versionB.version_number}`, versionB.id, (versionB.content ?? versionB.extracted_text ?? "").slice(0, MAX_SOURCE_CHARS))}`;

  return withTenantContext(toTenantContext(preCheck), async (tx) => {
    const provider = getAiProvider();
    const result = await provider.complete({
      systemPrompt: GOVERNANCE_SYSTEM_PREAMBLE,
      userPrompt,
    });

    let output: { summary: string; materialChanges: string[] };
    try {
      output = JSON.parse(result.text);
    } catch {
      output = { summary: result.text, materialChanges: [] };
    }

    return createAiDraft(tx, {
      organizationId: membership.organization.id,
      departmentId: document.department_id,
      draftType: "document_comparison",
      sourceType: "document_version",
      sourceId: versionBId,
      promptSummary: `Compare "${document.title}" v${versionA.version_number} vs v${versionB.version_number}`,
      output,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      createdByMemberId: membership.member.id,
    });
  });
}

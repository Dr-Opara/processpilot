import "server-only";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isAiConfigured } from "@/lib/ai/availability";
import { isAiCopilotEnabledForOrg } from "@/lib/services/ai-settings";
import { getAiProvider } from "@/lib/ai/get-provider";
import { GOVERNANCE_SYSTEM_PREAMBLE, wrapSource } from "@/lib/ai/prompt-safety";
import { createAiDraft } from "@/lib/services/ai-drafts";
import { getProcess } from "@/lib/services/processes";
import type { AiDraftRow, ExceptionRow } from "@/lib/db/database.types";

/**
 * Suggests process improvements grounded in the process's own real
 * exception history — never in generic best-practice advice detached
 * from this organization's actual data. Read-only: this module never
 * imports anything that edits a Process/ProcessVersion.
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

const MAX_EXCEPTIONS = 20;

export async function suggestProcessImprovements(processId: string): Promise<AiDraftRow> {
  if (!isAiConfigured())
    throw new AppError("unavailable", "AI is not configured for this environment yet.");

  const { process } = await getProcess(processId);
  const membership = await requirePermission("ai.use", {
    scope: { departmentId: process.department_id ?? undefined },
  });
  if (!(await isAiCopilotEnabledForOrg())) {
    throw new AppError("unavailable", "The AI copilot is disabled for this organization.");
  }

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const exceptions = await tx<
      Pick<ExceptionRow, "title" | "exception_type" | "severity" | "root_cause_summary">[]
    >`
      select title, exception_type, severity, root_cause_summary from exceptions
      where organization_id = ${membership.organization.id} and process_id = ${processId}
      order by created_at desc
      limit ${MAX_EXCEPTIONS}
    `;

    if (exceptions.length === 0) {
      return createAiDraft(tx, {
        organizationId: membership.organization.id,
        departmentId: process.department_id,
        draftType: "process_improvement",
        sourceType: "process",
        sourceId: processId,
        promptSummary: `Suggest improvements for "${process.title}"`,
        output: {
          suggestions: [],
          note: "No exception history exists yet for this process to ground suggestions in.",
        },
        model: "none",
        inputTokens: 0,
        outputTokens: 0,
        createdByMemberId: membership.member.id,
      });
    }

    const facts = exceptions
      .map(
        (e, i) =>
          `${i + 1}. [${e.exception_type}, ${e.severity}] ${e.title}${e.root_cause_summary ? ` — root cause: ${e.root_cause_summary}` : ""}`,
      )
      .join("\n");

    const userPrompt = `Based only on this process's own exception history in the <source> block, suggest concrete process improvements that would address the recurring or highest-severity issues. Respond as JSON: {"suggestions": [{"suggestion": string, "groundedIn": string}]}.

${wrapSource(`${process.title} — exception history`, processId, facts)}`;

    const provider = getAiProvider();
    const result = await provider.complete({
      systemPrompt: GOVERNANCE_SYSTEM_PREAMBLE,
      userPrompt,
    });

    let output: { suggestions: { suggestion: string; groundedIn: string }[] };
    try {
      output = JSON.parse(result.text);
    } catch {
      output = { suggestions: [{ suggestion: result.text, groundedIn: "" }] };
    }

    return createAiDraft(tx, {
      organizationId: membership.organization.id,
      departmentId: process.department_id,
      draftType: "process_improvement",
      sourceType: "process",
      sourceId: processId,
      promptSummary: `Suggest improvements for "${process.title}"`,
      output,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      createdByMemberId: membership.member.id,
    });
  });
}

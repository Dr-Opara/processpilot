import "server-only";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isAiConfigured } from "@/lib/ai/availability";
import { isAiCopilotEnabledForOrg } from "@/lib/services/ai-settings";
import { getAiProvider } from "@/lib/ai/get-provider";
import { GOVERNANCE_SYSTEM_PREAMBLE, wrapSource } from "@/lib/ai/prompt-safety";
import { createAiDraft } from "@/lib/services/ai-drafts";
import { getException } from "@/lib/services/exceptions";
import { getRootCauseAnalysis } from "@/lib/services/exception-root-cause";
import { listContainmentActions } from "@/lib/services/exception-containment";
import type { AiDraftRow } from "@/lib/db/database.types";

/**
 * Summarizes an exception (and its root cause/containment so far) for
 * a manager or compliance reviewer — read-only; never changes the
 * exception's status, severity, or anything else. This module imports
 * only read functions from exceptions.ts/exception-root-cause.ts/
 * exception-containment.ts, never closeException()/triageException()/
 * or any other mutation.
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

export async function summarizeException(exceptionId: string): Promise<AiDraftRow> {
  if (!isAiConfigured())
    throw new AppError("unavailable", "AI is not configured for this environment yet.");

  const exception = await getException(exceptionId);
  const [rootCause, containmentActions] = await Promise.all([
    getRootCauseAnalysis(exceptionId),
    listContainmentActions(exceptionId),
  ]);

  const membership = await requirePermission("ai.use", {
    scope: { departmentId: exception.department_id ?? undefined },
  });
  if (!(await isAiCopilotEnabledForOrg())) {
    throw new AppError("unavailable", "The AI copilot is disabled for this organization.");
  }

  const facts = [
    `Title: ${exception.title}`,
    `Type: ${exception.exception_type} · Severity: ${exception.severity} · Priority: ${exception.priority ?? "n/a"} · Status: ${exception.status}`,
    exception.description ? `Description: ${exception.description}` : null,
    rootCause?.analysis.primary_root_cause
      ? `Root cause: ${rootCause.analysis.primary_root_cause}`
      : "Root cause: not yet documented",
    containmentActions.length > 0
      ? `Containment actions: ${containmentActions.map((a) => `${a.action} (${a.status})`).join("; ")}`
      : "Containment actions: none recorded",
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `Write a concise summary of this exception for a manager or compliance reviewer, in plain language, using only the facts in the <source> block. Do not speculate beyond what's stated. Respond as JSON: {"summary": string}.

${wrapSource("Exception record", exceptionId, facts)}`;

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const provider = getAiProvider();
    const result = await provider.complete({
      systemPrompt: GOVERNANCE_SYSTEM_PREAMBLE,
      userPrompt,
    });

    let output: { summary: string };
    try {
      output = JSON.parse(result.text);
    } catch {
      output = { summary: result.text };
    }

    return createAiDraft(tx, {
      organizationId: membership.organization.id,
      departmentId: exception.department_id,
      draftType: "exception_summary",
      sourceType: "exception",
      sourceId: exceptionId,
      promptSummary: `Summarize exception: ${exception.title}`,
      output,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      createdByMemberId: membership.member.id,
    });
  });
}

import "server-only";
import { z } from "zod";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isAiConfigured } from "@/lib/ai/availability";
import { isAiCopilotEnabledForOrg } from "@/lib/services/ai-settings";
import { getAiProvider } from "@/lib/ai/get-provider";
import { GOVERNANCE_SYSTEM_PREAMBLE, wrapSource } from "@/lib/ai/prompt-safety";
import { createAiDraft } from "@/lib/services/ai-drafts";
import { getTrainingCourse } from "@/lib/services/training-courses";
import { getDocument } from "@/lib/services/knowledge-documents";
import type { AiDraftRow } from "@/lib/db/database.types";

/**
 * Drafts training course content for a course's next version — a human
 * reviews the draft and manually pastes/edits it into
 * training-courses.ts's createDraftCourseVersion() (never inserted
 * automatically); this module has no import of anything that publishes
 * a course version.
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

const MAX_SOURCE_CHARS = 6000;

const draftTrainingContentInputSchema = z.object({
  courseId: z.string().uuid(),
  topic: z.string().trim().min(1).max(300),
  sourceDocumentIds: z.array(z.string().uuid()).max(3).default([]),
});

export type DraftTrainingContentInput = z.infer<typeof draftTrainingContentInputSchema>;

export async function draftTrainingContent(input: DraftTrainingContentInput): Promise<AiDraftRow> {
  const data = draftTrainingContentInputSchema.parse(input);
  if (!isAiConfigured())
    throw new AppError("unavailable", "AI is not configured for this environment yet.");

  const preCheck = await getCurrentMembership();
  const course = await getTrainingCourse(data.courseId);
  const membership = await requirePermission("training.manage", {
    scope: { departmentId: course.department_id ?? undefined },
  });
  await requirePermission("ai.use", { scope: { departmentId: course.department_id ?? undefined } });
  if (!(await isAiCopilotEnabledForOrg())) {
    throw new AppError("unavailable", "The AI copilot is disabled for this organization.");
  }

  const sourceBlocks: string[] = [];
  for (const documentId of data.sourceDocumentIds) {
    const { currentVersion } = await getDocument(documentId).catch(() => ({
      currentVersion: null,
    }));
    if (currentVersion) {
      sourceBlocks.push(
        wrapSource(
          currentVersion.title,
          currentVersion.id,
          (currentVersion.content ?? currentVersion.extracted_text ?? "").slice(
            0,
            MAX_SOURCE_CHARS,
          ),
        ),
      );
    }
  }

  const userPrompt = `Draft training course content on "${data.topic}" for the course "${course.title}".${
    sourceBlocks.length > 0 ? " Ground it in the <source> blocks below where relevant." : ""
  } Respond as JSON: {"content": string, "suggestedQuestions": [{"prompt": string, "options": [string, string, string, string], "correctOptionIndex": number}]}.

${sourceBlocks.join("\n\n")}`;

  return withTenantContext(toTenantContext(preCheck), async (tx) => {
    const provider = getAiProvider();
    const result = await provider.complete({
      systemPrompt: GOVERNANCE_SYSTEM_PREAMBLE,
      userPrompt,
    });

    let output: { content: string; suggestedQuestions: unknown[] };
    try {
      output = JSON.parse(result.text);
    } catch {
      output = { content: result.text, suggestedQuestions: [] };
    }

    return createAiDraft(tx, {
      organizationId: membership.organization.id,
      departmentId: course.department_id,
      draftType: "training_content",
      sourceType: "training_course",
      sourceId: data.courseId,
      promptSummary: `Draft training content: ${data.topic}`,
      output,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      createdByMemberId: membership.member.id,
    });
  });
}

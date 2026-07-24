import type { ProcessGraphDefinition, ProcessNode, ProcessNodeType } from "@/lib/db/database.types";

/**
 * Hardcoded starter templates per product/feature-catalog.md's "process
 * templates for common patterns" — pre-fill node/edge structure only.
 * Role/team assignments are always left blank since they're
 * organization-specific; the author picks those after loading a
 * template. No template-management table/UI this phase.
 */
function node(
  type: ProcessNodeType,
  label: string,
  x: number,
  overrides: Partial<ProcessNode["data"]> = {},
): ProcessNode {
  return {
    id: crypto.randomUUID(),
    type,
    position: { x, y: 100 },
    data: { label, ...overrides },
  };
}

function edge(
  source: string,
  target: string,
  overrides: { label?: string; condition?: string } = {},
) {
  return {
    id: crypto.randomUUID(),
    source,
    target,
    label: overrides.label ?? null,
    condition: overrides.condition ?? null,
  };
}

export type TemplateKey = "blank" | "checklist" | "approval_chain" | "incident_response";

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  blank: "Blank",
  checklist: "Checklist",
  approval_chain: "Approval chain",
  incident_response: "Incident response",
};

export function buildTemplateGraph(template: TemplateKey): ProcessGraphDefinition {
  switch (template) {
    case "checklist": {
      const start = node("start", "Start", 0);
      const step1 = node("human_task", "Step 1", 220);
      const step2 = node("human_task", "Step 2", 440);
      const step3 = node("human_task", "Step 3", 660);
      const end = node("end", "End", 880);
      return {
        nodes: [start, step1, step2, step3, end],
        edges: [
          edge(start.id, step1.id),
          edge(step1.id, step2.id),
          edge(step2.id, step3.id),
          edge(step3.id, end.id),
        ],
      };
    }

    case "approval_chain": {
      const start = node("start", "Start", 0);
      const submit = node("human_task", "Submit for review", 220);
      const review = node("approval", "Review", 440);
      const finalApproval = node("approval", "Final approval", 660);
      const end = node("end", "End", 880);
      return {
        nodes: [start, submit, review, finalApproval, end],
        edges: [
          edge(start.id, submit.id),
          edge(submit.id, review.id),
          edge(review.id, finalApproval.id),
          edge(finalApproval.id, end.id),
        ],
      };
    }

    case "incident_response": {
      const start = node("start", "Start", 0);
      const report = node("human_task", "Report incident", 220);
      const investigate = node("evidence", "Investigate", 440, {
        evidenceDescription: "Photos or documentation of the incident",
      });
      const corrective = node("approval", "Corrective action", 660);
      const close = node("human_task", "Close incident", 880);
      const end = node("end", "End", 1100);
      return {
        nodes: [start, report, investigate, corrective, close, end],
        edges: [
          edge(start.id, report.id),
          edge(report.id, investigate.id),
          edge(investigate.id, corrective.id),
          edge(corrective.id, close.id),
          edge(close.id, end.id),
        ],
      };
    }

    case "blank":
    default: {
      const start = node("start", "Start", 0);
      const end = node("end", "End", 300);
      return { nodes: [start, end], edges: [edge(start.id, end.id)] };
    }
  }
}

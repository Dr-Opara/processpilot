import type { ProcessStep } from "@/lib/db/database.types";

/**
 * Hardcoded starter templates per product/feature-catalog.md's "process
 * templates for common patterns" — pre-fill step structure/flags only.
 * Role/team assignments are always left blank since they're
 * organization-specific; the author picks those after loading a
 * template. No template-management table/UI this phase.
 */
function blankStep(name: string): ProcessStep {
  return {
    id: crypto.randomUUID(),
    name,
    sequencing: "linear",
    parallelGroup: null,
    branchOnStepId: null,
    branchCondition: null,
    assigneeType: "role",
    assigneeRoleId: null,
    assigneeTeamId: null,
    required: true,
    requiresForm: false,
    formFields: [],
    requiresApproval: false,
    approverRoleId: null,
    requiresEvidence: false,
    evidenceDescription: null,
  };
}

export type TemplateKey = "blank" | "checklist" | "approval_chain" | "incident_response";

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  blank: "Blank",
  checklist: "Checklist",
  approval_chain: "Approval chain",
  incident_response: "Incident response",
};

export function buildTemplateSteps(template: TemplateKey): ProcessStep[] {
  switch (template) {
    case "checklist":
      return [blankStep("Step 1"), blankStep("Step 2"), blankStep("Step 3")];

    case "approval_chain": {
      const submit = blankStep("Submit for review");
      const review = { ...blankStep("Review"), requiresApproval: true };
      const approve = { ...blankStep("Final approval"), requiresApproval: true };
      return [submit, review, approve];
    }

    case "incident_response": {
      const report = blankStep("Report incident");
      const investigate = {
        ...blankStep("Investigate"),
        requiresEvidence: true,
        evidenceDescription: "Photos or documentation of the incident",
      };
      const corrective = { ...blankStep("Corrective action"), requiresApproval: true };
      const close = blankStep("Close incident");
      return [report, investigate, corrective, close];
    }

    case "blank":
    default:
      return [blankStep("")];
  }
}

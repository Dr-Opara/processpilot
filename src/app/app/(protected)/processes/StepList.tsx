import { Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ProcessStep } from "@/lib/db/database.types";

export function StepList({
  steps,
  roleNames,
  teamNames,
}: {
  steps: ProcessStep[];
  roleNames: Map<string, string>;
  teamNames: Map<string, string>;
}) {
  return (
    <Stack className="gap-3">
      {steps.map((step, index) => {
        const assigneeName =
          step.assigneeType === "role"
            ? (step.assigneeRoleId && roleNames.get(step.assigneeRoleId)) || "No role selected"
            : (step.assigneeTeamId && teamNames.get(step.assigneeTeamId)) || "No team selected";

        return (
          <Stack key={step.id} className="gap-1 rounded-md border border-border p-3">
            <Cluster className="justify-between">
              <Text>
                {index + 1}. {step.name || "Untitled step"}
              </Text>
              {step.required ? (
                <StatusBadge status="neutral">Required</StatusBadge>
              ) : (
                <StatusBadge status="neutral">Optional</StatusBadge>
              )}
            </Cluster>
            <Text className="text-muted text-xs">
              {step.sequencing} · Assigned to {assigneeName}
              {step.sequencing === "conditional" && step.branchCondition
                ? ` · Branches when "${step.branchCondition}"`
                : ""}
            </Text>
            <Cluster className="gap-2">
              {step.requiresForm && <StatusBadge status="warning">Form</StatusBadge>}
              {step.requiresApproval && <StatusBadge status="warning">Approval</StatusBadge>}
              {step.requiresEvidence && <StatusBadge status="warning">Evidence</StatusBadge>}
            </Cluster>
          </Stack>
        );
      })}
    </Stack>
  );
}

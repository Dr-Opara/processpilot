"use client";

import { Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import type { ProcessStep, ProcessStepFormField } from "@/lib/db/database.types";

interface Option {
  id: string;
  name: string;
}

export function StepEditor({
  step,
  index,
  allSteps,
  roles,
  teams,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: ProcessStep;
  index: number;
  allSteps: ProcessStep[];
  roles: Option[];
  teams: Option[];
  onChange: (next: ProcessStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const earlierSteps = allSteps.slice(0, index);

  function update<K extends keyof ProcessStep>(key: K, value: ProcessStep[K]) {
    onChange({ ...step, [key]: value });
  }

  function updateFormField(fieldIndex: number, next: ProcessStepFormField) {
    const formFields = [...step.formFields];
    formFields[fieldIndex] = next;
    update("formFields", formFields);
  }

  function addFormField() {
    update("formFields", [...step.formFields, { label: "", type: "text" }]);
  }

  function removeFormField(fieldIndex: number) {
    update(
      "formFields",
      step.formFields.filter((_, i) => i !== fieldIndex),
    );
  }

  return (
    <Stack className="gap-3 rounded-md border border-border p-4">
      <Cluster className="justify-between">
        <Label>Step {index + 1}</Label>
        <Cluster className="gap-2">
          <Button type="button" variant="secondary" onClick={onMoveUp} disabled={index === 0}>
            Move up
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onMoveDown}
            disabled={index === allSteps.length - 1}
          >
            Move down
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onRemove}
            disabled={allSteps.length === 1}
          >
            Remove
          </Button>
        </Cluster>
      </Cluster>

      <Stack className="gap-1">
        <Label htmlFor={`step-${step.id}-name`}>Name</Label>
        <Input
          id={`step-${step.id}-name`}
          value={step.name}
          onChange={(e) => update("name", e.target.value)}
          maxLength={200}
          required
        />
      </Stack>

      <Cluster className="gap-4">
        <Stack className="min-w-[160px] gap-1">
          <Label htmlFor={`step-${step.id}-sequencing`}>Sequencing</Label>
          <Select
            id={`step-${step.id}-sequencing`}
            value={step.sequencing}
            onChange={(e) => update("sequencing", e.target.value as ProcessStep["sequencing"])}
          >
            <option value="linear">Linear</option>
            <option value="parallel">Parallel</option>
            <option value="conditional">Conditional</option>
          </Select>
        </Stack>

        {step.sequencing === "parallel" && (
          <Stack className="min-w-[160px] gap-1">
            <Label htmlFor={`step-${step.id}-group`}>Parallel group</Label>
            <Input
              id={`step-${step.id}-group`}
              value={step.parallelGroup ?? ""}
              onChange={(e) => update("parallelGroup", e.target.value || null)}
              placeholder="e.g. stage-2"
            />
          </Stack>
        )}

        {step.sequencing === "conditional" && (
          <>
            <Stack className="min-w-[200px] gap-1">
              <Label htmlFor={`step-${step.id}-branch-on`}>Branches on</Label>
              <Select
                id={`step-${step.id}-branch-on`}
                value={step.branchOnStepId ?? ""}
                onChange={(e) => update("branchOnStepId", e.target.value || null)}
              >
                <option value="">Select a prior step</option>
                {earlierSteps.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name || `Step ${allSteps.indexOf(candidate) + 1}`}
                  </option>
                ))}
              </Select>
            </Stack>
            <Stack className="min-w-[160px] gap-1">
              <Label htmlFor={`step-${step.id}-branch-condition`}>Condition</Label>
              <Input
                id={`step-${step.id}-branch-condition`}
                value={step.branchCondition ?? ""}
                onChange={(e) => update("branchCondition", e.target.value || null)}
                placeholder="e.g. approved"
              />
            </Stack>
          </>
        )}
      </Cluster>

      <Cluster className="gap-4">
        <Stack className="min-w-[140px] gap-1">
          <Label htmlFor={`step-${step.id}-assignee-type`}>Assigned to</Label>
          <Select
            id={`step-${step.id}-assignee-type`}
            value={step.assigneeType}
            onChange={(e) =>
              onChange({
                ...step,
                assigneeType: e.target.value as ProcessStep["assigneeType"],
                assigneeRoleId: null,
                assigneeTeamId: null,
              })
            }
          >
            <option value="role">A role</option>
            <option value="team">A team</option>
          </Select>
        </Stack>
        {step.assigneeType === "role" ? (
          <Stack className="min-w-[200px] gap-1">
            <Label htmlFor={`step-${step.id}-assignee-role`}>Role</Label>
            <Select
              id={`step-${step.id}-assignee-role`}
              value={step.assigneeRoleId ?? ""}
              onChange={(e) => update("assigneeRoleId", e.target.value || null)}
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </Stack>
        ) : (
          <Stack className="min-w-[200px] gap-1">
            <Label htmlFor={`step-${step.id}-assignee-team`}>Team</Label>
            <Select
              id={`step-${step.id}-assignee-team`}
              value={step.assigneeTeamId ?? ""}
              onChange={(e) => update("assigneeTeamId", e.target.value || null)}
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Stack>
        )}
      </Cluster>

      <Cluster className="gap-2">
        <Checkbox
          id={`step-${step.id}-required`}
          checked={step.required}
          onChange={(e) => update("required", e.target.checked)}
        />
        <Label htmlFor={`step-${step.id}-required`}>Required to complete the workflow</Label>
      </Cluster>

      <Cluster className="gap-2">
        <Checkbox
          id={`step-${step.id}-requires-form`}
          checked={step.requiresForm}
          onChange={(e) => update("requiresForm", e.target.checked)}
        />
        <Label htmlFor={`step-${step.id}-requires-form`}>Requires a form</Label>
      </Cluster>
      {step.requiresForm && (
        <Stack className="gap-2 pl-6">
          {step.formFields.map((field, fieldIndex) => (
            <Cluster key={fieldIndex} className="gap-2">
              <Input
                value={field.label}
                onChange={(e) => updateFormField(fieldIndex, { ...field, label: e.target.value })}
                placeholder="Field label"
                className="max-w-xs"
              />
              <Select
                value={field.type}
                onChange={(e) =>
                  updateFormField(fieldIndex, {
                    ...field,
                    type: e.target.value as ProcessStepFormField["type"],
                  })
                }
                className="w-32"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="checkbox">Checkbox</option>
              </Select>
              <Button type="button" variant="secondary" onClick={() => removeFormField(fieldIndex)}>
                Remove
              </Button>
            </Cluster>
          ))}
          <Cluster>
            <Button type="button" variant="secondary" onClick={addFormField}>
              Add field
            </Button>
          </Cluster>
        </Stack>
      )}

      <Cluster className="gap-2">
        <Checkbox
          id={`step-${step.id}-requires-approval`}
          checked={step.requiresApproval}
          onChange={(e) => update("requiresApproval", e.target.checked)}
        />
        <Label htmlFor={`step-${step.id}-requires-approval`}>Requires approval</Label>
      </Cluster>
      {step.requiresApproval && (
        <Stack className="min-w-[200px] gap-1 pl-6">
          <Label htmlFor={`step-${step.id}-approver-role`}>Approver role</Label>
          <Select
            id={`step-${step.id}-approver-role`}
            value={step.approverRoleId ?? ""}
            onChange={(e) => update("approverRoleId", e.target.value || null)}
          >
            <option value="">Select a role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </Stack>
      )}

      <Cluster className="gap-2">
        <Checkbox
          id={`step-${step.id}-requires-evidence`}
          checked={step.requiresEvidence}
          onChange={(e) => update("requiresEvidence", e.target.checked)}
        />
        <Label htmlFor={`step-${step.id}-requires-evidence`}>Requires evidence</Label>
      </Cluster>
      {step.requiresEvidence && (
        <Stack className="gap-1 pl-6">
          <Label htmlFor={`step-${step.id}-evidence-description`}>Evidence description</Label>
          <Textarea
            id={`step-${step.id}-evidence-description`}
            value={step.evidenceDescription ?? ""}
            onChange={(e) => update("evidenceDescription", e.target.value || null)}
            rows={2}
            placeholder="e.g. Photo of the completed repair"
          />
        </Stack>
      )}
    </Stack>
  );
}

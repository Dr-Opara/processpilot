"use client";

import { useState } from "react";
import { Heading, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { ProcessStep } from "@/lib/db/database.types";
import { StepEditor } from "./StepEditor";
import { TEMPLATE_LABELS, buildTemplateSteps, type TemplateKey } from "./templates";

interface Option {
  id: string;
  name: string;
}

export function ProcessBuilderForm({
  action,
  mode,
  initialTitle = "",
  initialSteps,
  departments,
  members,
  roles,
  teams,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>;
  mode: "create" | "edit" | "new-version";
  initialTitle?: string;
  initialSteps?: ProcessStep[];
  departments: Option[];
  members: { id: string; label: string }[];
  roles: Option[];
  teams: Option[];
  cancelHref: string;
}) {
  const [steps, setSteps] = useState<ProcessStep[]>(
    () => initialSteps ?? buildTemplateSteps("blank"),
  );

  function applyTemplate(template: TemplateKey) {
    setSteps(buildTemplateSteps(template));
  }

  function updateStep(index: number, next: ProcessStep) {
    setSteps((prev) => prev.map((step, i) => (i === index ? next : step)));
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addStep() {
    setSteps((prev) => [...prev, buildTemplateSteps("blank")[0]]);
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="definition" value={JSON.stringify(steps)} />

      <Stack className="gap-1">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={300}
          defaultValue={initialTitle}
          autoFocus
        />
      </Stack>

      {mode === "create" && (
        <>
          <Stack className="gap-1">
            <Label htmlFor="departmentId">Department scope (optional)</Label>
            <Select id="departmentId" name="departmentId" defaultValue="">
              <option value="">Organization-wide</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Stack>
          <Stack className="gap-1">
            <Label htmlFor="ownerMemberId">Owner (optional)</Label>
            <Select id="ownerMemberId" name="ownerMemberId" defaultValue="">
              <option value="">No specific owner</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </Select>
          </Stack>
        </>
      )}

      {(mode === "create" || mode === "new-version") && (
        <Stack className="gap-1">
          <Label htmlFor="template">Start from a template</Label>
          <Select
            id="template"
            defaultValue="blank"
            onChange={(e) => applyTemplate(e.target.value as TemplateKey)}
          >
            {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Stack>
      )}

      <Stack className="gap-4">
        <Heading as="h2">Steps</Heading>
        {steps.map((step, index) => (
          <StepEditor
            key={step.id}
            step={step}
            index={index}
            allSteps={steps}
            roles={roles}
            teams={teams}
            onChange={(next) => updateStep(index, next)}
            onRemove={() => removeStep(index)}
            onMoveUp={() => moveStep(index, -1)}
            onMoveDown={() => moveStep(index, 1)}
          />
        ))}
        <Cluster>
          <Button type="button" variant="secondary" onClick={addStep}>
            Add step
          </Button>
        </Cluster>
      </Stack>

      <Cluster className="justify-end gap-3">
        <Button href={cancelHref} variant="secondary">
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </Cluster>
    </form>
  );
}

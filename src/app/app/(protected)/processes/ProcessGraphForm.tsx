"use client";

import { useState } from "react";
import { Label, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import type { ProcessGraphDefinition } from "@/lib/db/database.types";
import {
  TEMPLATE_LABELS,
  buildTemplateGraph,
  type TemplateKey,
} from "./[processId]/editor/templates";

interface Option {
  id: string;
  name: string;
}

/**
 * Temporary JSON-based process editor. The drag-and-drop visual canvas
 * (@xyflow/react) called for by Phase 7's required scope has not been
 * built yet — this exists only so process authoring stays functional
 * (create/edit/version a process graph) while that canvas is pending.
 * Do not treat this as the finished Phase 7 editor.
 */
export function ProcessGraphForm({
  action,
  mode,
  initialTitle = "",
  initialGraph,
  departments,
  members,
  roles,
  teams,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>;
  mode: "create" | "edit" | "new-version";
  initialTitle?: string;
  initialGraph?: ProcessGraphDefinition;
  departments: Option[];
  members: { id: string; label: string }[];
  roles: Option[];
  teams: Option[];
  cancelHref: string;
}) {
  const [graphText, setGraphText] = useState(() =>
    JSON.stringify(initialGraph ?? buildTemplateGraph("blank"), null, 2),
  );

  function applyTemplate(template: TemplateKey) {
    setGraphText(JSON.stringify(buildTemplateGraph(template), null, 2));
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <Alert
        title="Temporary JSON editor"
        description="The visual drag-and-drop canvas isn't built yet. Edit the process graph as JSON below — node ids referenced by an edge's source/target must match, and role/team ids must come from the reference lists underneath the editor."
      />

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

      <Stack className="gap-1">
        <Label htmlFor="graph">Process graph (JSON)</Label>
        <Textarea
          id="graph"
          name="definition"
          required
          rows={20}
          className="font-mono text-xs"
          value={graphText}
          onChange={(e) => setGraphText(e.target.value)}
        />
      </Stack>

      <Stack className="gap-2 rounded-md border border-border p-3">
        <Text className="text-xs font-semibold text-muted">Roles</Text>
        <Text className="text-xs text-muted">
          {roles.length > 0
            ? roles.map((role) => `${role.name} (${role.id})`).join(" · ")
            : "No roles available."}
        </Text>
        <Text className="text-xs font-semibold text-muted">Teams</Text>
        <Text className="text-xs text-muted">
          {teams.length > 0
            ? teams.map((team) => `${team.name} (${team.id})`).join(" · ")
            : "No teams available."}
        </Text>
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

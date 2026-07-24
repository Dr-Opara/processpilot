"use client";

import { useRef } from "react";
import { Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { ProcessGraphDefinition } from "@/lib/db/database.types";
import { ProcessCanvas } from "./[processId]/editor/ProcessCanvas";

interface Option {
  id: string;
  name: string;
}

/**
 * The visual drag-and-drop process editor — wraps the ReactFlow canvas
 * (ProcessCanvas) with the title/scope fields and the form submit that
 * actions.ts's parseGraph() reads via the hidden "definition" input,
 * same submission contract every process form has used since Phase 7's
 * first pass.
 */
export function ProcessCanvasForm({
  action,
  mode,
  initialTitle = "",
  initialGraph,
  departments,
  members,
  roles,
  teams,
  cancelHref,
  draftKey,
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
  draftKey: string;
}) {
  const definitionRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input ref={definitionRef} type="hidden" name="definition" />

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

      <ProcessCanvas
        draftKey={draftKey}
        initialGraph={initialGraph}
        roles={roles}
        teams={teams}
        onGraphChange={(graph) => {
          if (definitionRef.current) {
            definitionRef.current.value = JSON.stringify(graph);
          }
        }}
      />

      <Cluster className="justify-end gap-3">
        <Button href={cancelHref} variant="secondary">
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </Cluster>
    </form>
  );
}

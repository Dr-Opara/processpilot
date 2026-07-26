"use client";

import { useState } from "react";
import { Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { DirectoryMember } from "@/lib/services/members";
import type { RoleRow, DepartmentRow, TeamRow } from "@/lib/db/database.types";
import { memberDisplayName } from "@/lib/services/member-display";

type AssignedVia = "individual" | "role" | "department" | "team";

export function TrainingAssignForm({
  action,
  courseVersionId,
  members,
  roles,
  departments,
  teams,
}: {
  action: (formData: FormData) => Promise<void>;
  courseVersionId: string;
  members: DirectoryMember[];
  roles: RoleRow[];
  departments: DepartmentRow[];
  teams: TeamRow[];
}) {
  const [assignedVia, setAssignedVia] = useState<AssignedVia>("individual");

  const targetOptions =
    assignedVia === "individual"
      ? members.map((m) => ({ id: m.id, label: memberDisplayName(m) }))
      : assignedVia === "role"
        ? roles.map((r) => ({ id: r.id, label: r.name }))
        : assignedVia === "department"
          ? departments.map((d) => ({ id: d.id, label: d.name }))
          : teams.map((t) => ({ id: t.id, label: t.name }));

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="courseVersionId" value={courseVersionId} />
      <Cluster className="flex-wrap gap-3">
        <Stack className="gap-1">
          <Label htmlFor="assignedVia">Assign via</Label>
          <Select
            id="assignedVia"
            name="assignedVia"
            className="w-40"
            value={assignedVia}
            onChange={(e) => setAssignedVia(e.target.value as AssignedVia)}
          >
            <option value="individual">Individual</option>
            <option value="role">Role</option>
            <option value="department">Department</option>
            <option value="team">Team</option>
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="targetId">Target</Label>
          <Select id="targetId" name="targetId" required className="w-64">
            <option value="">Select {assignedVia}</option>
            {targetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="dueAt">Due date (optional)</Label>
          <Input id="dueAt" name="dueAt" type="date" />
        </Stack>
      </Cluster>
      <Cluster className="justify-end">
        <Button type="submit" variant="secondary">
          Assign training
        </Button>
      </Cluster>
    </form>
  );
}

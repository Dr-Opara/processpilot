"use client";

import { useState } from "react";
import { Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { DepartmentRow } from "@/lib/db/database.types";
import { createDocumentAction } from "../actions";

interface MemberOption {
  id: string;
  label: string;
}

export function NewDocumentForm({
  departments,
  members,
}: {
  departments: DepartmentRow[];
  members: MemberOption[];
}) {
  const [mode, setMode] = useState<"author" | "upload">("author");

  return (
    <form
      action={createDocumentAction}
      className="flex flex-col gap-4"
      encType="multipart/form-data"
    >
      <Stack className="gap-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={300} autoFocus />
      </Stack>

      <Cluster className="gap-4 border-b border-border pb-3">
        <Cluster className="gap-2">
          <input
            type="radio"
            id="mode-author"
            name="mode"
            value="author"
            checked={mode === "author"}
            onChange={() => setMode("author")}
          />
          <Label htmlFor="mode-author">Author in-app</Label>
        </Cluster>
        <Cluster className="gap-2">
          <input
            type="radio"
            id="mode-upload"
            name="mode"
            value="upload"
            checked={mode === "upload"}
            onChange={() => setMode("upload")}
          />
          <Label htmlFor="mode-upload">Upload a file</Label>
        </Cluster>
      </Cluster>

      {mode === "author" ? (
        <Stack className="gap-1">
          <Label htmlFor="content">Content</Label>
          <Textarea id="content" name="content" rows={10} />
        </Stack>
      ) : (
        <Stack className="gap-1">
          <Label htmlFor="file">File (PDF, DOCX, or plain text — up to 20 MB)</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          />
        </Stack>
      )}

      <Stack className="gap-1">
        <Label htmlFor="category">Category (optional)</Label>
        <Input
          id="category"
          name="category"
          maxLength={100}
          placeholder="e.g. HR, Safety, Onboarding"
        />
      </Stack>
      <Stack className="gap-1">
        <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
        <Input id="tags" name="tags" placeholder="e.g. policy, 2026, mandatory" />
      </Stack>
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

      <Cluster className="justify-end gap-3">
        <Button href="/app/knowledge" variant="secondary">
          Cancel
        </Button>
        <Button type="submit">Save document</Button>
      </Cluster>
    </form>
  );
}

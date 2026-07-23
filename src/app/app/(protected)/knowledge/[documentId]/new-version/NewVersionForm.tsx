"use client";

import { useState } from "react";
import { Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createNewVersionAction } from "../../actions";

export function NewVersionForm({
  documentId,
  defaultTitle,
}: {
  documentId: string;
  defaultTitle: string;
}) {
  const [mode, setMode] = useState<"author" | "upload">("author");
  const action = createNewVersionAction.bind(null, documentId);

  return (
    <form action={action} className="flex flex-col gap-4" encType="multipart/form-data">
      <Stack className="gap-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={300} defaultValue={defaultTitle} />
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

      <Cluster className="justify-end gap-3">
        <Button href={`/app/knowledge/${documentId}`} variant="secondary">
          Cancel
        </Button>
        <Button type="submit">Create version</Button>
      </Cluster>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Text } from "@/components/ui/Typography";
import { Cluster } from "@/components/ui/Layout";

/** Uploads a file via the /app/evidence/upload API route and reports the resulting evidenceId back to the parent form's answers — a form's `file`-type field never carries raw bytes, only `{ evidenceId }` (see form-schema.ts). */
export function EvidenceFileField({
  taskId,
  onUploaded,
}: {
  taskId: string;
  onUploaded: (evidenceId: string, filename: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setError(null);

    const body = new FormData();
    body.set("file", file);
    body.set("taskId", taskId);

    try {
      const response = await fetch("/app/evidence/upload", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Upload failed.");
      setUploadedName(file.name);
      setStatus("idle");
      onUploaded(result.id as string, file.name);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <Cluster className="items-center gap-3">
      <input type="file" onChange={handleChange} disabled={status === "uploading"} />
      {status === "uploading" && <Text className="text-muted">Uploading…</Text>}
      {uploadedName && status !== "error" && (
        <Text className="text-success">Uploaded: {uploadedName}</Text>
      )}
      {error && <Text className="text-danger">{error}</Text>}
    </Cluster>
  );
}

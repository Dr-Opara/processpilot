"use client";

import { useState, useTransition } from "react";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import type { ImportPreview, ImportOutcome } from "@/lib/services/member-import";
import { confirmImportAction, previewImportAction } from "./actions";

export function ImportWizard() {
  const [filename, setFilename] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setFilename(null);
    setCsvText(null);
    setPreview(null);
    setOutcome(null);
    setError(null);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    reset();
    setFilename(file.name);
    const text = await file.text();
    setCsvText(text);

    startTransition(async () => {
      const result = await previewImportAction(text);
      if (result.ok) setPreview(result.preview);
      else setError(result.error);
    });
  }

  function handleConfirm() {
    if (!csvText || !filename) return;
    startTransition(async () => {
      const result = await confirmImportAction(csvText, filename);
      if (result.ok) {
        setOutcome(result.outcome);
        setPreview(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Stack className="gap-6">
      {!outcome && (
        <Stack className="gap-3">
          <Label htmlFor="csvFile">CSV file</Label>
          <input
            id="csvFile"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          />
          <Text className="text-muted text-xs">
            Up to 1,000 rows, 2 MB. Columns: First name, Last name, Work email, Job title, Role,
            Location, Department, Team, Manager email, Start date.
          </Text>
        </Stack>
      )}

      {error && <Alert title="Import problem" description={error} />}

      {isPending && <Text className="text-muted">Working…</Text>}

      {preview && !outcome && (
        <Stack className="gap-4">
          <Cluster className="gap-4">
            <StatusBadge status="success">{preview.validCount} ready</StatusBadge>
            <StatusBadge status="warning">{preview.duplicateCount} duplicate</StatusBadge>
            <StatusBadge status="danger">{preview.errorCount} error</StatusBadge>
          </Cluster>

          <ScrollArea>
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Row</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-b border-border/60">
                    <td className="py-2 pr-4">{row.rowNumber}</td>
                    <td className="py-2 pr-4">
                      {[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="py-2 pr-4">{row.email || "—"}</td>
                    <td className="py-2 pr-4">
                      {row.errors.length > 0 ? (
                        <StatusBadge status="danger">Error</StatusBadge>
                      ) : row.duplicateReason ? (
                        <StatusBadge status="warning">Duplicate</StatusBadge>
                      ) : (
                        <StatusBadge status="success">Ready</StatusBadge>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-muted text-xs">
                      {row.errors.join(" ") || row.duplicateReason || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>

          <Cluster className="justify-end gap-3">
            <Button variant="secondary" onClick={reset} disabled={isPending}>
              Start over
            </Button>
            <Button onClick={handleConfirm} disabled={isPending || preview.validCount === 0}>
              Confirm import
            </Button>
          </Cluster>
        </Stack>
      )}

      {outcome && (
        <Stack className="gap-4">
          <Heading as="h2">Import complete</Heading>
          <Cluster className="gap-4">
            <StatusBadge status="success">{outcome.batch.succeeded_rows} invited</StatusBadge>
            <StatusBadge status="warning">{outcome.batch.duplicate_rows} skipped</StatusBadge>
            <StatusBadge status="danger">{outcome.batch.failed_rows} failed</StatusBadge>
          </Cluster>
          <Cluster className="gap-3">
            <Button href="/app/members">Back to members</Button>
            <Button href="/app/members/import/history" variant="secondary">
              View import history
            </Button>
          </Cluster>
        </Stack>
      )}
    </Stack>
  );
}

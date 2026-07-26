"use client";

import { Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const EXCEPTION_TYPES = [
  "process_deviation",
  "policy_exception",
  "control_failure",
  "missed_sla",
  "evidence_deficiency",
  "task_failure",
  "security_issue",
  "training_deficiency",
  "vendor_issue",
  "data_quality_issue",
  "other",
] as const;

const SOURCES = ["employee_submission", "manager_submission", "administrative_entry"] as const;
const SEVERITIES = ["low", "moderate", "high", "critical"] as const;

export function ExceptionForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="flex flex-col gap-6">
      <Stack className="gap-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={300} autoFocus />
      </Stack>

      <Stack className="gap-1">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} />
      </Stack>

      <Cluster className="gap-4">
        <Stack className="gap-1">
          <Label htmlFor="exceptionType">Exception type</Label>
          <Select id="exceptionType" name="exceptionType" className="w-56" defaultValue="other">
            {EXCEPTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="source">Reported via</Label>
          <Select id="source" name="source" className="w-56" defaultValue="employee_submission">
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {source.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="severity">Severity</Label>
          <Select id="severity" name="severity" className="w-40" defaultValue="moderate">
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </Select>
        </Stack>
      </Cluster>

      <Stack className="gap-1">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input id="tags" name="tags" placeholder="safety, warehouse" />
      </Stack>

      <Cluster className="justify-end gap-3">
        <Button href="/app/exceptions" variant="secondary">
          Cancel
        </Button>
        <Button type="submit">Report exception</Button>
      </Cluster>
    </form>
  );
}

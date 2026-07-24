"use client";

import { useEffect, useRef, useState } from "react";
import { Label, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import type { FormFieldDefinition } from "@/lib/db/database.types";
import { EvidenceFileField } from "./EvidenceFileField";

/** Client-side mirror of form-schema.ts's evaluateFieldVisibility() — duplicated rather than imported because that module is `import "server-only"`. Kept intentionally tiny and in lockstep with the server grammar; the server re-validates on every save/submit regardless, so a drift here only affects which fields *render*, never what's accepted. */
function isVisible(
  condition: string | null | undefined,
  answers: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  const match = /^([A-Za-z0-9_-]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(condition.trim());
  if (!match) return true;
  const [, key, operator, rawValue] = match;
  const trimmed = rawValue.trim();
  let expected: string | number | boolean = trimmed;
  if (trimmed === "true") expected = true;
  else if (trimmed === "false") expected = false;
  else if (/^-?\d+(\.\d+)?$/.test(trimmed)) expected = Number(trimmed);
  else if (/^".*"$/.test(trimmed) || /^'.*'$/.test(trimmed)) expected = trimmed.slice(1, -1);

  const actual = answers[key];
  if (actual === undefined) return false;
  switch (operator) {
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case ">":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case ">=":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "<":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "<=":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    default:
      return true;
  }
}

export function DynamicFormRenderer({
  taskId,
  fields,
  initialAnswers = {},
  submitAction,
  saveDraftAction,
}: {
  taskId: string;
  fields: FormFieldDefinition[];
  initialAnswers?: Record<string, unknown>;
  submitAction: (formData: FormData) => Promise<void>;
  saveDraftAction: (formData: FormData) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const answersRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (answersRef.current) answersRef.current.value = JSON.stringify(answers);
  }, [answers]);

  function setAnswer(key: string, value: unknown) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function renderField(field: FormFieldDefinition) {
    if (!isVisible(field.visibleWhen, answers)) return null;
    const value = answers[field.key];

    switch (field.type) {
      case "text":
        return (
          <Input
            id={field.key}
            value={typeof value === "string" ? value : ""}
            maxLength={field.maxLength}
            onChange={(e) => setAnswer(field.key, e.target.value)}
          />
        );
      case "number":
        return (
          <Input
            id={field.key}
            type="number"
            value={typeof value === "number" ? value : ""}
            min={field.min}
            max={field.max}
            onChange={(e) =>
              setAnswer(field.key, e.target.value === "" ? undefined : Number(e.target.value))
            }
          />
        );
      case "date":
        return (
          <Input
            id={field.key}
            type="date"
            value={typeof value === "string" ? value : ""}
            min={field.minDate}
            max={field.maxDate}
            onChange={(e) => setAnswer(field.key, e.target.value)}
          />
        );
      case "select":
        return (
          <Select
            id={field.key}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setAnswer(field.key, e.target.value)}
          >
            <option value="">Select…</option>
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );
      case "checkbox":
        return (
          <Cluster className="items-center gap-2">
            <Checkbox
              id={field.key}
              checked={value === true}
              onChange={(e) => setAnswer(field.key, e.target.checked)}
            />
            <Label htmlFor={field.key}>{field.required ? "I acknowledge" : "Yes"}</Label>
          </Cluster>
        );
      case "signature": {
        const signature =
          (value as { signedName?: string; acknowledged?: boolean } | undefined) ?? {};
        return (
          <Stack className="gap-2">
            <Input
              id={field.key}
              placeholder="Type your full name"
              value={signature.signedName ?? ""}
              onChange={(e) => setAnswer(field.key, { ...signature, signedName: e.target.value })}
            />
            <Cluster className="items-center gap-2">
              <Checkbox
                id={`${field.key}-ack`}
                checked={signature.acknowledged === true}
                onChange={(e) =>
                  setAnswer(field.key, { ...signature, acknowledged: e.target.checked })
                }
              />
              <Label htmlFor={`${field.key}-ack`}>I certify this is my signature</Label>
            </Cluster>
          </Stack>
        );
      }
      case "file": {
        const current = value as { evidenceId?: string } | undefined;
        return (
          <Stack className="gap-1">
            <EvidenceFileField
              taskId={taskId}
              onUploaded={(evidenceId) => setAnswer(field.key, { evidenceId })}
            />
            {current?.evidenceId && (
              <Text className="text-xs text-muted">Attached: {current.evidenceId}</Text>
            )}
          </Stack>
        );
      }
      case "table":
        return (
          <Stack className="gap-1">
            <Textarea
              id={field.key}
              rows={4}
              value={JSON.stringify(value ?? [], null, 2)}
              onChange={(e) => {
                try {
                  setAnswer(field.key, JSON.parse(e.target.value));
                } catch {
                  // Ignore invalid intermediate JSON while typing — final
                  // validation happens server-side on save/submit.
                }
              }}
            />
            <Text className="text-xs text-muted">
              Rows as JSON — columns: {(field.columns ?? []).map((c) => c.key).join(", ")}
            </Text>
          </Stack>
        );
    }
  }

  return (
    <form action={submitAction} className="flex flex-col gap-4">
      <input ref={answersRef} type="hidden" name="answers" />
      {fields.map((field) => {
        const rendered = renderField(field);
        if (!rendered) return null;
        return (
          <Stack key={field.key} className="gap-1">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required ? " *" : ""}
            </Label>
            {field.helpText && <Text className="text-xs text-muted">{field.helpText}</Text>}
            {rendered}
          </Stack>
        );
      })}

      <Cluster className="justify-end gap-2">
        <Button type="submit" variant="secondary" formAction={saveDraftAction}>
          Save draft
        </Button>
        <Button type="submit" formAction={submitAction}>
          Submit
        </Button>
      </Cluster>
    </form>
  );
}

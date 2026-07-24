"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Label, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import type { FormFieldDefinition, FormFieldType } from "@/lib/db/database.types";

const FIELD_TYPES: FormFieldType[] = [
  "text",
  "number",
  "date",
  "select",
  "checkbox",
  "file",
  "table",
  "signature",
];

interface FieldDraft {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  helpText: string;
  visibleWhen: string;
  /** Everything else a field type needs (options, min/max, columns, ...) as pretty-printed JSON, merged in at submit time — see mergeFieldDraft(). */
  advancedJson: string;
}

const ADVANCED_KEYS = [
  "minLength",
  "maxLength",
  "pattern",
  "min",
  "max",
  "minDate",
  "maxDate",
  "options",
  "maxFileSizeBytes",
  "allowedMimeTypes",
  "columns",
  "minRows",
  "maxRows",
] as const;

function toDraft(field: FormFieldDefinition): FieldDraft {
  const advanced: Record<string, unknown> = {};
  for (const key of ADVANCED_KEYS) {
    if (field[key] !== undefined) advanced[key] = field[key];
  }
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required ?? false,
    helpText: field.helpText ?? "",
    visibleWhen: field.visibleWhen ?? "",
    advancedJson: Object.keys(advanced).length > 0 ? JSON.stringify(advanced, null, 2) : "",
  };
}

function emptyDraft(): FieldDraft {
  return {
    key: "",
    label: "",
    type: "text",
    required: false,
    helpText: "",
    visibleWhen: "",
    advancedJson: "",
  };
}

/** Merges a draft's advanced JSON back onto the base field shape — throws (caught by the caller) if the JSON is malformed, so a bad edit blocks submission rather than silently dropping the field's configuration. */
function mergeFieldDraft(draft: FieldDraft): FormFieldDefinition {
  const advanced = draft.advancedJson.trim() ? JSON.parse(draft.advancedJson) : {};
  return {
    ...advanced,
    key: draft.key.trim(),
    label: draft.label.trim(),
    type: draft.type,
    required: draft.required,
    helpText: draft.helpText.trim() || null,
    visibleWhen: draft.visibleWhen.trim() || null,
  };
}

export function FormBuilder({
  action,
  initialTitle = "",
  initialFields = [],
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>;
  initialTitle?: string;
  initialFields?: FormFieldDefinition[];
  cancelHref: string;
}) {
  const [fields, setFields] = useState<FieldDraft[]>(
    initialFields.length > 0 ? initialFields.map(toDraft) : [emptyDraft()],
  );
  const definitionRef = useRef<HTMLInputElement>(null);

  const mergeError = useMemo(() => {
    try {
      fields.map(mergeFieldDraft);
      return null;
    } catch {
      return "One or more fields have invalid Advanced settings JSON.";
    }
  }, [fields]);

  useEffect(() => {
    if (!definitionRef.current) return;
    definitionRef.current.value = mergeError
      ? ""
      : JSON.stringify({ fields: fields.map(mergeFieldDraft) });
  }, [fields, mergeError]);

  function updateField(index: number, patch: Partial<FieldDraft>) {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  }

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

      <Stack className="gap-3">
        <Label>Fields</Label>
        {fields.map((field, index) => (
          <Stack key={index} className="gap-3 rounded-md border border-border p-4">
            <Cluster className="flex-wrap gap-3">
              <Stack className="min-w-[160px] flex-1 gap-1">
                <Label htmlFor={`field-key-${index}`}>Key</Label>
                <Input
                  id={`field-key-${index}`}
                  value={field.key}
                  onChange={(e) => updateField(index, { key: e.target.value })}
                  placeholder="e.g. inspection_notes"
                  required
                />
              </Stack>
              <Stack className="min-w-[160px] flex-1 gap-1">
                <Label htmlFor={`field-label-${index}`}>Label</Label>
                <Input
                  id={`field-label-${index}`}
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  required
                />
              </Stack>
              <Stack className="min-w-[140px] gap-1">
                <Label htmlFor={`field-type-${index}`}>Type</Label>
                <Select
                  id={`field-type-${index}`}
                  value={field.type}
                  onChange={(e) => updateField(index, { type: e.target.value as FormFieldType })}
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </Stack>
            </Cluster>

            <Cluster className="items-center gap-2">
              <Checkbox
                id={`field-required-${index}`}
                checked={field.required}
                onChange={(e) => updateField(index, { required: e.target.checked })}
              />
              <Label htmlFor={`field-required-${index}`}>Required</Label>
            </Cluster>

            <Stack className="gap-1">
              <Label htmlFor={`field-help-${index}`}>Help text (optional)</Label>
              <Input
                id={`field-help-${index}`}
                value={field.helpText}
                onChange={(e) => updateField(index, { helpText: e.target.value })}
              />
            </Stack>

            <Stack className="gap-1">
              <Label htmlFor={`field-visible-${index}`}>Visible when (optional)</Label>
              <Input
                id={`field-visible-${index}`}
                value={field.visibleWhen}
                onChange={(e) => updateField(index, { visibleWhen: e.target.value })}
                placeholder='e.g. severity == "high"'
              />
            </Stack>

            <Stack className="gap-1">
              <Label htmlFor={`field-advanced-${index}`}>
                Advanced settings (JSON — options, min/max, columns, ...)
              </Label>
              <Textarea
                id={`field-advanced-${index}`}
                rows={3}
                value={field.advancedJson}
                onChange={(e) => updateField(index, { advancedJson: e.target.value })}
                placeholder='{"options":[{"value":"low","label":"Low"}]}'
              />
            </Stack>

            <Cluster className="justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
              >
                Remove field
              </Button>
            </Cluster>
          </Stack>
        ))}

        <Cluster>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setFields((current) => [...current, emptyDraft()])}
          >
            Add field
          </Button>
        </Cluster>

        {mergeError && <Text className="text-danger">{mergeError}</Text>}
      </Stack>

      <Cluster className="justify-end gap-3">
        <Button href={cancelHref} variant="secondary">
          Cancel
        </Button>
        <Button type="submit" disabled={Boolean(mergeError)}>
          Save
        </Button>
      </Cluster>
    </form>
  );
}

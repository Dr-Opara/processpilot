import "server-only";
import { z } from "zod";
import type { FormFieldDefinition, FormFieldType } from "@/lib/db/database.types";

/**
 * The field-type catalog and validation engine for Phase 9 forms. A
 * form_version's `definition` column is `{ fields: FormFieldDefinition[] }`
 * (types defined in database.types.ts) — one flat list (a `table`
 * field's `columns` are the only nesting allowed, and columns may not
 * themselves be `table`/`file`/`signature`, keeping validation a fixed
 * two-level recursion rather than arbitrary depth).
 *
 * A `file` field's answer is never raw bytes — it's `{ evidenceId }`,
 * pointing at a row already created by evidence.ts's uploadEvidence().
 * form-submissions.ts cross-checks that the referenced evidence row
 * actually exists, belongs to this organization, and is attached to this
 * submission before accepting a final submit.
 */
export type {
  FormFieldType,
  FormFieldOption,
  FormFieldDefinition,
  FormDefinition,
} from "@/lib/db/database.types";

const NON_NESTABLE_TYPES: FormFieldType[] = ["table", "file", "signature"];

const fieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
});

const baseFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Field keys may only contain letters, numbers, _ and -"),
  label: z.string().trim().min(1).max(300),
  type: z.enum(["text", "number", "date", "select", "checkbox", "file", "table", "signature"]),
  required: z.boolean().optional(),
  helpText: z.string().trim().max(1000).optional().nullable(),
  visibleWhen: z.string().trim().max(300).optional().nullable(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  pattern: z.string().max(300).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minDate: z.string().date().optional(),
  maxDate: z.string().date().optional(),
  options: z.array(fieldOptionSchema).max(200).optional(),
  maxFileSizeBytes: z.number().int().positive().optional(),
  allowedMimeTypes: z.array(z.string().trim().min(1)).max(50).optional(),
  minRows: z.number().int().min(0).optional(),
  maxRows: z.number().int().min(1).optional(),
});

/** A `table` field's `columns` are validated one level deep as plain fields — a column cannot itself be `table`/`file`/`signature`. */
export const formFieldSchema: z.ZodType<FormFieldDefinition> = baseFieldSchema
  .extend({
    columns: z.array(baseFieldSchema).max(50).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: `Field "${field.key}" (select) requires at least one option.`,
      });
    }
    if (field.type === "table" && (!field.columns || field.columns.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: `Field "${field.key}" (table) requires at least one column.`,
      });
    }
    if (field.type !== "table" && field.columns && field.columns.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `Only a "table" field may define columns (field "${field.key}").`,
      });
    }
    for (const column of field.columns ?? []) {
      if (NON_NESTABLE_TYPES.includes(column.type)) {
        ctx.addIssue({
          code: "custom",
          message: `Table column "${column.key}" cannot be type "${column.type}" — table/file/signature fields cannot be nested inside a table.`,
        });
      }
    }
    if (field.visibleWhen) {
      const error = validateFieldConditionSyntax(field.visibleWhen);
      if (error) ctx.addIssue({ code: "custom", message: `Field "${field.key}": ${error}` });
    }
  }) as unknown as z.ZodType<FormFieldDefinition>;

export const formDefinitionSchema = z
  .object({ fields: z.array(formFieldSchema).max(200) })
  .superRefine((definition, ctx) => {
    const seen = new Set<string>();
    for (const field of definition.fields) {
      if (seen.has(field.key)) {
        ctx.addIssue({ code: "custom", message: `Duplicate field key "${field.key}".` });
      }
      seen.add(field.key);
    }
  });

export type FormDefinitionInput = z.infer<typeof formDefinitionSchema>;

// --- Conditional visibility -------------------------------------------

const FIELD_CONDITION_PATTERN = /^([A-Za-z0-9_-]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/;

interface ParsedFieldCondition {
  key: string;
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
  value: string | number | boolean;
}

function parseFieldCondition(condition: string): ParsedFieldCondition | { message: string } {
  const match = FIELD_CONDITION_PATTERN.exec(condition.trim());
  if (!match) {
    return {
      message: `Could not parse condition "${condition}" — expected the form <fieldKey> <op> <value> (op one of ==, !=, >, >=, <, <=).`,
    };
  }
  const [, key, operator, rawValue] = match;
  const trimmed = rawValue.trim();
  let value: string | number | boolean;
  if (trimmed === "true") value = true;
  else if (trimmed === "false") value = false;
  else if (/^-?\d+(\.\d+)?$/.test(trimmed)) value = Number(trimmed);
  else if (/^".*"$/.test(trimmed) || /^'.*'$/.test(trimmed)) value = trimmed.slice(1, -1);
  else
    return {
      message: `Condition "${condition}" has an unquoted, non-numeric value "${rawValue}".`,
    };

  return { key, operator: operator as ParsedFieldCondition["operator"], value };
}

export function validateFieldConditionSyntax(condition: string): string | null {
  const result = parseFieldCondition(condition);
  return "message" in result ? result.message : null;
}

/** True if `condition` is absent or matches `answers`; false if the referenced field simply has no answer yet. Throws only on a malformed condition string — rejected up front by formDefinitionSchema before a version can be saved, so this should be unreachable at runtime against a saved definition. */
export function evaluateFieldVisibility(
  condition: string | null | undefined,
  answers: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  const parsed = parseFieldCondition(condition);
  if ("message" in parsed) throw new Error(parsed.message);

  const actual = answers[parsed.key];
  if (actual === undefined) return false;

  switch (parsed.operator) {
    case "==":
      return actual === parsed.value;
    case "!=":
      return actual !== parsed.value;
    case ">":
      return (
        typeof actual === "number" && typeof parsed.value === "number" && actual > parsed.value
      );
    case ">=":
      return (
        typeof actual === "number" && typeof parsed.value === "number" && actual >= parsed.value
      );
    case "<":
      return (
        typeof actual === "number" && typeof parsed.value === "number" && actual < parsed.value
      );
    case "<=":
      return (
        typeof actual === "number" && typeof parsed.value === "number" && actual <= parsed.value
      );
  }
}

// --- Answer validation ---------------------------------------------------

/**
 * Rejects a string whose first non-whitespace character would make a
 * spreadsheet application interpret the cell as a formula if this value
 * were ever exported to CSV/XLSX (OWASP CSV-injection guidance) — `=`,
 * `+`, `-`, `@`, or a leading tab/CR. Defense-in-depth: no export exists
 * yet in this phase, but table/text answers are the values most likely
 * to end up in one later, so they're sanitized at the point of entry.
 */
export function containsFormulaInjectionRisk(value: string): boolean {
  return /^[\s]*[=+\-@\t\r]/.test(value);
}

export type ValidationErrors = Record<string, string[]>;

function addError(errors: ValidationErrors, key: string, message: string): void {
  errors[key] = [...(errors[key] ?? []), message];
}

function validateFieldValue(
  field: FormFieldDefinition,
  value: unknown,
  errors: ValidationErrors,
  keyPath: string,
): void {
  switch (field.type) {
    case "text": {
      if (typeof value !== "string") {
        addError(errors, keyPath, "Must be text.");
        return;
      }
      if (containsFormulaInjectionRisk(value)) {
        addError(errors, keyPath, "This value cannot start with =, +, -, or @.");
      }
      if (field.minLength !== undefined && value.length < field.minLength) {
        addError(errors, keyPath, `Must be at least ${field.minLength} characters.`);
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        addError(errors, keyPath, `Must be at most ${field.maxLength} characters.`);
      }
      if (field.pattern && !new RegExp(field.pattern).test(value)) {
        addError(errors, keyPath, "Does not match the required format.");
      }
      return;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        addError(errors, keyPath, "Must be a number.");
        return;
      }
      if (field.min !== undefined && value < field.min)
        addError(errors, keyPath, `Must be at least ${field.min}.`);
      if (field.max !== undefined && value > field.max)
        addError(errors, keyPath, `Must be at most ${field.max}.`);
      return;
    }
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        addError(errors, keyPath, "Must be a date (YYYY-MM-DD).");
        return;
      }
      if (field.minDate && value < field.minDate)
        addError(errors, keyPath, `Must be on or after ${field.minDate}.`);
      if (field.maxDate && value > field.maxDate)
        addError(errors, keyPath, `Must be on or before ${field.maxDate}.`);
      return;
    }
    case "select": {
      const allowed = new Set((field.options ?? []).map((option) => option.value));
      if (typeof value !== "string" || !allowed.has(value)) {
        addError(errors, keyPath, "Must be one of the allowed options.");
      }
      return;
    }
    case "checkbox": {
      if (typeof value !== "boolean") {
        addError(errors, keyPath, "Must be true or false.");
        return;
      }
      if (field.required && value !== true) {
        addError(errors, keyPath, "Must be acknowledged.");
      }
      return;
    }
    case "file": {
      const evidenceId = (value as { evidenceId?: unknown } | null)?.evidenceId;
      if (typeof evidenceId !== "string" || evidenceId.trim().length === 0) {
        addError(errors, keyPath, "A file must be uploaded.");
      }
      return;
    }
    case "signature": {
      const signature = value as { signedName?: unknown; acknowledged?: unknown } | null;
      if (
        !signature ||
        typeof signature.signedName !== "string" ||
        signature.signedName.trim().length === 0 ||
        signature.acknowledged !== true
      ) {
        addError(errors, keyPath, "A typed signature and acknowledgment are required.");
      }
      return;
    }
    case "table": {
      if (!Array.isArray(value)) {
        addError(errors, keyPath, "Must be a list of rows.");
        return;
      }
      if (field.minRows !== undefined && value.length < field.minRows) {
        addError(errors, keyPath, `At least ${field.minRows} row(s) required.`);
      }
      if (field.maxRows !== undefined && value.length > field.maxRows) {
        addError(errors, keyPath, `At most ${field.maxRows} row(s) allowed.`);
      }
      value.forEach((row, index) => {
        for (const column of field.columns ?? []) {
          const rowValue = (row as Record<string, unknown> | null)?.[column.key];
          validateFieldWithRequiredness(
            column,
            rowValue,
            errors,
            `${keyPath}.${index}.${column.key}`,
            true,
          );
        }
      });
      return;
    }
  }
}

function validateFieldWithRequiredness(
  field: FormFieldDefinition,
  value: unknown,
  errors: ValidationErrors,
  keyPath: string,
  requireAll: boolean,
): void {
  const isEmpty = value === undefined || value === null || value === "";
  if (isEmpty) {
    if (requireAll && field.required) addError(errors, keyPath, "This field is required.");
    return;
  }
  validateFieldValue(field, value, errors, keyPath);
}

/**
 * `requireAll: false` (draft save) type-checks whatever answers are
 * present but does not enforce required fields — a draft is allowed to
 * be incomplete. `requireAll: true` (final submit) additionally requires
 * every *visible* required field to have a value; a field hidden by
 * `visibleWhen` is never required, regardless of its own `required` flag.
 */
export function validateAnswers(
  fields: FormFieldDefinition[],
  answers: Record<string, unknown>,
  requireAll: boolean,
): ValidationErrors {
  const errors: ValidationErrors = {};
  for (const field of fields) {
    if (!evaluateFieldVisibility(field.visibleWhen, answers)) continue;
    validateFieldWithRequiredness(field, answers[field.key], errors, field.key, requireAll);
  }
  return errors;
}

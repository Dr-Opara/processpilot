import { describe, expect, it } from "vitest";

vi.mock("server-only", () => ({}));

import {
  containsFormulaInjectionRisk,
  evaluateFieldVisibility,
  formDefinitionSchema,
  formFieldSchema,
  validateAnswers,
  validateFieldConditionSyntax,
} from "./form-schema";
import { vi } from "vitest";
import type { FormFieldDefinition } from "@/lib/db/database.types";

describe("formFieldSchema", () => {
  it("accepts a well-formed text field", () => {
    const field: FormFieldDefinition = {
      key: "notes",
      label: "Notes",
      type: "text",
      maxLength: 500,
    };
    expect(formFieldSchema.parse(field)).toEqual(field);
  });

  it("rejects a select field with no options", () => {
    const field: FormFieldDefinition = { key: "choice", label: "Choice", type: "select" };
    expect(() => formFieldSchema.parse(field)).toThrow(/at least one option/);
  });

  it("rejects a table field with no columns", () => {
    const field: FormFieldDefinition = { key: "rows", label: "Rows", type: "table" };
    expect(() => formFieldSchema.parse(field)).toThrow(/at least one column/);
  });

  it("rejects a table column that is itself a table/file/signature", () => {
    const field: FormFieldDefinition = {
      key: "rows",
      label: "Rows",
      type: "table",
      columns: [{ key: "photo", label: "Photo", type: "file" }],
    };
    expect(() => formFieldSchema.parse(field)).toThrow(/cannot be type/);
  });

  it("rejects columns on a non-table field", () => {
    const field: FormFieldDefinition = {
      key: "notes",
      label: "Notes",
      type: "text",
      columns: [{ key: "x", label: "X", type: "text" }],
    };
    expect(() => formFieldSchema.parse(field)).toThrow(/Only a.*table.*field/);
  });

  it("rejects an unparseable visibleWhen condition", () => {
    const field: FormFieldDefinition = {
      key: "notes",
      label: "Notes",
      type: "text",
      visibleWhen: "garbage",
    };
    expect(() => formFieldSchema.parse(field)).toThrow(/notes/);
  });
});

describe("formDefinitionSchema", () => {
  it("rejects duplicate field keys", () => {
    const definition = {
      fields: [
        { key: "a", label: "A", type: "text" },
        { key: "a", label: "A again", type: "number" },
      ],
    };
    expect(() => formDefinitionSchema.parse(definition)).toThrow(/Duplicate field key/);
  });

  it("accepts a definition with unique keys", () => {
    const definition = {
      fields: [
        { key: "a", label: "A", type: "text" },
        { key: "b", label: "B", type: "number" },
      ],
    };
    expect(() => formDefinitionSchema.parse(definition)).not.toThrow();
  });
});

describe("validateFieldConditionSyntax / evaluateFieldVisibility", () => {
  it("parses a valid condition", () => {
    expect(validateFieldConditionSyntax('status == "approved"')).toBeNull();
  });

  it("rejects a malformed condition", () => {
    expect(validateFieldConditionSyntax("not valid")).not.toBeNull();
  });

  it("is always visible when no condition is set", () => {
    expect(evaluateFieldVisibility(null, {})).toBe(true);
  });

  it("evaluates a matching condition to true", () => {
    expect(evaluateFieldVisibility('status == "approved"', { status: "approved" })).toBe(true);
  });

  it("evaluates a non-matching condition to false", () => {
    expect(evaluateFieldVisibility('status == "approved"', { status: "rejected" })).toBe(false);
  });

  it("is false when the referenced field has no answer yet", () => {
    expect(evaluateFieldVisibility("amount > 100", {})).toBe(false);
  });

  it("throws for a malformed condition at evaluation time", () => {
    expect(() => evaluateFieldVisibility("garbage", {})).toThrow();
  });
});

describe("containsFormulaInjectionRisk", () => {
  it.each(["=SUM(A1:A2)", "+1+1", "-cmd", "@import", "\ttabbed"])(
    "flags %s as a formula-injection risk",
    (value) => {
      expect(containsFormulaInjectionRisk(value)).toBe(true);
    },
  );

  it("does not flag ordinary text", () => {
    expect(containsFormulaInjectionRisk("Inspected the site, no issues found.")).toBe(false);
  });
});

describe("validateAnswers", () => {
  const fields: FormFieldDefinition[] = [
    { key: "name", label: "Name", type: "text", required: true, maxLength: 50 },
    { key: "amount", label: "Amount", type: "number", required: true, min: 0, max: 1000 },
    { key: "date", label: "Date", type: "date", required: true },
    {
      key: "severity",
      label: "Severity",
      type: "select",
      required: true,
      options: [
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
      ],
    },
    { key: "acknowledge", label: "Acknowledge", type: "checkbox", required: true },
    { key: "photo", label: "Photo", type: "file", required: true },
    { key: "sign", label: "Signature", type: "signature", required: true },
    {
      key: "escalationNotes",
      label: "Escalation notes",
      type: "text",
      required: true,
      visibleWhen: 'severity == "high"',
    },
    {
      key: "items",
      label: "Items",
      type: "table",
      minRows: 1,
      columns: [
        { key: "sku", label: "SKU", type: "text", required: true },
        { key: "qty", label: "Qty", type: "number", required: true, min: 1 },
      ],
    },
  ];

  const validAnswers = {
    name: "Jordan",
    amount: 250,
    date: "2026-07-25",
    severity: "low",
    acknowledge: true,
    photo: { evidenceId: "11111111-1111-4111-8111-111111111111" },
    sign: { signedName: "Jordan Lee", acknowledged: true },
    items: [{ sku: "A1", qty: 2 }],
  };

  it("passes with no errors when every visible required field is valid", () => {
    expect(validateAnswers(fields, validAnswers, true)).toEqual({});
  });

  it("requires escalationNotes only when severity is high (conditional visibility)", () => {
    const errors = validateAnswers(fields, validAnswers, true);
    expect(errors.escalationNotes).toBeUndefined();

    const highSeverity = { ...validAnswers, severity: "high" };
    const errorsHigh = validateAnswers(fields, highSeverity, true);
    expect(errorsHigh.escalationNotes).toEqual(["This field is required."]);
  });

  it("reports missing required fields on final submit", () => {
    const errors = validateAnswers(fields, {}, true);
    expect(errors.name).toEqual(["This field is required."]);
    expect(errors.amount).toEqual(["This field is required."]);
    expect(errors.acknowledge).toEqual(["This field is required."]);
  });

  it("does not require missing fields on a draft save", () => {
    expect(validateAnswers(fields, {}, false)).toEqual({});
  });

  it("still type-validates whatever is present on a draft save", () => {
    const errors = validateAnswers(fields, { amount: "not a number" }, false);
    expect(errors.amount).toEqual(["Must be a number."]);
  });

  it("enforces numeric bounds", () => {
    const errors = validateAnswers(fields, { ...validAnswers, amount: 5000 }, true);
    expect(errors.amount).toEqual(["Must be at most 1000."]);
  });

  it("enforces the checkbox-as-acknowledgment rule", () => {
    const errors = validateAnswers(fields, { ...validAnswers, acknowledge: false }, true);
    expect(errors.acknowledge).toEqual(["Must be acknowledged."]);
  });

  it("enforces select options", () => {
    const errors = validateAnswers(fields, { ...validAnswers, severity: "medium" }, true);
    expect(errors.severity).toEqual(["Must be one of the allowed options."]);
  });

  it("rejects a table row with a formula-injection-risky text value", () => {
    const errors = validateAnswers(
      fields,
      { ...validAnswers, items: [{ sku: "=1+1", qty: 1 }] },
      true,
    );
    expect(errors["items.0.sku"]).toEqual(["This value cannot start with =, +, -, or @."]);
  });

  it("enforces minRows on a table field", () => {
    const errors = validateAnswers(fields, { ...validAnswers, items: [] }, true);
    expect(errors.items).toEqual(["At least 1 row(s) required."]);
  });

  it("requires a signature's typed name and acknowledgment", () => {
    const errors = validateAnswers(
      fields,
      { ...validAnswers, sign: { signedName: "", acknowledged: true } },
      true,
    );
    expect(errors.sign).toEqual(["A typed signature and acknowledgment are required."]);
  });

  it("requires a file field to reference an uploaded evidence id", () => {
    const errors = validateAnswers(fields, { ...validAnswers, photo: {} }, true);
    expect(errors.photo).toEqual(["A file must be uploaded."]);
  });
});

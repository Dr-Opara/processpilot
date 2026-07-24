import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  evaluateCondition,
  parseCondition,
  validateConditionSyntax,
  type WorkflowInstanceContext,
} from "./workflow-condition";

describe("parseCondition", () => {
  it("parses an equality comparison against a quoted string", () => {
    const result = parseCondition('approval-1.decision == "approved"');
    expect(result).toEqual({
      nodeId: "approval-1",
      key: "decision",
      operator: "==",
      value: "approved",
    });
  });

  it("parses a numeric comparison", () => {
    const result = parseCondition("form-1.amount > 500");
    expect(result).toEqual({ nodeId: "form-1", key: "amount", operator: ">", value: 500 });
  });

  it("parses a boolean literal", () => {
    const result = parseCondition("form-1.approved == true");
    expect(result).toEqual({ nodeId: "form-1", key: "approved", operator: "==", value: true });
  });

  it("rejects an unparseable condition", () => {
    const result = parseCondition("not a real condition");
    expect(result).toHaveProperty("message");
  });

  it("rejects an unquoted, non-numeric value", () => {
    const result = parseCondition("form-1.status == approved");
    expect(result).toHaveProperty("message");
  });
});

describe("validateConditionSyntax", () => {
  it("returns null for a valid condition", () => {
    expect(validateConditionSyntax('a.b == "c"')).toBeNull();
  });

  it("returns an error for an invalid condition", () => {
    expect(validateConditionSyntax("garbage")).not.toBeNull();
  });
});

describe("evaluateCondition", () => {
  const context: WorkflowInstanceContext = {
    "approval-1": { decision: "approved" },
    "form-1": { amount: 750, approved: true },
  };

  it("evaluates a matching string equality to true", () => {
    expect(evaluateCondition('approval-1.decision == "approved"', context)).toBe(true);
  });

  it("evaluates a non-matching string equality to false", () => {
    expect(evaluateCondition('approval-1.decision == "rejected"', context)).toBe(false);
  });

  it("evaluates numeric comparisons", () => {
    expect(evaluateCondition("form-1.amount > 500", context)).toBe(true);
    expect(evaluateCondition("form-1.amount < 500", context)).toBe(false);
    expect(evaluateCondition("form-1.amount >= 750", context)).toBe(true);
    expect(evaluateCondition("form-1.amount <= 749", context)).toBe(false);
  });

  it("evaluates inequality", () => {
    expect(evaluateCondition('approval-1.decision != "rejected"', context)).toBe(true);
  });

  it("returns false when the referenced node/key has no output yet", () => {
    expect(evaluateCondition('missing-node.key == "x"', context)).toBe(false);
  });

  it("returns false for a numeric comparison against a non-numeric actual value", () => {
    expect(evaluateCondition("approval-1.decision > 5", context)).toBe(false);
  });

  it("throws for an unparseable condition", () => {
    expect(() => evaluateCondition("garbage", context)).toThrow();
  });
});

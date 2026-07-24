import "server-only";

/**
 * Evaluates a decision node's free-text outgoing-edge `condition`
 * (ProcessEdge.condition — see process-versions.ts's processEdgeSchema)
 * against the workflow instance's accumulated task outputs.
 *
 * Grammar: `<nodeId>.<key> <op> <value>`, where `<op>` is one of
 * ==, !=, >, >=, <, <= and `<value>` is a JSON literal (a quoted
 * string, a number, or true/false) — e.g. `approval-1.decision ==
 * "approved"` or `form-1.amount > 500`. Deliberately not a general
 * expression language (no boolean combinators, no arithmetic): a small,
 * fully-enumerable grammar is easy to validate up front and impossible
 * to use for anything beyond comparing one prior node's output field to
 * one literal, which is all a graph-defined decision branch needs.
 * `<nodeId>` refers to a `tasks.node_id` earlier in the *same* workflow
 * instance — see workflow-engine.ts's buildInstanceContext.
 */
export type WorkflowInstanceContext = Record<string, Record<string, unknown>>;

const CONDITION_PATTERN = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/;

export interface ConditionParseError {
  message: string;
}

interface ParsedCondition {
  nodeId: string;
  key: string;
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
  value: string | number | boolean;
}

export function parseCondition(condition: string): ParsedCondition | ConditionParseError {
  const match = CONDITION_PATTERN.exec(condition.trim());
  if (!match) {
    return {
      message:
        `Could not parse condition "${condition}" — expected the form ` +
        `<nodeId>.<key> <op> <value> (op one of ==, !=, >, >=, <, <=).`,
    };
  }
  const [, nodeId, key, operator, rawValue] = match;

  let value: string | number | boolean;
  const trimmedValue = rawValue.trim();
  if (trimmedValue === "true") {
    value = true;
  } else if (trimmedValue === "false") {
    value = false;
  } else if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
    value = Number(trimmedValue);
  } else if (/^".*"$/.test(trimmedValue) || /^'.*'$/.test(trimmedValue)) {
    value = trimmedValue.slice(1, -1);
  } else {
    return {
      message: `Condition "${condition}" has an unquoted, non-numeric value "${rawValue}".`,
    };
  }

  return { nodeId, key, operator: operator as ParsedCondition["operator"], value };
}

function isConditionParseError(
  result: ParsedCondition | ConditionParseError,
): result is ConditionParseError {
  return "message" in result;
}

/**
 * True if `condition` matches `context`; false both when it evaluates to
 * false *and* when the referenced node/key simply hasn't produced output
 * yet (a decision node can only be reached after its dependency has run,
 * per the graph's validated reachability, but defends against it anyway
 * rather than throwing mid-execution over a value simply being absent).
 * Throws only for a condition string that fails to parse — that's a
 * process-authoring error, not a runtime data question, and is instead
 * caught up front by validateDecisionConditions below before a version
 * can be submitted for review.
 */
export function evaluateCondition(condition: string, context: WorkflowInstanceContext): boolean {
  const parsed = parseCondition(condition);
  if (isConditionParseError(parsed)) {
    throw new Error(parsed.message);
  }

  const actual = context[parsed.nodeId]?.[parsed.key];
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

/** Used by process-graph-validation.ts to reject unparseable decision conditions before a version can be reviewed, rather than discovering the parse error mid-execution. */
export function validateConditionSyntax(condition: string): ConditionParseError | null {
  const result = parseCondition(condition);
  return isConditionParseError(result) ? result : null;
}

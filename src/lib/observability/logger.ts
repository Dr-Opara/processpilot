import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Structured JSON logging (Phase 23) — every server-side log call in
 * this codebase should eventually route through this rather than a bare
 * `console.*`, so log lines are queryable (Vercel/any log aggregator
 * parses JSON stdout lines natively) instead of free text. Existing
 * `console.error(message, error)` call sites (Phase 3–22) are not
 * retrofitted in this pass — see
 * docs/architecture/observability.md's known gaps — this module is the
 * foundation new/touched call sites should use going forward.
 *
 * Redaction: `redact()` strips common secret-shaped values (bearer
 * tokens, API keys, anything under a key literally named
 * password/secret/token/authorization/apiKey) from a context object
 * before it's ever serialized — defense in depth even though every
 * caller should already avoid passing raw secrets.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  organizationId?: string;
  memberId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN = /password|secret|token|authorization|apikey|api_key/i;
const REDACTED = "[redacted]";

export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(val, seen);
  }
  return result;
}

export function generateCorrelationId(): string {
  return randomUUID();
}

export function logEvent(level: LogLevel, message: string, context: LogContext = {}): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(redact(context) as Record<string, unknown>),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => logEvent("debug", message, context),
  info: (message: string, context?: LogContext) => logEvent("info", message, context),
  warn: (message: string, context?: LogContext) => logEvent("warn", message, context),
  error: (message: string, context?: LogContext) => logEvent("error", message, context),
};

import "server-only";
import { logger, redact, type LogContext } from "@/lib/observability/logger";

/**
 * Provider-neutral error-reporting adapter (Phase 23), same pattern as
 * the AI (ADR-0008), notification, and billing adapters:
 * `getErrorReportingProvider()` is the one place that names a concrete
 * implementation.
 *
 * No real Sentry (or equivalent) SDK is wired up in this pass — adding
 * one means a new dependency, DSN provisioning, and source-map/release
 * configuration this environment has no credentials to verify against.
 * `isErrorReportingConfigured()` checks for `SENTRY_DSN` so the
 * adapter's shape is ready for a real provider to slot in behind it
 * later without callers changing; until then, every environment uses
 * `ConsoleErrorReportingProvider`, which logs a redacted, structured
 * error event via the same logger every other observability surface
 * uses — a real fallback, not a silent no-op.
 */
export interface ErrorReportingContext extends LogContext {
  route?: string;
  action?: string;
}

export interface ErrorReportingProvider {
  readonly name: string;
  captureException(error: unknown, context?: ErrorReportingContext): void;
}

export function isErrorReportingConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN);
}

class ConsoleErrorReportingProvider implements ErrorReportingProvider {
  readonly name = "console";

  captureException(error: unknown, context: ErrorReportingContext = {}): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(message, {
      ...(redact(context) as ErrorReportingContext),
      stack,
      configuredProvider: isErrorReportingConfigured()
        ? "sentry (unverified in this environment)"
        : "none",
    });
  }
}

let provider: ErrorReportingProvider | undefined;

export function getErrorReportingProvider(): ErrorReportingProvider {
  if (!provider) provider = new ConsoleErrorReportingProvider();
  return provider;
}

/** Convenience call site — mirrors `toSafeErrorResponse()`'s "one function every route calls" shape. */
export function captureException(error: unknown, context?: ErrorReportingContext): void {
  getErrorReportingProvider().captureException(error, context);
}

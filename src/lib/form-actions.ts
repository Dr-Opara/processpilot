import "server-only";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/errors";

/** Next.js's redirect() works by throwing a special error with a `digest` starting with "NEXT_REDIRECT" — re-thrown here rather than swallowed by a surrounding try/catch. */
export function isRedirectError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT"),
  );
}

export function redirectTyped(url: string): never {
  redirect(url as Route);
}

export function formErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid input.";
  return "Something went wrong. Please try again.";
}

/** Runs a server action's body; on failure (that isn't a redirect), redirects back to `onErrorPath` with ?error=<message>. */
export async function runFormAction(
  onErrorPath: string,
  fn: () => Promise<string>,
): Promise<void> {
  try {
    const successPath = await fn();
    redirectTyped(successPath);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirectTyped(`${onErrorPath}${onErrorPath.includes("?") ? "&" : "?"}error=${encodeURIComponent(formErrorMessage(error))}`);
  }
}

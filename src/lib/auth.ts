import "server-only";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SIGN_IN_PATH } from "@/lib/app-host";

/**
 * Server-only guard for the authenticated app. Redirects signed-out
 * callers to sign-in; returns the caller's Clerk session otherwise.
 *
 * Deliberately minimal — no permission/role checks here. ProcessPilot's
 * own Member/Role schema and the permissions-matrix.md enforcement layer
 * land in Phase 4 and build on this seam; this phase only proves
 * "server-side session verification covers every protected route" per
 * the Phase 3 exit criteria.
 */
export async function requireAuth() {
  const session = await auth();

  if (!session.userId) {
    // typedRoutes only recognizes string literals passed directly to
    // redirect(), not ones re-exported through a shared constant — cast
    // rather than duplicate the literal (SIGN_IN_PATH is a real route,
    // src/app/app/(auth)/sign-in/[[...sign-in]]/page.tsx).
    redirect(SIGN_IN_PATH as Route);
  }

  return session;
}

import "server-only";
import { getCurrentProfile } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import type { ProfileRow } from "@/lib/db/database.types";

/**
 * Platform-admin authorization — a trust boundary deliberately kept
 * entirely separate from every organization's own role/permission
 * system (Phase 27's own security requirement: "prevent platform-admin
 * capability from being granted through tenant roles"). Status is read
 * from `PLATFORM_ADMIN_EMAILS` (a comma-separated allowlist set as a
 * Vercel/Codespaces environment variable), never from a database row a
 * tenant admin — or even another platform feature — could write to.
 * Changing who holds platform-admin access requires a deployment
 * configuration change, not an application-level grant, by design.
 *
 * Every platform-admin action still goes through the normal Clerk
 * session (`getCurrentProfile()`) — this only adds a second, narrower
 * check on top, never a bypass of authentication itself.
 */
function platformAdminEmails(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdminEmail(email: string): boolean {
  return platformAdminEmails().has(email.trim().toLowerCase());
}

export async function requirePlatformAdmin(): Promise<ProfileRow> {
  const profile = await getCurrentProfile();
  if (!isPlatformAdminEmail(profile.email)) {
    throw new AppError("forbidden", "Platform administration access is required.");
  }
  return profile;
}

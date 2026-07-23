/**
 * Shared display-name formatting for member selects/lists across
 * teams/departments/locations/members pages — a member's profile may
 * have no name on file yet (invited but not yet onboarded), so every
 * caller needs the same "fall back to email" behavior.
 */
export function memberDisplayName(member: {
  first_name?: string | null;
  last_name?: string | null;
  email: string;
}): string {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? `${name} (${member.email})` : member.email;
}

export function memberStatusBadgeStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "suspended") return "warning";
  if (status === "removed") return "danger";
  return "neutral";
}

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { createFakeSql, asTransactionSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import { archiveTeam, createTeam, setTeamMembers, updateTeam } from "./teams";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) => fn(asTransactionSql(fakeSql)));
  return fakeSql;
}

describe("teams service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("creates a team when the caller holds team.manage", async () => {
    const membership = makeMembership({ permissions: ["team.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select id from teams"), respond: () => [] },
      {
        match: (t) => t.includes("insert into teams"),
        respond: () => [{ id: "team-1", name: "Night Shift", archived_at: null }],
      },
    ]);

    const team = await createTeam({ name: "Night Shift" });

    expect(team).toEqual({ id: "team-1", name: "Night Shift", archived_at: null });
    expect(requirePermission).toHaveBeenCalledWith("team.manage");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("scopes update/archive to the specific team id — a manager owning team A cannot silently act on team B", async () => {
    const membership = makeMembership({ scopedPermissions: ["team.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from teams where id"),
        respond: () => [{ id: "team-b", name: "Day Shift", archived_at: null }],
      },
      {
        match: (t) => t.includes("update teams set"),
        respond: () => [{ id: "team-b", name: "Day Shift", archived_at: null }],
      },
    ]);

    await updateTeam("team-b", { name: "Day Shift" });

    expect(requirePermission).toHaveBeenCalledWith("team.manage", { scope: { teamId: "team-b" } });
  });

  it("propagates a forbidden error instead of archiving a team the caller does not own", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new AppError("forbidden", "Missing permission: team.manage"));
    wireTenantContext();

    await expect(archiveTeam("team-not-owned")).rejects.toThrow("Missing permission");
    expect(requirePermission).toHaveBeenCalledWith("team.manage", { scope: { teamId: "team-not-owned" } });
  });

  it("replaces a team's full membership list in setTeamMembers", async () => {
    const membership = makeMembership({ permissions: ["team.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from teams where id"),
        respond: () => [{ id: "team-1", name: "Night Shift", archived_at: null }],
      },
      { match: (t) => t.includes("delete from team_members"), respond: () => [] },
      { match: (t) => t.includes("insert into team_members"), respond: () => [] },
    ]);

    await setTeamMembers("team-1", ["member-a", "member-b"]);

    expect(fakeSql.calls.filter((c) => c.text.includes("insert into team_members"))).toHaveLength(2);
    expect(
      fakeSql.calls.find((c) => c.text.includes("insert into audit_events"))?.values,
    ).toBeDefined();
  });

  it("rejects setTeamMembers for a team the caller does not manage", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new AppError("forbidden", "Missing permission: team.manage"));
    wireTenantContext();

    await expect(setTeamMembers("team-not-owned", ["member-a"])).rejects.toThrow("Missing permission");
  });
});

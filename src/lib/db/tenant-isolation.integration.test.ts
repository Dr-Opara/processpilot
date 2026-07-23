import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTestSql, withTestClaims } from "./client-test";

/**
 * Live-DB proof of docs/architecture/multi-tenancy.md's tenant-isolation
 * guarantees, run against a real Supabase Postgres instance — this is
 * what src/lib/db/schema-coverage.test.ts can't do statically. Skips
 * itself entirely (not a failure) when SUPABASE_DB_URL is unset, exactly
 * like e2e/global-setup.ts does for missing Clerk credentials. Run for
 * real with `npm run test:integration` once a Supabase project exists —
 * see docs/development/supabase-setup.md.
 *
 * Setup uses the raw sql connection directly (superuser, bypasses RLS —
 * appropriate for fixture setup) and withTestClaims() to exercise
 * specific caller identities against RLS the same way the real
 * application does via withTenantContext(). withTestClaims() only ever
 * sets identity (clerkUserId/organizationId/memberId) — RLS re-derives
 * active status and permissions from the database itself (see
 * 20260719130002's current_org_id()/current_member_permissions()), which
 * is exactly what these tests are proving: a claimed member_id that
 * doesn't correspond to a real, active row grants nothing, regardless of
 * what else is claimed.
 */
const sql = getTestSql();

describe.skipIf(!sql)("tenant isolation (live Supabase Postgres)", () => {
  const db = sql!;

  let orgA: { id: string };
  let orgB: { id: string };
  let profileOwnerA: { id: string };
  let profileEmployeeA: { id: string };
  let profileAuditorA: { id: string };
  let profileSuspendedA: { id: string };
  let profileRemovedA: { id: string };
  let profileNonMemberA: { id: string; clerk_user_id: string };
  let memberOwnerA: { id: string };
  let memberEmployeeA: { id: string };
  let memberAuditorA: { id: string };
  let memberSuspendedA: { id: string };
  let memberRemovedA: { id: string };
  let roleAuditorId: string;
  let departmentB: { id: string };
  let profileManagerA: { id: string; clerk_user_id: string };
  let memberManagerA: { id: string };
  let departmentOwnedByManagerA: { id: string };
  let departmentNotOwnedA: { id: string };
  let locationB: { id: string };
  let teamB: { id: string };
  let importBatchA: { id: string };

  const suffix = `test_${Date.now()}`;
  const NONEXISTENT_MEMBER_ID = "00000000-0000-0000-0000-000000000000";

  beforeAll(async () => {
    [orgA] = await db<{ id: string }[]>`
      insert into organizations (clerk_org_id, name, slug)
      values (${`org_a_${suffix}`}, 'Test Org A', ${`test-org-a-${suffix}`})
      returning id
    `;
    [orgB] = await db<{ id: string }[]>`
      insert into organizations (clerk_org_id, name, slug)
      values (${`org_b_${suffix}`}, 'Test Org B', ${`test-org-b-${suffix}`})
      returning id
    `;

    const makeProfile = async (label: string) => {
      const clerkUserId = `user_${label}_${suffix}`;
      const [profile] = await db<{ id: string; clerk_user_id: string }[]>`
        insert into profiles (clerk_user_id, email)
        values (${clerkUserId}, ${`${label}@${suffix}.test`})
        returning id, clerk_user_id
      `;
      return profile;
    };

    profileOwnerA = await makeProfile("owner_a");
    profileEmployeeA = await makeProfile("employee_a");
    profileAuditorA = await makeProfile("auditor_a");
    profileSuspendedA = await makeProfile("suspended_a");
    profileRemovedA = await makeProfile("removed_a");
    profileNonMemberA = await makeProfile("nonmember");
    profileManagerA = await makeProfile("manager_a");

    const makeMember = async (profile: { id: string }, org: { id: string }, status: string) => {
      const [member] = await db<{ id: string }[]>`
        insert into organization_members (organization_id, profile_id, clerk_membership_id, status)
        values (${org.id}, ${profile.id}, ${`orgmem_${profile.id}_${suffix}`}, ${status})
        returning id
      `;
      return member;
    };

    memberOwnerA = await makeMember(profileOwnerA, orgA, "active");
    memberEmployeeA = await makeMember(profileEmployeeA, orgA, "active");
    memberAuditorA = await makeMember(profileAuditorA, orgA, "active");
    memberSuspendedA = await makeMember(profileSuspendedA, orgA, "suspended");
    memberRemovedA = await makeMember(profileRemovedA, orgA, "removed");
    memberManagerA = await makeMember(profileManagerA, orgA, "active");
    // profileNonMemberA deliberately gets no organization_members row at all.

    const [ownerRole] = await db<
      { id: string }[]
    >`select id from roles where key = 'organization_owner' and organization_id is null`;
    const [employeeRole] = await db<
      { id: string }[]
    >`select id from roles where key = 'employee' and organization_id is null`;
    const [auditorRole] = await db<
      { id: string }[]
    >`select id from roles where key = 'auditor' and organization_id is null`;
    const [managerRole] = await db<
      { id: string }[]
    >`select id from roles where key = 'manager' and organization_id is null`;
    roleAuditorId = auditorRole.id;

    await db`insert into member_role_assignments (organization_id, organization_member_id, role_id) values (${orgA.id}, ${memberOwnerA.id}, ${ownerRole.id})`;
    await db`insert into member_role_assignments (organization_id, organization_member_id, role_id) values (${orgA.id}, ${memberEmployeeA.id}, ${employeeRole.id})`;
    await db`insert into member_role_assignments (organization_id, organization_member_id, role_id) values (${orgA.id}, ${memberAuditorA.id}, ${auditorRole.id})`;
    await db`insert into member_role_assignments (organization_id, organization_member_id, role_id) values (${orgA.id}, ${memberManagerA.id}, ${managerRole.id})`;

    [departmentB] = await db<{ id: string }[]>`
      insert into departments (organization_id, name)
      values (${orgB.id}, ${`Test Department B ${suffix}`})
      returning id
    `;

    [departmentOwnedByManagerA] = await db<{ id: string }[]>`
      insert into departments (organization_id, name, owner_member_id)
      values (${orgA.id}, ${`Owned By Manager A ${suffix}`}, ${memberManagerA.id})
      returning id
    `;
    [departmentNotOwnedA] = await db<{ id: string }[]>`
      insert into departments (organization_id, name)
      values (${orgA.id}, ${`Not Owned A ${suffix}`})
      returning id
    `;

    [locationB] = await db<{ id: string }[]>`
      insert into organization_locations (organization_id, name)
      values (${orgB.id}, ${`Test Location B ${suffix}`})
      returning id
    `;
    [teamB] = await db<{ id: string }[]>`
      insert into teams (organization_id, name)
      values (${orgB.id}, ${`Test Team B ${suffix}`})
      returning id
    `;

    [importBatchA] = await db<{ id: string }[]>`
      insert into member_import_batches (organization_id, status, total_rows)
      values (${orgA.id}, 'completed', 1)
      returning id
    `;
  });

  afterAll(async () => {
    await db`delete from organizations where id in (${orgA.id}, ${orgB.id})`;
    await db.end();
  });

  /** Unrestricted (admin-connection) lookup, used only for test assertions — never for constructing claims. */
  async function unscopedPermissionsFor(memberId: string): Promise<string[]> {
    const rows = await db<{ key: string }[]>`
      select distinct p.key
      from member_role_assignments mra
      join role_permissions rp on rp.role_id = mra.role_id
      join permissions p on p.id = rp.permission_id
      where mra.organization_member_id = ${memberId} and rp.scope is null
    `;
    return rows.map((row) => row.key);
  }

  it("test 1/2: an active Org A member can read, but cannot update, Org B's organization row", async () => {
    await withTestClaims(
      db,
      { clerkUserId: "user_owner_a", organizationId: orgA.id, memberId: memberOwnerA.id },
      async (tx) => {
        const rows = await tx`select id from organizations where id = ${orgB.id}`;
        expect(rows).toHaveLength(0);

        // organizations_update's USING clause silently filters to 0 rows
        // (no policy violation exception) — RLS, not a privilege denial —
        // so this can safely share a transaction with the read above.
        const updated = await tx`
          update organizations set name = 'hijacked' where id = ${orgB.id} returning id
        `;
        expect(updated).toHaveLength(0);
      },
    );
  });

  it("test 3: an active Org A member cannot delete Org B's department (no delete grant on departments at all)", async () => {
    // authenticated never has a DELETE grant on departments (only select/
    // insert/update — see supabase/migrations/20260719130006's header
    // comment) — a privilege error is a hard exception that aborts the
    // whole transaction, unlike organizations_update's silent RLS filter
    // above, so this needs its own transaction and an outer rejects
    // assertion (same fix as tests 7/8).
    await expect(
      withTestClaims(
        db,
        { clerkUserId: "user_owner_a", organizationId: orgA.id, memberId: memberOwnerA.id },
        async (tx) => {
          await tx`delete from departments where id = ${departmentB.id}`;
        },
      ),
    ).rejects.toThrow();
  });

  it("test 4: a nonmember of Org A (no organization_members row at all) sees zero rows for Org A", async () => {
    await withTestClaims(
      db,
      {
        clerkUserId: profileNonMemberA.clerk_user_id,
        organizationId: orgA.id,
        memberId: NONEXISTENT_MEMBER_ID,
      },
      async (tx) => {
        const rows = await tx`select id from organizations where id = ${orgA.id}`;
        expect(rows).toHaveLength(0);
      },
    );
  });

  it("test 5: a suspended member is denied all access, even to their own org", async () => {
    await withTestClaims(
      db,
      { clerkUserId: "user_suspended_a", organizationId: orgA.id, memberId: memberSuspendedA.id },
      async (tx) => {
        const rows = await tx`select id from organizations where id = ${orgA.id}`;
        expect(rows).toHaveLength(0);
      },
    );
  });

  it("test 6: a removed member is denied all access", async () => {
    await withTestClaims(
      db,
      { clerkUserId: "user_removed_a", organizationId: orgA.id, memberId: memberRemovedA.id },
      async (tx) => {
        const rows = await tx`select id from organizations where id = ${orgA.id}`;
        expect(rows).toHaveLength(0);
      },
    );
  });

  it("test 7: an employee (no role.manage) cannot insert a member_role_assignment", async () => {
    const permissions = await unscopedPermissionsFor(memberEmployeeA.id);
    expect(permissions).not.toContain("role.manage");

    // A WITH CHECK violation on INSERT is a hard Postgres exception (unlike
    // a blocked SELECT/UPDATE/DELETE, which just silently returns 0 rows
    // via its USING clause) — it aborts the whole transaction, so the
    // rejection must be asserted on the *outer* withTestClaims() call, not
    // caught mid-transaction and continued past. Catching it inside the
    // callback and letting the transaction try to commit anyway is what
    // caused this test (and the next one, sharing the pooled connection)
    // to fail non-deterministically before this fix.
    await expect(
      withTestClaims(
        db,
        { clerkUserId: "user_employee_a", organizationId: orgA.id, memberId: memberEmployeeA.id },
        async (tx) => {
          await tx`insert into member_role_assignments (organization_id, organization_member_id, role_id)
             values (${orgA.id}, ${memberEmployeeA.id}, ${roleAuditorId})`;
        },
      ),
    ).rejects.toThrow();
  });

  it("test 8: an auditor cannot mutate audit_events (no update/delete grant exists for any role)", async () => {
    // auditor's audit.view grant is marked "Scoped" in
    // product/permissions-matrix.md (not "✓" like organization_owner/
    // organization_admin) — so per this migration set's documented,
    // deliberate under-provisioning of scoped grants (see
    // 20260719130001's header comment), auditor correctly holds *zero*
    // unscoped permissions in Phase 4, audit.view included. That's a real,
    // known limitation (auditors can't read audit_events via RLS until
    // Phase 5 wires up scope resolution — see
    // authentication-and-authorization.md's "known limitations"), not
    // asserted further here; this test only proves the separate, stronger
    // guarantee that mutation is impossible for *any* role.
    const permissions = await unscopedPermissionsFor(memberAuditorA.id);
    expect(permissions).toEqual([]);

    // audit_events has no update/delete grant to `authenticated` at all
    // (see its migration) — a privilege error, like an RLS violation,
    // aborts the whole transaction, so this must be asserted on the outer
    // withTestClaims() call, not caught mid-transaction (same fix as test
    // 7 above).
    await expect(
      withTestClaims(
        db,
        { clerkUserId: "user_auditor_a", organizationId: orgA.id, memberId: memberAuditorA.id },
        async (tx) => {
          await tx`update audit_events set reason = 'tampered' where organization_id = ${orgA.id}`;
        },
      ),
    ).rejects.toThrow();
  });

  it("test 9: a member with no role assignments has no unscoped access beyond unrestricted-read tables", async () => {
    const [memberNoRoles] = await db<{ id: string }[]>`
      insert into organization_members (organization_id, profile_id, clerk_membership_id, status)
      values (${orgA.id}, ${profileNonMemberA.id}, ${`orgmem_norole_${suffix}`}, 'active')
      returning id
    `;

    await withTestClaims(
      db,
      {
        clerkUserId: profileNonMemberA.clerk_user_id,
        organizationId: orgA.id,
        memberId: memberNoRoles.id,
      },
      async (tx) => {
        // organization_settings has no permission gate on SELECT — readable.
        const rows =
          await tx`select id from organization_settings where organization_id = ${orgA.id}`;
        expect(Array.isArray(rows)).toBe(true);

        // But every write requires organization.settings, which this member lacks.
        const updated = await tx`
          update organization_settings set timezone = 'UTC' where organization_id = ${orgA.id} returning id
        `;
        expect(updated).toHaveLength(0);
      },
    );
  });

  it("test 10: organization_owner holds exactly the documented unscoped permissions (product/permissions-matrix.md)", async () => {
    const permissions = await unscopedPermissionsFor(memberOwnerA.id);

    expect(permissions.sort()).toEqual(
      [
        "organization.manage",
        "organization.settings",
        "billing.manage",
        "member.invite",
        "member.manage",
        "role.manage",
        "location.manage",
        "department.manage",
        "team.manage",
        "knowledge.view",
        "process.view",
        "training.view",
        "analytics.view",
        "audit.view",
        "audit.export",
        "integration.manage",
        "ai.use",
        "ai.configure",
      ].sort(),
    );
  });

  it("test 11: an active Org A member can read, but cannot update, Org B's location", async () => {
    await withTestClaims(
      db,
      { clerkUserId: "user_owner_a", organizationId: orgA.id, memberId: memberOwnerA.id },
      async (tx) => {
        const rows = await tx`select id from organization_locations where id = ${locationB.id}`;
        expect(rows).toHaveLength(0);

        const updated = await tx`
          update organization_locations set name = 'hijacked' where id = ${locationB.id} returning id
        `;
        expect(updated).toHaveLength(0);
      },
    );
  });

  it("test 12: an active Org A member can read, but cannot update, Org B's team, and cannot insert into its team_members", async () => {
    await withTestClaims(
      db,
      { clerkUserId: "user_owner_a", organizationId: orgA.id, memberId: memberOwnerA.id },
      async (tx) => {
        const rows = await tx`select id from teams where id = ${teamB.id}`;
        expect(rows).toHaveLength(0);

        const updated =
          await tx`update teams set name = 'hijacked' where id = ${teamB.id} returning id`;
        expect(updated).toHaveLength(0);
      },
    );

    // team_members_insert's WITH CHECK fails (no scoped/unscoped team.manage
    // over Org B's team from an Org A identity) — a hard exception, so this
    // needs the outer-rejects form (same reasoning as tests 7/8 above).
    await expect(
      withTestClaims(
        db,
        { clerkUserId: "user_owner_a", organizationId: orgA.id, memberId: memberOwnerA.id },
        async (tx) => {
          await tx`insert into team_members (organization_id, team_id, organization_member_id)
             values (${orgA.id}, ${teamB.id}, ${memberOwnerA.id})`;
        },
      ),
    ).rejects.toThrow();
  });

  it("test 13: a manager's scoped department.manage lets them update the department they own, but not a sibling department in the same org", async () => {
    await withTestClaims(
      db,
      { clerkUserId: "user_manager_a", organizationId: orgA.id, memberId: memberManagerA.id },
      async (tx) => {
        const ownUpdate = await tx`
          update departments set name = 'Renamed By Owning Manager' where id = ${departmentOwnedByManagerA.id} returning id
        `;
        expect(ownUpdate).toHaveLength(1);

        // Same statement shape, different department — has_scoped_permission()
        // must re-check ownership per-row, not cache a yes from the query above.
        const siblingUpdate = await tx`
          update departments set name = 'hijacked' where id = ${departmentNotOwnedA.id} returning id
        `;
        expect(siblingUpdate).toHaveLength(0);
      },
    );
  });

  it("test 14: member_import_batches is gated on unscoped member.invite — an auditor is denied even within their own org", async () => {
    const permissions = await unscopedPermissionsFor(memberAuditorA.id);
    expect(permissions).not.toContain("member.invite");

    await withTestClaims(
      db,
      { clerkUserId: "user_auditor_a", organizationId: orgA.id, memberId: memberAuditorA.id },
      async (tx) => {
        const ownOrgRows =
          await tx`select id from member_import_batches where id = ${importBatchA.id}`;
        expect(ownOrgRows).toHaveLength(0);
      },
    );

    // Tenant isolation still applies independently for a caller who does
    // hold member.invite: Org A's owner cannot see this Org A batch from an
    // Org B claim.
    await withTestClaims(
      db,
      { clerkUserId: "user_owner_a", organizationId: orgB.id, memberId: memberOwnerA.id },
      async (tx) => {
        const crossOrgRows =
          await tx`select id from member_import_batches where id = ${importBatchA.id}`;
        expect(crossOrgRows).toHaveLength(0);
      },
    );
  });
});

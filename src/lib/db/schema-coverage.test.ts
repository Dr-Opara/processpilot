import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Statically parses every committed supabase/migrations/*.sql file and
 * fails if any tenant-owned table (one with an organization_id column)
 * is missing Row-Level Security, a policy, or an index covering
 * organization_id — the automated schema-coverage test required by
 * docs/architecture/multi-tenancy.md principle 6 and ADR-0005. This is
 * the *primary* enforcement mechanism: it needs no live database
 * connection, so it runs in ordinary `npm test` / CI and catches a
 * missing policy on a newly-added table at PR time, even before a
 * Supabase project exists to run the live-DB integration tests
 * (src/lib/db/*.integration.test.ts) against.
 *
 * This is a purpose-built parser for *this repository's* migration
 * style (consistent formatting, no embedded semicolons mid-statement,
 * no nested CREATE TABLE), not a general SQL parser — see the inline
 * comments for exactly what it assumes.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

interface TableInfo {
  name: string;
  hasOrganizationIdColumn: boolean;
  /** True if a table-level `unique (organization_id, ...)` constraint appears inside the CREATE TABLE statement itself. */
  hasInlineOrganizationIdUnique: boolean;
}

function readAllMigrationSql(): string {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  expect(files.length, "expected at least one migration file").toBeGreaterThan(0);
  const raw = files
    .map((file) => fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
  // Strip `-- ...` line comments before splitting into statements — without
  // this, a comment block has no semicolon of its own, so it stays glued
  // to the front of whatever statement follows it, and that statement's
  // leading keyword (e.g. "create table") is no longer at the start of
  // its chunk, silently failing every start-anchored regex below. Safe
  // here because no migration's SQL uses "--" inside a string literal.
  return raw.replace(/--[^\n]*/g, "");
}

/** Splits a migration file's contents into individual statements — safe here because none of this repo's SQL embeds a literal ";\n" mid-statement. */
function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** Returns the leading (first) column name from a parenthesized column list, tolerant of a nested paren (e.g. `lower(name)`) inside it. */
function leadingColumn(statementAfterOn: string): string | null {
  const openParenIndex = statementAfterOn.indexOf("(");
  if (openParenIndex === -1) return null;
  const closeParenIndex = statementAfterOn.indexOf(")", openParenIndex + 1);
  const columnList = statementAfterOn.slice(
    openParenIndex + 1,
    closeParenIndex === -1 ? undefined : closeParenIndex,
  );
  const first = columnList.split(",")[0]?.trim();
  return first || null;
}

function parseSchema(sql: string) {
  const statements = splitStatements(sql);

  const tables = new Map<string, TableInfo>();
  const rlsEnabledTables = new Set<string>();
  const tablesWithPolicies = new Set<string>();
  const tablesWithOrgIdIndex = new Set<string>();
  const tablesWithAuthenticatedRevoke = new Set<string>();

  for (const statement of statements) {
    const createTableMatch = /^create table (\w+)\s*\(/i.exec(statement);
    if (createTableMatch) {
      const name = createTableMatch[1];
      const hasOrganizationIdColumn = /^\s*organization_id\s+uuid/im.test(statement);

      // Table-level `unique (organization_id, ...)` constraint, leading column only.
      let hasInlineOrganizationIdUnique = false;
      const uniqueConstraintPattern = /unique\s*\(([^)]*)\)/gi;
      let uniqueMatch: RegExpExecArray | null;
      while ((uniqueMatch = uniqueConstraintPattern.exec(statement))) {
        const first = uniqueMatch[1].split(",")[0]?.trim();
        if (first === "organization_id") {
          hasInlineOrganizationIdUnique = true;
        }
      }
      // Column-level `organization_id uuid ... unique ...` (no parens) —
      // e.g. organization_settings' 1:1-with-organizations column.
      if (/^\s*organization_id\s+uuid\b[^,]*\bunique\b/im.test(statement)) {
        hasInlineOrganizationIdUnique = true;
      }

      tables.set(name, { name, hasOrganizationIdColumn, hasInlineOrganizationIdUnique });
      if (hasInlineOrganizationIdUnique) {
        tablesWithOrgIdIndex.add(name);
      }
      continue;
    }

    const rlsMatch = /^alter table (\w+) enable row level security$/im.exec(statement);
    if (rlsMatch) {
      rlsEnabledTables.add(rlsMatch[1]);
      continue;
    }

    const policyMatch = /^create policy \w+ on (\w+)/im.exec(statement);
    if (policyMatch) {
      tablesWithPolicies.add(policyMatch[1]);
      continue;
    }

    const indexMatch = /^create(?: unique)? index \S+\s+on (\w+)\s*([\s\S]*)$/im.exec(statement);
    if (indexMatch) {
      const [, table, rest] = indexMatch;
      const column = leadingColumn(rest);
      if (column === "organization_id") {
        tablesWithOrgIdIndex.add(table);
      }
      continue;
    }

    // Supabase's project template grants ALL privileges to `authenticated`
    // by default on every new public-schema table (confirmed live, see
    // 20260719130006's header comment) — a plain `revoke all on <table>
    // from anon, public;` does NOT touch that default, so a subsequent
    // narrower `grant select, ... to authenticated` only *adds* to the
    // untouched default instead of replacing it. Every table's revoke
    // statement must explicitly name `authenticated`.
    const revokeMatch = /^revoke all on (\w+) from ([\s\S]*)$/im.exec(statement);
    if (revokeMatch) {
      const [, table, roleList] = revokeMatch;
      if (/\bauthenticated\b/i.test(roleList)) {
        tablesWithAuthenticatedRevoke.add(table);
      }
      continue;
    }
  }

  return {
    tables,
    rlsEnabledTables,
    tablesWithPolicies,
    tablesWithOrgIdIndex,
    tablesWithAuthenticatedRevoke,
  };
}

describe("supabase/migrations schema coverage", () => {
  const sql = readAllMigrationSql();
  const {
    tables,
    rlsEnabledTables,
    tablesWithPolicies,
    tablesWithOrgIdIndex,
    tablesWithAuthenticatedRevoke,
  } = parseSchema(sql);

  it("found the expected 62 tables from the domain model", () => {
    // A change to this count is not itself wrong — it's a prompt to
    // confirm the new/removed table was intentional and update this
    // expectation deliberately, not silently drift. 17 (Phase 4) + 2
    // (Phase 5: member_import_batches, member_import_rows) + 2
    // (Phase 6: knowledge_documents, document_versions) + 2
    // (Phase 7: processes, process_versions) + 1 (Phase 8: background_jobs)
    // + 4 (Phase 8: workflows, tasks, workflow_history, task_history)
    // + 5 (Phase 9: forms, form_versions, form_submissions, evidence,
    // evidence_events) + 7 (Phase 10: approval_policies,
    // approval_decisions, business_calendars, business_calendar_holidays,
    // sla_definitions, escalation_rules, escalation_events) + 15
    // (Phase 11: exceptions, exception_comments, exception_links,
    // exception_history, exception_containment_actions,
    // root_cause_analyses, root_cause_factors, capa_plans, capa_actions,
    // capa_approvals, capa_effectiveness_checks, temporary_waivers,
    // waiver_approvals, waiver_renewals, recurrence_matches) + 5
    // (Phase 12: training_courses, training_course_versions,
    // training_assignments, training_assignment_history,
    // certifications) + 2 (Phase 13: ai_drafts, ai_usage_events) + 3
    // (Phase 16: notifications, notification_deliveries,
    // notification_preferences) + 2 (Phase 17: subscriptions,
    // billing_webhook_events). Phase 14 and Phase 15 added no new
    // tables (Phase 15 added a column to the existing audit_events).
    expect(tables.size).toBe(67);
  });

  it("enables Row-Level Security on every table", () => {
    const missing = [...tables.keys()].filter((name) => !rlsEnabledTables.has(name));
    expect(missing, `tables missing "enable row level security": ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it.each([...tables.keys()])(
    "%s: explicitly revokes default privileges from authenticated before re-granting",
    (tableName) => {
      // Regression test for a live-verified finding: Supabase's project
      // template grants ALL privileges to `authenticated` by default on
      // every new table, so a table-specific `grant select, ... to
      // authenticated` alone (without first revoking) leaves the far
      // broader default grant in place underneath it. See
      // 20260719130006_fix_authenticated_default_privileges.sql.
      expect(tablesWithAuthenticatedRevoke.has(tableName)).toBe(true);
    },
  );

  const tenantOwnedTables = [...tables.values()].filter((table) => table.hasOrganizationIdColumn);

  it("has at least one tenant-owned (organization_id) table to check", () => {
    expect(tenantOwnedTables.length).toBeGreaterThan(0);
  });

  it.each(tenantOwnedTables.map((table) => table.name))(
    "%s: has at least one RLS policy",
    (tableName) => {
      expect(tablesWithPolicies.has(tableName)).toBe(true);
    },
  );

  it.each(tenantOwnedTables.map((table) => table.name))(
    "%s: has an index (or unique constraint) covering organization_id",
    (tableName) => {
      expect(tablesWithOrgIdIndex.has(tableName)).toBe(true);
    },
  );
});

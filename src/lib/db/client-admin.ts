import "server-only";
import postgres from "postgres";

/**
 * Service-role (BYPASSRLS) database access. SUPABASE_DB_URL authenticates
 * as Supabase's `postgres` superuser, so every query through this client
 * bypasses Row-Level Security entirely — used only by code that must run
 * outside any single organization's context (Clerk webhook identity
 * sync, the dev seed script) and that enforces its own, narrow
 * organization scoping in application code, per
 * docs/architecture/multi-tenancy.md principle 5.
 *
 * Never import this from a "use client" component or anything reachable
 * from the browser — there is no build-time enforcement beyond this
 * comment plus the schema-coverage test's client-boundary check
 * (src/lib/db/schema-coverage.test.ts), so treat any import of this file
 * outside src/app/api/webhooks/ or scripts/ as a review flag.
 */
let adminSql: postgres.Sql | undefined;

export function getAdminSql(): postgres.Sql {
  if (!adminSql) {
    adminSql = postgres(requireDbUrl(), { max: 5 });
  }
  return adminSql;
}

function requireDbUrl(): string {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error(
      "SUPABASE_DB_URL is not set — see docs/development/supabase-setup.md for how to provision it.",
    );
  }
  return url;
}

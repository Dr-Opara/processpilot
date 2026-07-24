import postgres from "postgres";

/**
 * Used only by *.integration.test.ts (see vitest.integration.config.ts).
 * Deliberately not `import "server-only"` — integration tests import it
 * directly, and it must never be imported by application code (app code
 * uses tenant-context.ts / client-admin.ts instead).
 *
 * Returns null instead of throwing when SUPABASE_DB_URL is unset, so
 * integration tests can skip themselves gracefully (matching the pattern
 * already used for e2e/global-setup.ts's Clerk credential check) rather
 * than failing CI before a Supabase project exists.
 */
export function getTestSql(): postgres.Sql | null {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) return null;
  // prepare: false — see tenant-context.ts's getPool() for why.
  return postgres(url, { max: 5, prepare: false });
}

export interface TestClaims {
  clerkUserId: string;
  organizationId: string;
  memberId: string;
}

/**
 * The integration-test equivalent of tenant-context.ts's
 * withTenantContext() — takes an explicit, test-fabricated member_id
 * (including deliberately wrong/nonexistent ones) instead of resolving it
 * from a real Clerk session, so tests can directly prove what RLS does
 * and doesn't allow. Only identity claims are set (sub/org_id/member_id)
 * — RLS re-derives active status and permissions from the database
 * itself (see supabase/migrations/20260719130002_...'s current_org_id()),
 * so a test claiming a nonexistent or suspended member_id is correctly
 * denied regardless of what it claims about itself.
 */
export async function withTestClaims<T>(
  sql: postgres.Sql,
  claims: TestClaims,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const jwtClaims = {
    sub: claims.clerkUserId,
    org_id: claims.organizationId,
    member_id: claims.memberId,
  };

  // See tenant-context.ts's withTenantContext() for why this cast is exact.
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(jwtClaims)}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

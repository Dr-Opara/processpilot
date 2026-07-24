import "server-only";
import postgres from "postgres";

/**
 * The only way request-scoped (non-admin) code reaches Postgres. The
 * pooled connection below is module-private on purpose — there is no
 * exported "give me a raw authenticated connection" function, so the
 * only way to run a tenant-scoped query anywhere in the app is through
 * withTenantContext(), which always sets the RLS session claims first.
 * See docs/architecture/multi-tenancy.md and
 * docs/architecture/clerk-supabase-identity-sync.md for the full model.
 */
let pool: postgres.Sql | undefined;

function getPool(): postgres.Sql {
  if (!pool) {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
      throw new Error(
        "SUPABASE_DB_URL is not set — see docs/development/supabase-setup.md for how to provision it.",
      );
    }
    // prepare: false — SUPABASE_DB_URL is expected to be a Supabase pooler
    // connection (session or transaction mode; see .env.example), and
    // transaction-mode pooling (Supavisor/PgBouncer) silently breaks
    // postgres.js's default prepared-statement caching, since a prepared
    // statement can end up issued against a different backend connection
    // than the one that prepared it. Disabling it costs a little
    // performance and works correctly under either pooling mode, so it's
    // the safe default rather than something to toggle per environment.
    pool = postgres(url, { max: 10, prepare: false });
  }
  return pool;
}

export interface TenantContext {
  /** organizations.id — the caller's active organization. */
  organizationId: string;
  /** organization_members.id — the caller's membership row in that organization. */
  memberId: string;
  /** Clerk's user id, exposed to policies as current_clerk_user_id(). */
  clerkUserId: string;
}

/**
 * Opens a transaction, sets the standard Supabase `request.jwt.claims`
 * GUC for that transaction only (SET LOCAL — safe under transaction-mode
 * pooling), switches to the low-privilege `authenticated` Postgres role
 * for the duration of the transaction, then runs `fn`.
 *
 * The claims deliberately carry only identity (sub/org_id/member_id), not
 * status or permissions — RLS policies re-derive both independently from
 * organization_members/member_role_assignments on every check (see
 * supabase/migrations/20260719130002_membership_roles_permissions.sql's
 * current_org_id()/current_member_permissions()), rather than trusting
 * this object's caller to have gotten them right. That's deliberate
 * defense-in-depth: a bug here (stale membership, wrong id) still can't
 * grant access RLS wouldn't independently verify.
 */
export async function withTenantContext<T>(
  context: TenantContext,
  fn: (sql: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const claims = {
    sub: context.clerkUserId,
    org_id: context.organizationId,
    member_id: context.memberId,
  };

  // postgres.js's begin<T>() return type is Promise<UnwrapPromiseArray<T>>,
  // which TS can't statically prove equals Promise<T> for a generic T (it
  // only differs when T is itself an array of promises, which fn never
  // returns here) — the cast is exact, not a type-safety compromise.
  return getPool().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

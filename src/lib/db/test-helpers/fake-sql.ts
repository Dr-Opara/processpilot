import type postgres from "postgres";

/**
 * A minimal fake postgres.js tagged-template client for unit tests that
 * exercise SQL-tag call sites (identity-sync.ts, the webhook route)
 * without opening a real connection. Not a SQL engine — handlers match
 * the rendered query text and return canned rows, so these tests prove
 * call sequencing/idempotency logic, not actual SQL correctness (that's
 * schema-coverage.test.ts's job statically, and the live-DB
 * *.integration.test.ts files' job for real).
 */
export interface FakeQueryHandler {
  match: (queryText: string) => boolean;
  respond: (values: unknown[]) => unknown[];
}

export interface FakeSqlCall {
  text: string;
  values: unknown[];
}

export type FakeSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  json: (value: unknown) => unknown;
  begin: <T>(fn: (tx: FakeSql) => Promise<T>) => Promise<T>;
  calls: FakeSqlCall[];
};

export function createFakeSql(handlers: FakeQueryHandler[]): FakeSql {
  const calls: FakeSqlCall[] = [];

  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ? ").replace(/\s+/g, " ").trim();
    calls.push({ text, values });
    const handler = handlers.find((candidate) => candidate.match(text));
    return Promise.resolve(handler ? handler.respond(values) : []);
  }) as FakeSql;

  tag.json = (value: unknown) => value;
  tag.begin = async <T>(fn: (tx: FakeSql) => Promise<T>) => fn(tag);
  tag.calls = calls;

  return tag;
}

/**
 * FakeSql implements the same runtime contract (tagged-template call,
 * .json(), .begin()) that identity-sync.ts/audit.ts/the webhook route
 * actually use, but doesn't structurally satisfy postgres.js's full
 * `Sql`/`TransactionSql` interfaces (CLOSE, END, PostgresError, options,
 * etc. — dozens of properties no test needs to stub). This cast is the
 * one place that bridges the two, kept narrow and test-only.
 */
export function asSql(fake: FakeSql): postgres.Sql {
  return fake as unknown as postgres.Sql;
}

/** Same bridge as asSql(), for call sites (withTenantContext callbacks) typed against postgres.TransactionSql instead of postgres.Sql. */
export function asTransactionSql(fake: FakeSql): postgres.TransactionSql {
  return fake as unknown as postgres.TransactionSql;
}

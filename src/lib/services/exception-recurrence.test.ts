import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { findRecurrenceMatches } from "./exception-recurrence";
import type { ExceptionRow } from "@/lib/db/database.types";

function exception(
  overrides: Partial<ExceptionRow> = {},
): Pick<
  ExceptionRow,
  | "id"
  | "organization_id"
  | "exception_type"
  | "process_id"
  | "department_id"
  | "location_id"
  | "title"
  | "tags"
> {
  return {
    id: "exc-new",
    organization_id: "org-1",
    exception_type: "missed_sla",
    process_id: "process-1",
    department_id: "dept-1",
    location_id: null,
    title: "Late shipment to customer",
    tags: ["logistics"],
    ...overrides,
  };
}

describe("findRecurrenceMatches", () => {
  it("logs a match when a candidate shares the same process", async () => {
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("select id, exception_type"),
        respond: () => [
          {
            id: "exc-old",
            exception_type: "task_failure",
            process_id: "process-1",
            department_id: "dept-2",
            location_id: null,
            title: "Unrelated",
            tags: [],
          },
        ],
      },
      { match: (t) => t.includes("insert into recurrence_matches"), respond: () => [] },
    ];
    const fakeSql = createFakeSql(handlers);

    await findRecurrenceMatches(asTransactionSql(fakeSql), exception());

    expect(fakeSql.calls.some((c) => c.text.includes("insert into recurrence_matches"))).toBe(true);
  });

  it("does not log a match when nothing overlaps", async () => {
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("select id, exception_type"),
        respond: () => [
          {
            id: "exc-old",
            exception_type: "task_failure",
            process_id: "process-2",
            department_id: "dept-2",
            location_id: "loc-2",
            title: "Completely different",
            tags: [],
          },
        ],
      },
    ];
    const fakeSql = createFakeSql(handlers);

    await findRecurrenceMatches(asTransactionSql(fakeSql), exception());

    expect(fakeSql.calls.some((c) => c.text.includes("insert into recurrence_matches"))).toBe(
      false,
    );
  });
});

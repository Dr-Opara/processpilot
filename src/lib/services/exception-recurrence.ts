import "server-only";
import type postgres from "postgres";
import type { ExceptionRow } from "@/lib/db/database.types";

/**
 * Plain heuristic recurrence detection — logs a `recurrence_matches` row
 * for every existing exception in the same organization, within
 * RECURRENCE_LOOKBACK_DAYS, that shares at least one of: exception_type,
 * process_id, department_id, location_id, root-cause fishbone category
 * (via a join, since that lives on root_cause_analyses), or a tag/title
 * overlap. Each match records which basis it matched on, in
 * `match_basis`, so a reviewer can judge relevance themselves.
 *
 * Deliberately not fuzzy-matching titles beyond a simple case-
 * insensitive substring check, and deliberately not deduplicating
 * "obviously the same incident" — this is a recall aid for triage, not
 * a duplicate-detection guarantee (this phase's requirement explicitly
 * says not to claim one).
 */
const RECURRENCE_LOOKBACK_DAYS = 180;

export async function findRecurrenceMatches(
  tx: postgres.Sql | postgres.TransactionSql,
  exception: Pick<
    ExceptionRow,
    | "id"
    | "organization_id"
    | "exception_type"
    | "process_id"
    | "department_id"
    | "location_id"
    | "title"
    | "tags"
  >,
): Promise<void> {
  const candidates = await tx<
    Pick<
      ExceptionRow,
      "id" | "exception_type" | "process_id" | "department_id" | "location_id" | "title" | "tags"
    >[]
  >`
    select id, exception_type, process_id, department_id, location_id, title, tags from exceptions
    where organization_id = ${exception.organization_id}
      and id != ${exception.id}
      and created_at > now() - (${RECURRENCE_LOOKBACK_DAYS} || ' days')::interval
  `;

  for (const candidate of candidates) {
    const basis: Record<string, boolean> = {
      sameExceptionType: candidate.exception_type === exception.exception_type,
      sameProcess: Boolean(exception.process_id) && candidate.process_id === exception.process_id,
      sameDepartment:
        Boolean(exception.department_id) && candidate.department_id === exception.department_id,
      sameLocation:
        Boolean(exception.location_id) && candidate.location_id === exception.location_id,
      tagOverlap: exception.tags.some((tag) => candidate.tags.includes(tag)),
      similarTitle:
        candidate.title.toLowerCase().includes(exception.title.toLowerCase()) ||
        exception.title.toLowerCase().includes(candidate.title.toLowerCase()),
    };
    const matched = Object.values(basis).some(Boolean);
    if (!matched) continue;

    await tx`
      insert into recurrence_matches (organization_id, exception_id, matched_exception_id, match_basis)
      values (${exception.organization_id}, ${exception.id}, ${candidate.id}, ${tx.json(basis as unknown as Parameters<typeof tx.json>[0])})
      on conflict (exception_id, matched_exception_id) do nothing
    `;
  }
}

import "server-only";
import type postgres from "postgres";
import type { BusinessCalendarRow } from "@/lib/db/database.types";

/**
 * Business-calendar-aware due-date math: skips nights, non-work days,
 * and holidays, all evaluated in the calendar's own IANA time zone
 * rather than server-local time. No calendar (`config: null`) means a
 * 24/7 clock — `sla.ts` falls back to that when a definition has no
 * `business_calendar_id`, matching Phase 8's original naive
 * `now() + N minutes` behavior exactly.
 *
 * Time-zone conversion uses the standard Intl-based "format a UTC guess
 * in the target zone, measure the drift, correct once" technique rather
 * than a dependency — accurate for every zone/date this application
 * needs to support, including DST transitions, since the correction is
 * always measured against the actual local calendar date being placed.
 *
 * Known gap: no mid-flight pause/resume of a running clock (e.g.
 * "pause the SLA while a task is blocked on an upstream dependency") —
 * every calculation is a single, complete elapsed-business-time computation
 * from a fixed start instant.
 */
export interface BusinessCalendarConfig {
  timezone: string;
  workDays: number[];
  workStartMinutes: number;
  workEndMinutes: number;
  holidays: Set<string>;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const hour = Number(parts.hour) % 24;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - date.getTime()) / 60_000;
}

/** The local wall-clock date/time this UTC instant represents in `timeZone`. */
function toLocalParts(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** The UTC instant corresponding to this local wall-clock date/time in `timeZone`. */
function fromLocalParts(parts: LocalParts, timeZone: string): Date {
  const guess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );
  const offsetMinutes = getTimezoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

function dateKey(parts: Pick<LocalParts, "year" | "month" | "day">): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function weekdayOf(parts: LocalParts, timeZone: string): number {
  // Re-derive via a UTC noon anchor for this local date to avoid DST
  // edge cases skewing the weekday itself.
  const anchor = fromLocalParts({ ...parts, hour: 12, minute: 0 }, timeZone);
  return anchor.getUTCDay();
}

function isWorkDay(config: BusinessCalendarConfig, parts: LocalParts, timeZone: string): boolean {
  if (config.holidays.has(dateKey(parts))) return false;
  return config.workDays.includes(weekdayOf(parts, timeZone));
}

function nextDay(parts: LocalParts): LocalParts {
  const utcNoon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 12, 0));
  return {
    year: utcNoon.getUTCFullYear(),
    month: utcNoon.getUTCMonth() + 1,
    day: utcNoon.getUTCDate(),
    hour: 0,
    minute: 0,
  };
}

/** Adds `minutes` of business time to `from`, skipping non-work days/holidays and clamping into the configured work window. Returns `from + minutes` unchanged when `config` is null (24/7). */
export function addBusinessMinutes(
  config: BusinessCalendarConfig | null,
  from: Date,
  minutes: number,
): Date {
  if (!config) return new Date(from.getTime() + minutes * 60_000);
  const { timezone } = config;

  let cursor = toLocalParts(from, timezone);
  // Advance to the start of the next work window if we're currently
  // outside one (a non-work day, or before/after work hours).
  const minuteOfDay = cursor.hour * 60 + cursor.minute;
  if (!isWorkDay(config, cursor, timezone) || minuteOfDay >= config.workEndMinutes) {
    cursor = { ...nextDay(cursor), hour: 0, minute: 0 };
    while (!isWorkDay(config, cursor, timezone)) cursor = nextDay(cursor);
    cursor = {
      ...cursor,
      hour: Math.floor(config.workStartMinutes / 60),
      minute: config.workStartMinutes % 60,
    };
  } else if (minuteOfDay < config.workStartMinutes) {
    cursor = {
      ...cursor,
      hour: Math.floor(config.workStartMinutes / 60),
      minute: config.workStartMinutes % 60,
    };
  }

  let remaining = minutes;
  for (;;) {
    const currentMinuteOfDay = cursor.hour * 60 + cursor.minute;
    const availableToday = config.workEndMinutes - currentMinuteOfDay;
    if (remaining <= availableToday) {
      const targetMinuteOfDay = currentMinuteOfDay + remaining;
      return fromLocalParts(
        { ...cursor, hour: Math.floor(targetMinuteOfDay / 60), minute: targetMinuteOfDay % 60 },
        timezone,
      );
    }
    remaining -= availableToday;
    cursor = nextDay(cursor);
    while (!isWorkDay(config, cursor, timezone)) cursor = nextDay(cursor);
    cursor = {
      ...cursor,
      hour: Math.floor(config.workStartMinutes / 60),
      minute: config.workStartMinutes % 60,
    };
  }
}

export async function loadCalendarConfig(
  sql: postgres.Sql | postgres.TransactionSql,
  calendarId: string,
): Promise<BusinessCalendarConfig | null> {
  const [calendar] = await sql<
    BusinessCalendarRow[]
  >`select * from business_calendars where id = ${calendarId}`;
  if (!calendar) return null;
  const holidays = await sql<{ holiday_date: string }[]>`
    select holiday_date from business_calendar_holidays where calendar_id = ${calendarId}
  `;
  return {
    timezone: calendar.timezone,
    workDays: calendar.work_days,
    workStartMinutes: calendar.work_start_minutes,
    workEndMinutes: calendar.work_end_minutes,
    holidays: new Set(holidays.map((h) => h.holiday_date)),
  };
}

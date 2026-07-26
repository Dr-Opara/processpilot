import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { addBusinessMinutes, type BusinessCalendarConfig } from "./business-calendar";

const utc247: BusinessCalendarConfig | null = null;

const weekdayNineToFive: BusinessCalendarConfig = {
  timezone: "UTC",
  workDays: [1, 2, 3, 4, 5],
  workStartMinutes: 9 * 60,
  workEndMinutes: 17 * 60,
  holidays: new Set(),
};

describe("addBusinessMinutes — no calendar (24/7)", () => {
  it("adds minutes verbatim regardless of day/time", () => {
    const from = new Date("2026-07-25T23:30:00Z"); // a Saturday night
    const result = addBusinessMinutes(utc247, from, 90);
    expect(result.toISOString()).toBe("2026-07-26T01:00:00.000Z");
  });
});

describe("addBusinessMinutes — weekday 9-5 UTC calendar", () => {
  it("stays within the same work day when there's enough room left", () => {
    // Monday 2026-07-27 10:00 UTC + 60 minutes -> 11:00 same day.
    const from = new Date("2026-07-27T10:00:00Z");
    const result = addBusinessMinutes(weekdayNineToFive, from, 60);
    expect(result.toISOString()).toBe("2026-07-27T11:00:00.000Z");
  });

  it("rolls over to the next work day when the addition exceeds today's remaining window", () => {
    // Monday 16:00 + 2 hours: only 1 hour left today (to 17:00), so 1
    // more hour lands at Tuesday 09:00 + 1h = 10:00.
    const from = new Date("2026-07-27T16:00:00Z");
    const result = addBusinessMinutes(weekdayNineToFive, from, 120);
    expect(result.toISOString()).toBe("2026-07-28T10:00:00.000Z");
  });

  it("skips the weekend entirely", () => {
    // Friday 2026-07-31 16:00 UTC + 2 hours -> 1 hour left Friday, then
    // 1 more hour on Monday 2026-08-03 starting 09:00 -> 10:00.
    const from = new Date("2026-07-31T16:00:00Z");
    const result = addBusinessMinutes(weekdayNineToFive, from, 120);
    expect(result.toISOString()).toBe("2026-08-03T10:00:00.000Z");
  });

  it("starting outside work hours snaps forward to the next work window first", () => {
    // Monday 2026-07-27 20:00 UTC (after hours) + 30 minutes -> Tuesday 09:30.
    const from = new Date("2026-07-27T20:00:00Z");
    const result = addBusinessMinutes(weekdayNineToFive, from, 30);
    expect(result.toISOString()).toBe("2026-07-28T09:30:00.000Z");
  });

  it("starting before work hours snaps forward to this same day's work start", () => {
    // Monday 2026-07-27 06:00 UTC (before hours) + 30 minutes -> 09:30 same day.
    const from = new Date("2026-07-27T06:00:00Z");
    const result = addBusinessMinutes(weekdayNineToFive, from, 30);
    expect(result.toISOString()).toBe("2026-07-27T09:30:00.000Z");
  });

  it("starting on a Saturday snaps forward to Monday's work start", () => {
    const from = new Date("2026-08-01T12:00:00Z"); // Saturday
    const result = addBusinessMinutes(weekdayNineToFive, from, 60);
    expect(result.toISOString()).toBe("2026-08-03T10:00:00.000Z");
  });

  it("skips a configured holiday", () => {
    const withHoliday: BusinessCalendarConfig = {
      ...weekdayNineToFive,
      holidays: new Set(["2026-07-28"]), // Tuesday
    };
    // Monday 16:00 + 2 hours: 1 hour left Monday, Tuesday is a holiday,
    // so the remaining 1 hour lands Wednesday 09:00 -> 10:00.
    const from = new Date("2026-07-27T16:00:00Z");
    const result = addBusinessMinutes(withHoliday, from, 120);
    expect(result.toISOString()).toBe("2026-07-29T10:00:00.000Z");
  });

  it("spans multiple full work days for a large minute count", () => {
    // Monday 09:00 + exactly 3 full 8h work days (1440 minutes) lands at
    // the end of the 3rd business day: Wednesday 17:00.
    const from = new Date("2026-07-27T09:00:00Z");
    const result = addBusinessMinutes(weekdayNineToFive, from, 3 * 8 * 60);
    expect(result.toISOString()).toBe("2026-07-29T17:00:00.000Z");
  });
});

describe("addBusinessMinutes — non-UTC time zone", () => {
  const nyNineToFive: BusinessCalendarConfig = {
    timezone: "America/New_York",
    workDays: [1, 2, 3, 4, 5],
    workStartMinutes: 9 * 60,
    workEndMinutes: 17 * 60,
    holidays: new Set(),
  };

  it("evaluates work hours in the calendar's own zone, not UTC", () => {
    // Monday 2026-07-27 13:00 UTC = 09:00 America/New_York (EDT, UTC-4)
    // — right at work start — + 60 minutes -> 10:00 local = 14:00 UTC.
    const from = new Date("2026-07-27T13:00:00Z");
    const result = addBusinessMinutes(nyNineToFive, from, 60);
    expect(result.toISOString()).toBe("2026-07-27T14:00:00.000Z");
  });
});

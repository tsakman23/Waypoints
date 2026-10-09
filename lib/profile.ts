import type { Profile } from "./types.ts";

/** Defaults for a new profile; the setup wizard starts from these. */
export const DEFAULT_PROFILE: Profile = {
  weekday_minutes: 60,
  weekend_minutes: 120,
  session_minutes: 60,
  weekend_days: [0, 6],
  timezone: "UTC",
  animate_orbits: true,
  last_check_in: null,
};

/** How many whole sessions fit in a day's minutes (at least one if any time is set). */
export function sessionsIn(minutes: number, sessionMinutes: number): number {
  if (minutes <= 0) return 0;
  return Math.max(1, Math.floor(minutes / sessionMinutes));
}

/** A calendar day as the user sees it: "2026-10-09" and 0 (Sun) ... 6 (Sat). */
export type LocalDay = { date: string; weekday: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Which calendar day `moment` falls on in `timeZone`. The server runs in UTC,
 * so "today" must always be worked out in the user's zone: at 23:30 in Tokyo
 * it's still the morning before in UTC.
 */
export function localDay(moment: Date, timeZone: string): LocalDay {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(moment);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/** The day before a `YYYY-MM-DD` date, as a `YYYY-MM-DD` date. */
export function previousDay(date: string): string {
  // Noon UTC keeps the arithmetic clear of any daylight-saving edge.
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** How many sessions the user has on a given weekday. */
export function sessionsOn(profile: Profile, weekday: number): number {
  const minutes = profile.weekend_days.includes(weekday) ? profile.weekend_minutes : profile.weekday_minutes;
  return sessionsIn(minutes, profile.session_minutes);
}

/** Whether a timezone name is one this runtime recognises, e.g. "Europe/London". */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

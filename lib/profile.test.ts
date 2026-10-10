import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE, isValidTimeZone, localDay, previousDay, sessionsIn, sessionsOn, yesterdayIn } from "./profile.ts";

test("minutes become whole sessions, with at least one when any time is set", () => {
  assert.equal(sessionsIn(120, 60), 2);
  assert.equal(sessionsIn(150, 60), 2);
  assert.equal(sessionsIn(30, 60), 1);
  assert.equal(sessionsIn(0, 60), 0);
});

test("the same moment can be different days in different timezones", () => {
  // 23:30 UTC on Friday 9 October 2026.
  const moment = new Date("2026-10-09T23:30:00Z");
  assert.deepEqual(localDay(moment, "UTC"), { date: "2026-10-09", weekday: 5 });
  assert.deepEqual(localDay(moment, "Asia/Tokyo"), { date: "2026-10-10", weekday: 6 });
  assert.deepEqual(localDay(moment, "America/Los_Angeles"), { date: "2026-10-09", weekday: 5 });
});

test("previous day crosses month and year boundaries", () => {
  assert.equal(previousDay("2026-10-09"), "2026-10-08");
  assert.equal(previousDay("2026-03-01"), "2026-02-28");
  assert.equal(previousDay("2027-01-01"), "2026-12-31");
});

test("weekend days get the weekend budget", () => {
  const profile = { ...DEFAULT_PROFILE, weekday_minutes: 60, weekend_minutes: 180 };
  assert.equal(sessionsOn(profile, 3), 1); // Wednesday
  assert.equal(sessionsOn(profile, 6), 3); // Saturday
  // A Friday-Saturday weekend.
  assert.equal(sessionsOn({ ...profile, weekend_days: [5, 6] }, 0), 1); // Sunday is a weekday
});

test("recognises real timezone names only", () => {
  assert.equal(isValidTimeZone("Europe/London"), true);
  assert.equal(isValidTimeZone("Mars/Olympus_Mons"), false);
});

test("yesterday depends on the user's timezone", () => {
  // 23:30 UTC on Friday 9 October: already Saturday in Tokyo.
  const moment = new Date("2026-10-09T23:30:00Z");
  assert.equal(yesterdayIn("UTC", moment), "2026-10-08");
  assert.equal(yesterdayIn("Asia/Tokyo", moment), "2026-10-09");
});

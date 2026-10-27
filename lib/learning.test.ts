import { test } from "node:test";
import assert from "node:assert/strict";
import { LEARN, learnIntervals, learnPreferences, preferenceOf, type LearningInput } from "./learning.ts";
import { addDays } from "./profile.ts";
import type { Category, Item, PlanSnapshot, SkillType, WorkLog } from "./types.ts";

const today = "2026-10-27";

const cat = (id: string, skill_type: SkillType = "other", resurface_days: number | null = null): Category => ({
  id, name: id, color: "#888888", skill_type, resurface_days,
});

const item = (id: string, category_id: string | null): Item => ({
  id, title: id, notes: "", category_id, status: "active", interest: 3, impact: 3, effort: 3,
});

/**
 * `days` answered days ending yesterday, each planning `planned` (item ids in
 * category order given by `categoryOf`) and logging whichever of `done(i)`
 * returns for day i.
 */
function history(
  days: number,
  planned: string[],
  done: (day: number) => string[],
  categoryOf: (id: string) => string | null = () => "A",
): { snapshots: PlanSnapshot[]; workLogs: WorkLog[] } {
  const snapshots: PlanSnapshot[] = [];
  const workLogs: WorkLog[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, -(days - i));
    snapshots.push({ day, answered: true, sessions: planned.map((id) => ({ item_id: id, category_id: categoryOf(id) })) });
    for (const id of done(i)) workLogs.push({ item_id: id, day });
  }
  return { snapshots, workLogs };
}

function input(parts: Partial<LearningInput>): LearningInput {
  return { items: [], categories: [], workLogs: [], snapshots: [], today, ...parts };
}

// Follow-through ------------------------------------------------------------------

test("with no history, every multiplier is exactly 1", () => {
  const items = [item("piano", "A"), item("run", "B")];
  const prefs = learnPreferences(input({ items }));
  assert.equal(prefs.overall, 0.5);
  for (const i of items) {
    assert.deepEqual(preferenceOf(prefs, i), { probability: 0.5, multiplier: 1, evidence: "none" });
  }
});

test("a skipped item drops below 1, a done one rises above it", () => {
  const items = [item("piano", "A"), item("run", "A")];
  // Piano planned and skipped every day; running planned and done every day.
  const { snapshots, workLogs } = history(10, ["piano", "run"], () => ["run"]);
  const prefs = learnPreferences(input({ items, snapshots, workLogs }));
  assert.ok(preferenceOf(prefs, items[0]).multiplier < 1);
  assert.ok(preferenceOf(prefs, items[1]).multiplier > 1);
});

test("a little evidence moves the multiplier less than a lot (shrinkage)", () => {
  const items = [item("piano", "A"), item("run", "B")];
  // Running is always done, piano always skipped, so the overall rate stays near a half.
  const after = (days: number) => {
    const { snapshots, workLogs } = history(days, ["piano", "run"], () => ["run"], (id) => (id === "piano" ? "A" : "B"));
    return preferenceOf(learnPreferences(input({ items, snapshots, workLogs })), items[0]).multiplier;
  };
  const twoDays = after(2);
  const twentyDays = after(20);
  assert.ok(twoDays < 1, `2 days: ${twoDays}`);
  assert.ok(twentyDays < twoDays, `20 days (${twentyDays}) should move further than 2 (${twoDays})`);
  // Two skips, overall rate 0.5, 4 pretend days: (0 + 4 × 0.5) / (2 + 4) = 1/3,
  // and 1/3 ÷ 0.5 = 2/3. A nudge, counted once, not a verdict.
  assert.ok(Math.abs(twoDays - 2 / 3) < 1e-9, `2 days: ${twoDays}`);
});

test("the multiplier stays within its caps, however extreme the history", () => {
  const items = [item("always", "A"), item("never", "B"), item("filler", "C")];
  const { snapshots, workLogs } = history(
    80,
    ["always", "never", "filler", "filler"],
    () => ["always"],
    (id) => ({ always: "A", never: "B", filler: "C" })[id] ?? null,
  );
  const prefs = learnPreferences(input({ items, snapshots, workLogs }));
  assert.equal(preferenceOf(prefs, items[0]).multiplier, LEARN.maxPreference);
  assert.equal(preferenceOf(prefs, items[1]).multiplier, LEARN.minPreference);
});

test("a new item inherits its category's evidence", () => {
  const items = [item("scales", "music"), item("pieces", "music"), item("run", "fitness"), item("new song", "music")];
  // Music is planned every day and always skipped; fitness always done.
  const { snapshots, workLogs } = history(15, ["scales", "pieces", "run"], () => ["run"], (id) =>
    id === "run" ? "fitness" : "music",
  );
  const prefs = learnPreferences(input({ items, snapshots, workLogs }));
  const fresh = preferenceOf(prefs, items[3]);
  assert.equal(fresh.evidence, "category");
  assert.ok(fresh.multiplier < 1, `new music item: ${fresh.multiplier}`);
});

test("done without being planned counts in its favour", () => {
  const items = [item("planned", "A"), item("spontaneous", "B")];
  const { snapshots, workLogs } = history(10, ["planned"], () => ["planned", "spontaneous"], () => "A");
  const prefs = learnPreferences(input({ items, snapshots, workLogs }));
  assert.deepEqual(prefs.items.get("spontaneous"), { hits: 10, misses: 0 });
});

test("only answered days in the window count", () => {
  const items = [item("piano", "A")];
  const { snapshots } = history(5, ["piano"], () => []);
  const unanswered = snapshots.map((s) => ({ ...s, answered: false }));
  const old: PlanSnapshot = { day: addDays(today, -(LEARN.preferenceWindowDays + 1)), answered: true, sessions: [{ item_id: "piano", category_id: "A" }] };
  const todays: PlanSnapshot = { day: today, answered: true, sessions: [{ item_id: "piano", category_id: "A" }] };
  const prefs = learnPreferences(input({ items, snapshots: [...unanswered, old, todays] }));
  assert.equal(prefs.items.size, 0);
  assert.equal(preferenceOf(prefs, items[0]).multiplier, 1);
});

test("deleted items are ignored", () => {
  const { snapshots, workLogs } = history(5, ["gone"], () => ["gone"]);
  const prefs = learnPreferences(input({ items: [], snapshots, workLogs }));
  assert.equal(prefs.items.size, 0);
  assert.equal(prefs.overall, 0.5);
});

test("the same history in any order gives the same preferences", () => {
  const items = [item("a", "A"), item("b", "B"), item("c", "A")];
  const { snapshots, workLogs } = history(12, ["a", "b", "c"], (d) => (d % 3 ? ["a"] : ["b", "c"]), (id) =>
    id === "b" ? "B" : "A",
  );
  const forward = learnPreferences(input({ items, snapshots, workLogs }));
  const backward = learnPreferences(input({ items: [...items].reverse(), snapshots: [...snapshots].reverse(), workLogs: [...workLogs].reverse() }));
  for (const i of items) assert.deepEqual(preferenceOf(forward, i), preferenceOf(backward, i));
});

// Intervals ---------------------------------------------------------------------------

/** Work logs for one item on each of the given days ago. */
const logsAgo = (itemId: string, ...daysAgo: number[]): WorkLog[] =>
  daysAgo.map((n) => ({ item_id: itemId, day: addDays(today, -n) }));

test("with no history, an automatic interval is its preset", () => {
  const intervals = learnIntervals(input({ categories: [cat("fit", "fitness")] }));
  assert.deepEqual(intervals.get("fit"), { days: 7, handSet: false, preset: 7, observed: null, weight: 0 });
});

test("an interval set by hand is never changed", () => {
  const categories = [cat("fit", "fitness", 3)];
  const items = [item("run", "fit")];
  const intervals = learnIntervals(input({ categories, items, workLogs: logsAgo("run", 50, 40, 30, 20, 10) }));
  assert.equal(intervals.get("fit")?.days, 3);
  assert.equal(intervals.get("fit")?.handSet, true);
});

test("a learned interval moves towards the real gap as evidence builds", () => {
  const categories = [cat("fit", "fitness")]; // preset 7
  const items = [item("run", "fit")];
  // A run every 10 days: a few gaps, then many.
  const few = learnIntervals(input({ categories, items, workLogs: logsAgo("run", 30, 20, 10) })).get("fit")!;
  const many = learnIntervals(
    input({ categories, items, workLogs: logsAgo("run", ...Array.from({ length: 16 }, (_, i) => 10 * (i + 1))) }),
  ).get("fit")!;
  assert.equal(few.observed, 10);
  assert.ok(few.days > 7 && few.days < many.days && many.days <= 10, `few ${few.days}, many ${many.days}`);
});

test("a learned interval stays within its range around the preset", () => {
  const categories = [cat("fit", "fitness"), cat("keys", "instrument")]; // presets 7 and 42
  const items = [item("run", "fit"), item("piano", "keys")];
  const workLogs = [
    // Running only every 60 days; piano every single day.
    ...logsAgo("run", 180, 120, 60, 0),
    ...logsAgo("piano", ...Array.from({ length: 60 }, (_, i) => i)),
  ];
  const intervals = learnIntervals(input({ categories, items, workLogs }));
  assert.equal(intervals.get("fit")?.days, 7 * LEARN.maxIntervalRatio);
  assert.equal(intervals.get("keys")?.days, 42 * LEARN.minIntervalRatio);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { backtest } from "./backtest.ts";
import { LEARN } from "./learning.ts";
import { addDays } from "./profile.ts";
import type { Category, Item, PlanSnapshot, WorkLog } from "./types.ts";

const categories: Category[] = [
  { id: "A", name: "A", color: "#888888", skill_type: "other", resurface_days: null },
  { id: "B", name: "B", color: "#888888", skill_type: "other", resurface_days: null },
];
const item = (id: string, category_id: string): Item => ({
  id, title: id, notes: "", category_id, status: "active", interest: 3, impact: 3, effort: 3,
});
const items = [item("keen", "A"), item("skipped", "B")];

/** `days` answered days from 1 October, planning both items and logging `done(i)` on day i. */
function history(days: number, done: (day: number) => string[]) {
  const snapshots: PlanSnapshot[] = [];
  const workLogs: WorkLog[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays("2026-10-01", i);
    snapshots.push({
      day,
      answered: true,
      sessions: [{ item_id: "keen", category_id: "A" }, { item_id: "skipped", category_id: "B" }],
    });
    for (const id of done(i)) workLogs.push({ item_id: id, day });
  }
  return { items, categories, snapshots, workLogs };
}

test("too little history gives no score rather than a meaningless one", () => {
  assert.equal(backtest(history(LEARN.backtestMinDays - 1, () => ["keen"])), null);
  assert.notEqual(backtest(history(LEARN.backtestMinDays, () => ["keen"])), null);
});

test("with a real pattern, the model beats the baseline", () => {
  // One item always done, the other always skipped: knowing which is which
  // should predict far better than your overall rate (a half).
  const result = backtest(history(30, () => ["keen"]))!;
  assert.equal(result.predictions.length, 60);
  assert.ok(result.modelScore < result.baselineScore, `model ${result.modelScore}, baseline ${result.baselineScore}`);
});

test("with no pattern between items, the model claims no real gain", () => {
  // Both items are done on the same days (every other day), so knowing which
  // item it is tells you nothing beyond your overall rate. The model must not
  // find an advantage that isn't there.
  const result = backtest(history(30, (i) => (i % 2 ? ["keen", "skipped"] : [])))!;
  assert.ok(result.improvement < 0.02, `improvement ${result.improvement}`);
});

test("predictions never use the future", () => {
  // Flip what happened on the last day: every earlier prediction must stay the same.
  const original = history(20, () => ["keen"]);
  const lastDay = original.snapshots.at(-1)!.day;
  const changed = {
    ...original,
    workLogs: [...original.workLogs.filter((l) => l.day !== lastDay), { item_id: "skipped", day: lastDay }],
  };
  const before = (r: ReturnType<typeof backtest>) => r!.predictions.filter((p) => p.day < lastDay);
  assert.deepEqual(before(backtest(changed)), before(backtest(original)));
});

test("the same history in any order gives the same result", () => {
  const data = history(20, (i) => (i % 3 ? ["keen"] : ["skipped"]));
  const shuffled = {
    ...data,
    snapshots: [...data.snapshots].reverse(),
    workLogs: [...data.workLogs].reverse(),
    items: [...data.items].reverse(),
  };
  assert.deepEqual(backtest(shuffled), backtest(data));
});

test("unanswered days are neither replayed nor learned from", () => {
  const data = history(40, () => ["keen"]);
  const unanswered = { ...data, snapshots: data.snapshots.map((s, i) => (i % 2 ? s : { ...s, answered: false })) };
  assert.equal(backtest(unanswered)?.days, 20);
});

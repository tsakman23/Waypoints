import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTodayOrder, clockFactor, planRoutes, type PlannerInput, type Route } from "./planner.ts";
import { addDays, DEFAULT_PROFILE } from "./profile.ts";
import type { Category, Dependency, Item, PlanSnapshot, Score, Status, WorkLog } from "./types.ts";

// Friday 9 October 2026. The default profile gives 1 session on weekdays and
// 2 on Saturday and Sunday: Fri 1, Sat 2, Sun 2, Mon–Thu 1 each = 9 sessions.
const today = { date: "2026-10-09", weekday: 5 };

const cat = (id: string, resurface_days = 28): Category => ({
  id, name: id, color: "#888888", skill_type: "other", resurface_days,
});

const item = (
  id: string,
  category_id: string | null,
  [interest, impact, effort]: [Score, Score, Score],
  status: Status = "active",
): Item => ({ id, title: id, notes: "", category_id, status, interest, impact, effort });

/** Mark each item as worked on, on the given day. */
const logs = (day: string, ...ids: string[]): WorkLog[] => ids.map((item_id) => ({ item_id, day }));

function plan(
  items: Item[],
  categories: Category[],
  workLogs: WorkLog[] = [],
  dependencies: Dependency[] = [],
  snapshots: PlanSnapshot[] = [],
) {
  const input: PlannerInput = { items, dependencies, categories, workLogs, snapshots, profile: DEFAULT_PROFILE, today };
  return planRoutes(input);
}

/** Every session in a route, in order, as item ids. */
const picks = (route: Route) => route.days.flatMap((d) => d.sessions.map((s) => s.item.id));

test("plans the session budget day by day, starting today", () => {
  const { main } = plan([item("a", "A", [3, 3, 3])], [cat("A")]);
  assert.deepEqual(
    main.days.map((d) => [d.date, d.sessions.length]),
    [
      ["2026-10-09", 1],
      ["2026-10-10", 2],
      ["2026-10-11", 2],
      ["2026-10-12", 1],
      ["2026-10-13", 1],
      ["2026-10-14", 1],
      ["2026-10-15", 1],
    ],
  );
});

test("interests rotate between sessions when scores are close", () => {
  const items = [item("a", "A", [5, 5, 2]), item("b", "B", [5, 5, 2])];
  const { main } = plan(items, [cat("A"), cat("B")], logs("2026-10-08", "a", "b"));
  const order = picks(main);
  for (let i = 1; i < order.length; i++) assert.notEqual(order[i], order[i - 1], `repeat at ${i}`);
});

test("a clearly better item can still repeat its interest", () => {
  const items = [item("great", "A", [5, 5, 1]), item("meh", "B", [1, 1, 5])];
  const { main } = plan(items, [cat("A"), cat("B")], logs("2026-10-08", "great", "meh"));
  assert.deepEqual(picks(main).slice(0, 2), ["great", "great"]);
});

test("a neglected interest comes back on its skill clock", () => {
  // "fresh" scores 6 but was touched yesterday; "stale" scores 4.5 but its
  // 21-day interest has gone 50 days untouched, so its clock doubles it.
  const items = [item("fresh", "A", [4, 2, 1]), item("stale", "B", [5, 4, 2])];
  const { main } = plan(items, [cat("A"), cat("B", 21)], [...logs("2026-10-08", "fresh"), ...logs("2026-08-20", "stale")]);
  const first = main.days[0].sessions[0];
  assert.equal(first.item.id, "stale");
  assert.equal(first.due, true);
});

test("only active items are planned: ideas aren't commitments yet", () => {
  // The idea scores far higher, but only the active item may be recommended.
  const items = [item("idea", "A", [5, 5, 1], "idea"), item("active", "B", [2, 2, 4])];
  const { main } = plan(items, [cat("A"), cat("B")]);
  assert.deepEqual([...new Set(picks(main))], ["active"]);
  for (const day of main.days) {
    assert.ok(day.alternatives.every((o) => o.item.status === "active"));
  }
});

test("a week doesn't settle into two interests taking turns", () => {
  // Two strong interests and three weaker ones, all touched yesterday, as in
  // a real plan where the top two used to alternate every day.
  const items = [
    item("strong", "A", [5, 5, 1]), // 10
    item("second", "B", [4, 4, 1]), // 8
    item("c", "C", [3, 3, 1]), // 6
    item("d", "D", [3, 3, 1]),
    item("e", "E", [3, 3, 1]),
  ];
  const categories = ["A", "B", "C", "D", "E"].map((c) => cat(c));
  const { main } = plan(items, categories, logs("2026-10-08", "strong", "second", "c", "d", "e"));
  const week = picks(main);
  // Every interest gets time this week...
  assert.deepEqual(new Set(week), new Set(["strong", "second", "c", "d", "e"]));
  // ...and it never settles into a back-and-forth: any four sessions in a
  // row involve at least three interests. (Without the variety penalty, the
  // plan alternated strong, second, strong, second... for days.)
  for (let i = 0; i + 4 <= week.length; i++) {
    const run = week.slice(i, i + 4);
    assert.ok(new Set(run).size >= 3, `sessions ${i + 1}-${i + 4} only use ${[...new Set(run)].join(" and ")}`);
  }
});

test("ideas, blocked, parked and done items are never planned", () => {
  const items = [
    item("open", "A", [1, 1, 5]),
    item("idea", "A", [5, 5, 1], "idea"),
    item("blocked", "A", [5, 5, 1]),
    item("parked", "A", [5, 5, 1], "parked"),
    item("done", "A", [5, 5, 1], "done"),
  ];
  const { main } = plan(items, [cat("A")], [], [{ item_id: "blocked", depends_on_id: "open" }]);
  assert.deepEqual([...new Set(picks(main))], ["open"]);
});

test("each day's alternatives come from interests it doesn't already have", () => {
  const items = [
    item("a1", "A", [5, 5, 1]),
    item("a2", "A", [5, 5, 1]),
    item("b1", "B", [3, 3, 1]),
    item("c1", "C", [2, 2, 1]),
    item("d1", "D", [2, 2, 2]),
  ];
  const categories = ["A", "B", "C", "D"].map((c) => cat(c));
  const { main } = plan(items, categories, logs("2026-10-08", "a1", "b1", "c1", "d1"));
  // Friday has one session, on A, so its alternatives are the best of the rest.
  assert.equal(main.days[0].sessions[0].item.category_id, "A");
  assert.deepEqual(main.days[0].alternatives.map((o) => o.item.id), ["b1", "c1"]);
  // Every day: no alternative repeats an interest the day already has, and
  // there's at most one per interest.
  for (const day of main.days) {
    const planned = new Set(day.sessions.map((s) => s.item.category_id));
    const offered = day.alternatives.map((o) => o.item.category_id);
    assert.ok(offered.every((c) => !planned.has(c)), `${day.date} offers an interest it already has`);
    assert.equal(new Set(offered).size, offered.length);
  }
});

test("alternative routes open with different items", () => {
  const items = ["A", "B", "C"].flatMap((c) => [item(`${c}1`, c, [4, 4, 2]), item(`${c}2`, c, [3, 3, 2])]);
  const { main, alternatives } = plan(items, [cat("A"), cat("B"), cat("C")]);
  const opening = (r: Route) => picks(r).slice(0, 3);
  for (const alt of alternatives) {
    const shared = opening(alt).filter((id) => opening(main).includes(id));
    assert.deepEqual(shared, [], "an alternative route reuses the main route's opening");
  }
  assert.equal(alternatives.length, 2);
});

test("nothing available means empty days, not a crash", () => {
  const { main } = plan([item("x", "A", [3, 3, 3], "done")], [cat("A")]);
  assert.equal(picks(main).length, 0);
  assert.equal(main.days.length, 7);
});

test("the same input always gives the same plan", () => {
  const items = ["A", "B"].flatMap((c) => [item(`${c}1`, c, [4, 4, 2]), item(`${c}2`, c, [4, 4, 2])]);
  assert.deepEqual(plan(items, [cat("A"), cat("B")]), plan(items, [cat("A"), cat("B")]));
});

test("the skill clock curve", () => {
  assert.equal(clockFactor(null, 7), 1.5); // never touched counts as due
  assert.equal(clockFactor(3, 7), 1); // fresh
  assert.equal(clockFactor(7, 7), 1.5); // due
  assert.equal(clockFactor(14, 7), 2); // twice overdue
  assert.equal(clockFactor(100, 7), 2); // capped
});

test("today's sessions follow the user's saved order", () => {
  // Weekend: two sessions today (Saturday 10 October).
  const items = [item("a", "A", [5, 5, 1]), item("b", "B", [4, 4, 1]), item("c", "C", [3, 3, 1])];
  const input: PlannerInput = {
    items, dependencies: [], categories: [cat("A"), cat("B"), cat("C")], workLogs: [], snapshots: [],
    profile: DEFAULT_PROFILE, today: { date: "2026-10-10", weekday: 6 },
  };
  const { main } = planRoutes(input);
  const planned = main.days[0].sessions.map((s) => s.item.id);
  const reversed = [...planned].reverse();

  const mine = applyTodayOrder(main, reversed);
  assert.deepEqual(mine.days[0].sessions.map((s) => s.item.id), reversed);
  // Other days are untouched.
  assert.deepEqual(mine.days.slice(1), main.days.slice(1));
  // Stale ids are ignored and unmatched sessions kept, so nothing is lost.
  const partial = applyTodayOrder(main, ["gone", planned[1]]);
  assert.deepEqual(partial.days[0].sessions.map((s) => s.item.id), [planned[1], planned[0]]);
});

// Learning ------------------------------------------------------------------------

test("with no history, automatic intervals plan exactly like their presets", () => {
  // The same items under automatic categories and under hand-set ones at the
  // preset values: with nothing to learn from, the plans must be identical.
  const items = [item("run", "fit", [4, 3, 2]), item("piano", "keys", [5, 4, 3]), item("rust", "code", [4, 4, 4])];
  const automatic: Category[] = [
    { id: "fit", name: "fit", color: "#888888", skill_type: "fitness", resurface_days: null },
    { id: "keys", name: "keys", color: "#888888", skill_type: "instrument", resurface_days: null },
    { id: "code", name: "code", color: "#888888", skill_type: "technical", resurface_days: null },
  ];
  const presets = automatic.map((c, i) => ({ ...c, resurface_days: [7, 42, 28][i] }));
  const learned = plan(items, automatic);
  assert.deepEqual(learned.main.days.map((d) => d.sessions.map((s) => s.item.id)), plan(items, presets).main.days.map((d) => d.sessions.map((s) => s.item.id)));
  for (const s of learned.main.days.flatMap((d) => d.sessions)) assert.equal(s.preference.multiplier, 1);
});

test("an item you keep skipping gives way to one you do", () => {
  // Two identical items; "a" would win the tie on title. But for two weeks
  // "a" was planned and skipped while "b" was done.
  const items = [item("a", "A", [4, 4, 2]), item("b", "B", [4, 4, 2])];
  const days = Array.from({ length: 14 }, (_, i) => addDays(today.date, -(14 - i)));
  const snapshots: PlanSnapshot[] = days.map((day) => ({
    day,
    answered: true,
    sessions: [{ item_id: "a", category_id: "A" }, { item_id: "b", category_id: "B" }],
  }));
  const workLogs = days.map((day) => ({ item_id: "b", day }));
  const { main } = plan(items, [cat("A"), cat("B")], workLogs, [], snapshots);
  const first = main.days[0].sessions[0];
  assert.equal(first.item.id, "b");
  assert.ok(first.preference.multiplier > 1);
});

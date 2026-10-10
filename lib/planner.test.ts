import { test } from "node:test";
import assert from "node:assert/strict";
import { clockFactor, planRoutes, type PlannerInput, type Route } from "./planner.ts";
import { DEFAULT_PROFILE } from "./profile.ts";
import type { Category, Dependency, Item, Score, Status, WorkLog } from "./types.ts";

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
  status: Status = "idea",
): Item => ({ id, title: id, notes: "", category_id, status, interest, impact, effort });

/** Mark each item as worked on, on the given day. */
const logs = (day: string, ...ids: string[]): WorkLog[] => ids.map((item_id) => ({ item_id, day }));

function plan(items: Item[], categories: Category[], workLogs: WorkLog[] = [], dependencies: Dependency[] = []) {
  const input: PlannerInput = { items, dependencies, categories, workLogs, profile: DEFAULT_PROFILE, today };
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

test("continuing an active item beats starting a new one at the same score", () => {
  const items = [item("Alpha", "A", [3, 3, 2]), item("Beta", "B", [3, 3, 2], "active")];
  const { main } = plan(items, [cat("A"), cat("B")], logs("2026-10-08", "Alpha", "Beta"));
  assert.equal(main.days[0].sessions[0].item.id, "Beta");
  assert.equal(main.days[0].sessions[0].continuing, true);
});

test("blocked, parked and done items are never planned", () => {
  const items = [
    item("open", "A", [1, 1, 5]),
    item("blocked", "A", [5, 5, 1]),
    item("parked", "A", [5, 5, 1], "parked"),
    item("done", "A", [5, 5, 1], "done"),
  ];
  const { main } = plan(items, [cat("A")], [], [{ item_id: "blocked", depends_on_id: "open" }]);
  assert.deepEqual([...new Set(picks(main))], ["open"]);
});

test("alternatives come from other interests, one per interest", () => {
  const items = [
    item("a1", "A", [5, 5, 1]),
    item("a2", "A", [5, 5, 1]),
    item("b1", "B", [3, 3, 1]),
    item("c1", "C", [2, 2, 1]),
  ];
  const { main } = plan(items, [cat("A"), cat("B"), cat("C")], logs("2026-10-08", "a1", "b1", "c1"));
  const session = main.days[0].sessions[0];
  assert.equal(session.item.category_id, "A");
  assert.deepEqual(session.alternatives.map((o) => o.item.id), ["b1", "c1"]);
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

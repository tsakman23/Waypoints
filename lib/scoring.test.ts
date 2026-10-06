import { test } from "node:test";
import assert from "node:assert/strict";
import { nextUp, unlockBoost, unlockedGoals } from "./scoring.ts";
import { dependentsOf } from "./graph.ts";
import type { Dependency, Item, Score, Status } from "./types.ts";

const item = (
  id: string,
  interest: Score,
  impact: Score,
  effort: Score,
  status: Status = "idea",
): Item => ({ id, title: id, notes: "", category_id: null, status, interest, impact, effort });

const edge = (item_id: string, depends_on_id: string): Dependency => ({
  item_id,
  depends_on_id,
});

test("boost decays with distance", () => {
  // compiler -> rust -> basics; compiler is worth 10, rust 4.
  const items = [item("compiler", 5, 5, 5), item("rust", 2, 2, 3), item("basics", 1, 1, 1)];
  const deps = [edge("compiler", "rust"), edge("rust", "basics")];
  const byId = new Map(items.map((i) => [i.id, i]));
  const dependents = dependentsOf(deps);

  // rust unlocks compiler directly: 10 * 0.5.
  assert.equal(unlockBoost("rust", byId, dependents), 5);
  // basics unlocks rust (4 * 0.5) and compiler two steps away (10 * 0.25).
  assert.equal(unlockBoost("basics", byId, dependents), 4.5);
});

test("an item reachable two ways counts once, at its shortest distance", () => {
  // goal depends on both a and b; b also depends on a.
  const items = [item("goal", 4, 4, 1), item("a", 1, 1, 1), item("b", 1, 1, 1)];
  const deps = [edge("goal", "a"), edge("goal", "b"), edge("b", "a")];
  const byId = new Map(items.map((i) => [i.id, i]));
  // a: goal at distance 1 (8 * 0.5) + b at distance 1 (2 * 0.5).
  assert.equal(unlockBoost("a", byId, dependentsOf(deps)), 5);
});

test("lists what an item unlocks, largest contribution first", () => {
  const items = [item("compiler", 5, 5, 5), item("rust", 2, 2, 3), item("basics", 1, 1, 1)];
  const deps = [edge("compiler", "rust"), edge("rust", "basics")];
  const byId = new Map(items.map((i) => [i.id, i]));
  const unlocks = unlockedGoals("basics", byId, dependentsOf(deps));
  assert.deepEqual(
    unlocks.map((u) => [u.item.id, u.distance, u.contribution]),
    [
      ["compiler", 2, 2.5],
      ["rust", 1, 2],
    ],
  );
});

test("finished dependents add nothing", () => {
  const items = [item("goal", 5, 5, 1, "done"), item("step", 1, 1, 1)];
  const byId = new Map(items.map((i) => [i.id, i]));
  assert.equal(unlockBoost("step", byId, dependentsOf([edge("goal", "step")])), 0);
});

test("a prerequisite of a big goal outranks a slightly better standalone item", () => {
  const items = [
    item("compiler", 5, 5, 5),
    item("rust", 3, 3, 3),
    item("standalone", 4, 4, 3),
  ];
  const ranked = nextUp(items, [edge("compiler", "rust")]);
  // compiler is blocked by rust, so it isn't suggested.
  assert.deepEqual(
    ranked.map((s) => s.item.id),
    ["rust", "standalone"],
  );
  // rust: (6 + 10 * 0.5) / 3; standalone: 8 / 3.
  assert.equal(ranked[0].score, 11 / 3);
  assert.equal(ranked[1].score, 8 / 3);
});

test("higher effort lowers the score", () => {
  const ranked = nextUp([item("hard", 3, 3, 5), item("easy", 3, 3, 1)], []);
  assert.deepEqual(
    ranked.map((s) => s.item.id),
    ["easy", "hard"],
  );
});

test("done, blocked and parked items are left out", () => {
  const items = [
    item("done", 3, 3, 3, "done"),
    item("parked", 3, 3, 3, "parked"),
    item("blocked", 3, 3, 3),
    item("open", 3, 3, 3, "active"),
  ];
  const ranked = nextUp(items, [edge("blocked", "open")]);
  assert.deepEqual(
    ranked.map((s) => s.item.id),
    ["open"],
  );
});

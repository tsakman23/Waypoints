import { test } from "node:test";
import assert from "node:assert/strict";
import type { LearnedInterval, Preference } from "./learning.ts";
import type { Option } from "./planner.ts";
import { reasonFor } from "./reasons.ts";
import type { Item } from "./types.ts";

const run: Item = { id: "run", title: "Run", notes: "", category_id: "fit", status: "active", interest: 3, impact: 3, effort: 3 };
const neutral: Preference = { probability: 0.5, multiplier: 1, evidence: "none" };
const preset: LearnedInterval = { days: 7, handSet: false, preset: 7, observed: null, weight: 0 };

const option = (parts: Partial<Option>): Option => ({
  item: run, score: 2, adjusted: 2, due: false, preference: neutral, interval: preset, ...parts,
});

test("nothing learned and nothing due: no reason", () => {
  assert.equal(reasonFor(option({}), "Fitness"), undefined);
});

test("due says how often you really return, once that's learned", () => {
  const learned: LearnedInterval = { days: 10, handSet: false, preset: 7, observed: 10, weight: 0.8 };
  assert.equal(reasonFor(option({ due: true, interval: learned }), "Fitness"), "Due · back to Fitness about every 10 days");
  // Too little evidence, or an interval set by hand: just "Due".
  assert.equal(reasonFor(option({ due: true, interval: { ...learned, weight: 0.2 } }), "Fitness"), "Due");
  assert.equal(reasonFor(option({ due: true, interval: { ...learned, handSet: true } }), "Fitness"), "Due");
});

test("follow-through reasons need the item's own evidence and a clear signal", () => {
  const pref = (multiplier: number, evidence: Preference["evidence"] = "item") => ({ probability: 0.5, multiplier, evidence });
  assert.equal(reasonFor(option({ preference: pref(0.6) }), "Fitness"), "You often skip this");
  assert.equal(reasonFor(option({ preference: pref(1.4) }), "Fitness"), "You usually do this");
  assert.equal(reasonFor(option({ preference: pref(0.95) }), "Fitness"), undefined);
  assert.equal(reasonFor(option({ preference: pref(0.6, "category") }), "Fitness"), "You often skip Fitness");
});

test("due outranks follow-through", () => {
  const skipped: Preference = { probability: 0.2, multiplier: 0.5, evidence: "item" };
  assert.equal(reasonFor(option({ due: true, preference: skipped }), "Fitness"), "Due");
});

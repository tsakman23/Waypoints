import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutGalaxy, orbitPosition, periodFor, type Orbit } from "./solar.ts";
import type { Category, Item, Score, Status } from "./types.ts";

const flat = (a: number, e: number, period = 100): Orbit => ({ a, e, period, phase: 0, inclination: 0, node: 0 });
const distance = ([x, y, z]: number[]) => Math.hypot(x, y, z);
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

test("a planet starts at perihelion and is at aphelion half a year later", () => {
  const orbit = flat(10, 0.5);
  close(distance(orbitPosition(orbit, 0)), 10 * (1 - 0.5)); // closest: 5
  close(distance(orbitPosition(orbit, 50)), 10 * (1 + 0.5)); // farthest: 15
});

test("planets move faster near the sun (Kepler's second law)", () => {
  const orbit = flat(10, 0.5);
  const speedAt = (t: number) => distance(orbitPosition(orbit, t + 0.001).map((v, i) => v - orbitPosition(orbit, t)[i]));
  // Physics says perihelion speed ÷ aphelion speed = (1 + e) / (1 − e) = 3 here.
  const ratio = speedAt(0) / speedAt(50);
  assert.ok(Math.abs(ratio - 3) < 0.01, `speed ratio ${ratio}, expected 3`);
});

test("an orbit four times wider takes eight times as long (Kepler's third law)", () => {
  close(periodFor(16) / periodFor(4), 8);
});

test("a full year brings a planet back to where it started", () => {
  const orbit = { ...flat(7, 0.2, 40), phase: 0.3, inclination: 0.1, node: 1 };
  orbitPosition(orbit, 0).forEach((v, i) => close(v, orbitPosition(orbit, 40)[i]));
});

const cat = (id: string): Category => ({ id, name: id, color: "#888888", skill_type: "other", resurface_days: 28 });
const item = (id: string, category_id: string | null, status: Status = "idea", score: Score = 3): Item => ({
  id, title: id, notes: "", category_id, status, interest: score, impact: score, effort: 3,
});

test("available planets orbit inside locked ones, with done ones furthest out", () => {
  const items = [item("done", "A", "done"), item("locked", "A"), item("free", "A"), item("first", "A")];
  const [system] = layoutGalaxy(items, [cat("A")], [{ item_id: "locked", depends_on_id: "first" }]);
  const a = (id: string) => system.planets.find((p) => p.id === id)!.orbit.a;
  assert.ok(a("free") < a("locked") && a("first") < a("locked"));
  assert.ok(a("locked") < a("done"));
  assert.deepEqual(system.planets.find((p) => p.id === "locked")!.lockedBy, ["first"]);
});

test("one system per interest, plus one for uncategorised items, and none overlap", () => {
  const items = ["A", "B", "C", "D"].flatMap((c) => [item(`${c}1`, c), item(`${c}2`, c), item(`${c}3`, c)]);
  const systems = layoutGalaxy([...items, item("loose", null)], ["A", "B", "C", "D"].map(cat), []);
  assert.deepEqual(systems.map((s) => s.id), ["A", "B", "C", "D", ""]);
  for (const s of systems) {
    for (const t of systems) {
      if (s === t) continue;
      const gap = Math.hypot(s.position[0] - t.position[0], s.position[1] - t.position[1]);
      assert.ok(gap >= s.radius + t.radius, `${s.id} and ${t.id} overlap`);
    }
  }
});

test("the same data always gives the same galaxy", () => {
  const items = [item("a", "A"), item("b", "A"), item("c", "B")];
  assert.deepEqual(layoutGalaxy(items, [cat("A"), cat("B")], []), layoutGalaxy(items, [cat("A"), cat("B")], []));
});

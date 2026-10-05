import { test } from "node:test";
import assert from "node:assert/strict";
import { isAvailable, prerequisitesOf, wouldCreateCycle } from "./graph.ts";
import type { Dependency, Item, Status } from "./types.ts";

const edge = (item_id: string, depends_on_id: string): Dependency => ({
  item_id,
  depends_on_id,
});

const item = (id: string, status: Status = "idea"): Item => ({
  id,
  title: id,
  notes: "",
  category_id: null,
  status,
  interest: 3,
  impact: 3,
  effort: 3,
});

// compiler -> rust -> basics
const chain = [edge("compiler", "rust"), edge("rust", "basics")];

test("rejects an item depending on itself", () => {
  assert.equal(wouldCreateCycle([], "a", "a"), true);
});

test("rejects an edge that closes a loop", () => {
  // basics depending on compiler would loop back round the chain.
  assert.equal(wouldCreateCycle(chain, "basics", "compiler"), true);
  assert.equal(wouldCreateCycle(chain, "rust", "compiler"), true);
});

test("allows edges that keep the graph acyclic", () => {
  assert.equal(wouldCreateCycle(chain, "compiler", "basics"), false);
  assert.equal(wouldCreateCycle(chain, "other", "compiler"), false);
});

test("an item is available once all its prerequisites are done", () => {
  const items = [item("compiler"), item("rust", "done"), item("basics", "done")];
  const byId = new Map(items.map((i) => [i.id, i]));
  const deps = [...chain, edge("compiler", "basics")];
  assert.equal(isAvailable(byId.get("compiler")!, byId, prerequisitesOf(deps)), true);
});

test("an item is blocked while any prerequisite is unfinished", () => {
  const items = [item("compiler"), item("rust", "active"), item("basics", "done")];
  const byId = new Map(items.map((i) => [i.id, i]));
  assert.equal(isAvailable(byId.get("compiler")!, byId, prerequisitesOf(chain)), false);
});

test("done items are never available", () => {
  const done = item("x", "done");
  assert.equal(isAvailable(done, new Map([["x", done]]), new Map()), false);
});

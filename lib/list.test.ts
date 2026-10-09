import { test } from "node:test";
import assert from "node:assert/strict";
import { filterItems, NO_FILTERS, sortItems } from "./list.ts";
import type { Category, Item } from "./types.ts";

const music: Category = { id: "music", name: "Music", color: "#e11d48", skill_type: "instrument", resurface_days: 42 };
const code: Category = { id: "code", name: "Software", color: "#2563eb", skill_type: "technical", resurface_days: 28 };

const items: Item[] = [
  { id: "1", title: "Learn Rust", notes: "", category_id: "code", status: "active", interest: 5, impact: 4, effort: 3 },
  { id: "2", title: "write a compiler", notes: "after rust", category_id: "code", status: "idea", interest: 5, impact: 5, effort: 5 },
  { id: "3", title: "Piano scales", notes: "", category_id: "music", status: "done", interest: 2, impact: 3, effort: 1 },
  { id: "4", title: "Sort the garage", notes: "", category_id: null, status: "parked", interest: 1, impact: 2, effort: 2 },
];

const ids = (list: Item[]) => list.map((i) => i.id);

test("no filters keeps everything", () => {
  assert.deepEqual(ids(filterItems(items, NO_FILTERS)), ["1", "2", "3", "4"]);
});

test("filters by category, including uncategorised", () => {
  assert.deepEqual(ids(filterItems(items, { ...NO_FILTERS, category: "code" })), ["1", "2"]);
  assert.deepEqual(ids(filterItems(items, { ...NO_FILTERS, category: "none" })), ["4"]);
});

test("filters by status", () => {
  assert.deepEqual(ids(filterItems(items, { ...NO_FILTERS, status: "done" })), ["3"]);
});

test("search matches title or notes, ignoring case", () => {
  assert.deepEqual(ids(filterItems(items, { ...NO_FILTERS, search: "RUST" })), ["1", "2"]);
});

test("filters combine", () => {
  assert.deepEqual(
    ids(filterItems(items, { category: "code", status: "idea", search: "rust" })),
    ["2"],
  );
});

test("sorts titles case-insensitively", () => {
  assert.deepEqual(ids(sortItems(items, { key: "title", direction: "asc" }, [music, code])), [
    "1",
    "3",
    "4",
    "2",
  ]);
});

test("sorts status active → idea → parked → done", () => {
  assert.deepEqual(ids(sortItems(items, { key: "status", direction: "asc" }, [])), ["1", "2", "4", "3"]);
  assert.deepEqual(ids(sortItems(items, { key: "status", direction: "desc" }, [])), ["3", "4", "2", "1"]);
});

test("sorts by category name with uncategorised last, either direction", () => {
  assert.deepEqual(ids(sortItems(items, { key: "category", direction: "asc" }, [music, code])), ["3", "1", "2", "4"]);
  assert.deepEqual(ids(sortItems(items, { key: "category", direction: "desc" }, [music, code])), ["1", "2", "3", "4"]);
});

test("within a category, active work comes first and done/parked sink", () => {
  const software = (id: string, title: string, status: Item["status"]): Item => ({
    id, title, notes: "", category_id: "code", status, interest: 3, impact: 3, effort: 3,
  });
  const mixed = [
    software("a", "Alpha", "done"),
    software("b", "Bravo", "parked"),
    software("c", "Charlie", "idea"),
    software("d", "Delta", "active"),
  ];
  assert.deepEqual(ids(sortItems(mixed, { key: "category", direction: "asc" }, [code])), ["d", "c", "b", "a"]);
});

test("ties in any column fall back to status, then title, whatever the direction", () => {
  const tied = (id: string, title: string, status: Item["status"]): Item => ({
    id, title, notes: "", category_id: null, status, interest: 3, impact: 3, effort: 3,
  });
  const all = [tied("x", "Zebra", "done"), tied("y", "Apple", "idea"), tied("z", "Mango", "idea"), tied("w", "Kiwi", "active")];
  // Every interest is 3, so the order comes entirely from the tie-breaks.
  for (const direction of ["asc", "desc"] as const) {
    assert.deepEqual(ids(sortItems(all, { key: "interest", direction }, [])), ["w", "y", "z", "x"]);
  }
});

test("sorts scores descending", () => {
  assert.deepEqual(ids(sortItems(items, { key: "effort", direction: "desc" }, [])), [
    "2",
    "1",
    "4",
    "3",
  ]);
});

test("does not modify the input", () => {
  const before = ids(items);
  sortItems(items, { key: "effort", direction: "asc" }, []);
  assert.deepEqual(ids(items), before);
});

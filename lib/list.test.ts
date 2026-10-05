import { test } from "node:test";
import assert from "node:assert/strict";
import { filterItems, NO_FILTERS, sortItems } from "./list.ts";
import type { Category, Item } from "./types.ts";

const music: Category = { id: "music", name: "Music", color: "#e11d48" };
const code: Category = { id: "code", name: "Software", color: "#2563eb" };

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

test("sorts status in workflow order, not alphabetically", () => {
  assert.deepEqual(ids(sortItems(items, { key: "status", direction: "asc" }, [])), [
    "2",
    "1",
    "4",
    "3",
  ]);
});

test("sorts by category name, uncategorised first", () => {
  assert.deepEqual(ids(sortItems(items, { key: "category", direction: "asc" }, [music, code])), [
    "4",
    "3",
    "1",
    "2",
  ]);
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

import type { Category, Item, Status } from "./types.ts";

export type Filters = {
  /** "all", "none" (uncategorised) or a category id. */
  category: string;
  status: "all" | Status;
  search: string;
};

export const NO_FILTERS: Filters = { category: "all", status: "all", search: "" };

export type SortKey = "title" | "category" | "status" | "interest" | "impact" | "effort";
export type Sort = { key: SortKey; direction: "asc" | "desc" };

export function filterItems(items: Item[], filters: Filters): Item[] {
  const query = filters.search.trim().toLowerCase();
  return items.filter(
    (item) =>
      (filters.category === "all" ||
        (filters.category === "none"
          ? item.category_id === null
          : item.category_id === filters.category)) &&
      (filters.status === "all" || item.status === filters.status) &&
      (query === "" ||
        item.title.toLowerCase().includes(query) ||
        item.notes.toLowerCase().includes(query)),
  );
}

/** How far up the list a status belongs: what you're doing first, finished last. */
const STATUS_RANK: Record<Status, number> = { active: 0, idea: 1, parked: 2, done: 3 };

/** The list's starting order: active work at the top, done at the bottom. */
export const DEFAULT_SORT: Sort = { key: "status", direction: "asc" };

const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/**
 * Sorts by the chosen column; the direction flips only that comparison.
 * Uncategorised items stay last whichever way categories are sorted, and
 * ties always fall back to status (active first) and then title, so done and
 * parked items sink within any group.
 */
export function sortItems(items: Item[], sort: Sort, categories: Category[]): Item[] {
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const categoryOf = (item: Item) => (item.category_id ? categoryNames.get(item.category_id) : undefined);
  const direction = sort.direction === "asc" ? 1 : -1;

  /** The chosen column's comparison, before any tie-breaking. */
  function byColumn(a: Item, b: Item): number {
    switch (sort.key) {
      case "title":
        return compareText(a.title, b.title) * direction;
      case "category": {
        const x = categoryOf(a);
        const y = categoryOf(b);
        // Uncategorised last, regardless of direction.
        if (x === undefined || y === undefined) return Number(x === undefined) - Number(y === undefined);
        return compareText(x, y) * direction;
      }
      case "status":
        return (STATUS_RANK[a.status] - STATUS_RANK[b.status]) * direction;
      default:
        return (a[sort.key] - b[sort.key]) * direction;
    }
  }

  // Copy first: sort() reorders in place, and the input may be React state.
  return [...items].sort(
    (a, b) =>
      byColumn(a, b) ||
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      compareText(a.title, b.title),
  );
}

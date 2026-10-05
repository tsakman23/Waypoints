import { STATUSES, type Category, type Item, type Status } from "./types.ts";

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

export function sortItems(items: Item[], sort: Sort, categories: Category[]): Item[] {
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  const sortValue = (item: Item): string | number => {
    switch (sort.key) {
      case "title":
        return item.title;
      case "category":
        return item.category_id ? (categoryNames.get(item.category_id) ?? "") : "";
      case "status":
        // Workflow order (idea, active, parked, done), not alphabetical.
        return STATUSES.indexOf(item.status);
      default:
        return item[sort.key];
    }
  };

  const direction = sort.direction === "asc" ? 1 : -1;
  // Copy first: sort() reorders in place, and the input may be React state.
  return [...items].sort((a, b) => {
    const x = sortValue(a);
    const y = sortValue(b);
    const order =
      typeof x === "string" && typeof y === "string"
        ? x.localeCompare(y, undefined, { sensitivity: "base" })
        : Number(x) - Number(y);
    return order * direction;
  });
}

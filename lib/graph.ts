import type { Dependency, Item } from "./types.ts";

/** Map each item id to the ids it depends on (its prerequisites). */
export function prerequisitesOf(deps: Dependency[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { item_id, depends_on_id } of deps) {
    const list = map.get(item_id) ?? [];
    list.push(depends_on_id);
    map.set(item_id, list);
  }
  return map;
}

/** Map each item id to the ids that depend on it (what it unlocks). */
export function dependentsOf(deps: Dependency[]): Map<string, string[]> {
  return prerequisitesOf(
    deps.map((d) => ({ item_id: d.depends_on_id, depends_on_id: d.item_id })),
  );
}

/**
 * Would adding "itemId depends on dependsOnId" create a cycle?
 *
 * It would if itemId is already reachable from dependsOnId by following
 * prerequisites — then the new edge would close the loop. An item depending
 * on itself is the one-step case.
 */
export function wouldCreateCycle(
  deps: Dependency[],
  itemId: string,
  dependsOnId: string,
): boolean {
  const prereqs = prerequisitesOf(deps);
  const stack = [dependsOnId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === itemId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(prereqs.get(id) ?? []));
  }
  return false;
}

/** An item is available when it isn't done and all its prerequisites are. */
export function isAvailable(
  item: Item,
  itemsById: Map<string, Item>,
  prereqs: Map<string, string[]>,
): boolean {
  if (item.status === "done") return false;
  return (prereqs.get(item.id) ?? []).every(
    (id) => itemsById.get(id)?.status === "done",
  );
}

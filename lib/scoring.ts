import { dependentsOf, isAvailable, prerequisitesOf } from "./graph.ts";
import type { Dependency, Item } from "./types.ts";

/** How much an unlocked goal's value shrinks per step away. */
export const DECAY = 0.5;

/** What an item is worth on its own. */
export function valueOf(item: Item): number {
  return item.interest + item.impact;
}

/**
 * The value of everything an item transitively unlocks, each unfinished
 * dependent counted once at its shortest distance and scaled by
 * DECAY ** distance.
 */
export function unlockBoost(
  itemId: string,
  itemsById: Map<string, Item>,
  dependents: Map<string, string[]>,
): number {
  let boost = 0;
  const seen = new Set([itemId]);
  let frontier = [itemId];
  // Breadth-first, so the first time we reach an item is its shortest distance.
  for (let distance = 1; frontier.length > 0; distance++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const depId of dependents.get(id) ?? []) {
        if (seen.has(depId)) continue;
        seen.add(depId);
        next.push(depId);
        const dep = itemsById.get(depId);
        if (dep && dep.status !== "done") {
          boost += valueOf(dep) * DECAY ** distance;
        }
      }
    }
    frontier = next;
  }
  return boost;
}

export type Suggestion = {
  item: Item;
  value: number;
  boost: number;
  score: number;
};

/**
 * Available, non-parked items ranked by (value + boost) / effort,
 * highest first.
 */
export function nextUp(items: Item[], deps: Dependency[]): Suggestion[] {
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const prereqs = prerequisitesOf(deps);
  const dependents = dependentsOf(deps);

  return items
    .filter((i) => i.status !== "parked" && isAvailable(i, itemsById, prereqs))
    .map((item) => {
      const value = valueOf(item);
      const boost = unlockBoost(item.id, itemsById, dependents);
      return { item, value, boost, score: (value + boost) / item.effort };
    })
    .sort((a, b) => b.score - a.score);
}

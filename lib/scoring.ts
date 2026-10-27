import type { Item } from "./types.ts";

/** How much an unlocked goal's value shrinks per step away. */
export const DECAY = 0.5;

/** What an item is worth on its own. */
export function valueOf(item: Item): number {
  return item.interest + item.impact;
}

/** One goal an item helps unlock, and how much of the boost it accounts for. */
export type Unlock = { item: Item; distance: number; contribution: number };

/**
 * Every unfinished item this one transitively unlocks, each counted once at
 * its shortest distance, contributing valueOf(goal) * DECAY ** distance.
 * Largest contribution first.
 */
export function unlockedGoals(
  itemId: string,
  itemsById: Map<string, Item>,
  dependents: Map<string, string[]>,
): Unlock[] {
  const unlocks: Unlock[] = [];
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
          unlocks.push({ item: dep, distance, contribution: valueOf(dep) * DECAY ** distance });
        }
      }
    }
    frontier = next;
  }
  return unlocks.sort((a, b) => b.contribution - a.contribution);
}

/** The total of unlockedGoals: what an item is worth for what it leads to. */
export function unlockBoost(
  itemId: string,
  itemsById: Map<string, Item>,
  dependents: Map<string, string[]>,
): number {
  return unlockedGoals(itemId, itemsById, dependents).reduce((sum, u) => sum + u.contribution, 0);
}

export type Suggestion = {
  item: Item;
  value: number;
  boost: number;
  score: number;
  /** The goals behind the boost, largest contribution first. */
  unlocks: Unlock[];
};

/** (value + boost) / effort for any item, available or not. */
export function scoreOf(
  item: Item,
  itemsById: Map<string, Item>,
  dependents: Map<string, string[]>,
): Suggestion {
  const value = valueOf(item);
  const unlocks = unlockedGoals(item.id, itemsById, dependents);
  const boost = unlocks.reduce((sum, u) => sum + u.contribution, 0);
  return { item, value, boost, score: (value + boost) / item.effort, unlocks };
}

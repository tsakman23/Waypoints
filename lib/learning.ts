import { daysBetween } from "./profile.ts";
import { SKILL_PRESETS } from "./skills.ts";
import type { Category, Item, PlanSnapshot, WorkLog } from "./types.ts";

// Learning from behaviour. Two things are learned from the daily check-ins:
//
// 1. Follow-through: how likely you are to actually do an item when it's
//    planned. A Beta-Binomial model with shrinkage: every item starts from
//    a prior (a few "pretend days" at its category's rate, and each category
//    at your overall rate), and real evidence outweighs the prior as it
//    builds up. The planner uses each item's rate relative to your overall
//    rate as a multiplier, so with no history everything is exactly 1.
//
// 2. Resurfacing intervals: how often you really come back to each interest,
//    from the gaps between the days you worked on it, blended with the skill
//    type's preset. An interval you set by hand is never changed.
//
// Pure and deterministic: the same inputs always give the same results.

/** Tunable numbers, kept together like PLAN in planner.ts. */
export const LEARN = {
  /** Only answered days from this many days back count as evidence. */
  preferenceWindowDays: 90,
  /** Pretend days at the overall rate that every category starts with. */
  categoryPriorStrength: 4,
  /** Pretend days at its category's rate that every item starts with. */
  itemPriorStrength: 4,
  /** The follow-through multiplier never goes outside this range. */
  minPreference: 0.5,
  maxPreference: 1.5,
  /** Work days from this many days back count towards intervals. */
  intervalWindowDays: 180,
  /** Pretend gaps at the preset: how much evidence it takes to move halfway. */
  intervalPriorStrength: 5,
  /** A learned interval stays within these multiples of the preset. */
  minIntervalRatio: 0.5,
  maxIntervalRatio: 2,
};

// Follow-through -----------------------------------------------------------------

/** Evidence for one item or category: days it was done, and days it was planned but skipped. */
export type Counts = { hits: number; misses: number };

export type Preferences = {
  /** Your overall follow-through rate; 0.5 with no evidence. */
  overall: number;
  /** Evidence per category id ("" for uncategorised). */
  categories: Map<string, Counts>;
  /** Evidence per item id. */
  items: Map<string, Counts>;
};

export type LearningInput = {
  items: Item[];
  categories: Category[];
  workLogs: WorkLog[];
  snapshots: PlanSnapshot[];
  /** Today's date, `YYYY-MM-DD`, in the user's timezone. */
  today: string;
};

const interestOf = (categoryId: string | null) => categoryId ?? "";

function add(map: Map<string, Counts>, key: string, hit: boolean) {
  const counts = map.get(key) ?? { hits: 0, misses: 0 };
  if (hit) counts.hits++;
  else counts.misses++;
  map.set(key, counts);
}

/**
 * Counts the evidence from every answered day in the window. On each day:
 * planned and done is a hit, planned and not done a miss, and done without
 * being planned also a hit. Items deleted since are ignored.
 */
export function learnPreferences({ items, workLogs, snapshots, today }: LearningInput): Preferences {
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const doneOn = new Map<string, Set<string>>();
  for (const log of workLogs) {
    doneOn.set(log.day, (doneOn.get(log.day) ?? new Set()).add(log.item_id));
  }

  const categories = new Map<string, Counts>();
  const itemCounts = new Map<string, Counts>();
  let hits = 0;
  let misses = 0;
  const record = (itemId: string, categoryId: string | null, hit: boolean) => {
    add(itemCounts, itemId, hit);
    add(categories, interestOf(categoryId), hit);
    if (hit) hits++;
    else misses++;
  };

  for (const snapshot of snapshots) {
    const age = daysBetween(snapshot.day, today);
    if (!snapshot.answered || age < 1 || age > LEARN.preferenceWindowDays) continue;
    const done = doneOn.get(snapshot.day) ?? new Set<string>();
    // An item planned for two sessions is still one decision that day.
    const planned = new Map<string, string | null>();
    for (const s of snapshot.sessions) {
      if (itemsById.has(s.item_id) && !planned.has(s.item_id)) planned.set(s.item_id, s.category_id);
    }
    for (const [itemId, categoryId] of planned) record(itemId, categoryId, done.has(itemId));
    for (const itemId of done) {
      const item = itemsById.get(itemId);
      if (item && !planned.has(itemId)) record(itemId, item.category_id, true);
    }
  }

  // Your overall rate, with one pretend hit and one pretend miss so a
  // single answer can't make it 0 or 1.
  return { overall: (hits + 1) / (hits + misses + 2), categories, items: itemCounts };
}

/** `counts` shrunk towards `prior` by `strength` pretend observations. */
function shrink(counts: Counts | undefined, prior: number, strength: number): number {
  // No evidence: exactly the prior (avoids any floating-point drift).
  if (!counts || counts.hits + counts.misses === 0) return prior;
  return (counts.hits + strength * prior) / (counts.hits + counts.misses + strength);
}

export type Preference = {
  /** Predicted chance you'll do the item when it's planned. */
  probability: number;
  /** That chance relative to your overall rate, capped: what the planner multiplies by. */
  multiplier: number;
  /** Where the evidence came from: the item itself, only its category, or nothing yet. */
  evidence: "item" | "category" | "none";
};

/** How likely you are to do `item`, from its own evidence, its category's, and your overall rate. */
export function preferenceOf(prefs: Preferences, item: Item): Preference {
  const category = prefs.categories.get(interestOf(item.category_id));
  const own = prefs.items.get(item.id);
  // The category's rate without this item's own evidence ("leave one out"),
  // or the item's days would count twice: once in its category's rate, and
  // again on top of it. Never below zero: an item that changed category has
  // older days counted under its old one.
  const others: Counts | undefined = category && {
    hits: Math.max(0, category.hits - (own?.hits ?? 0)),
    misses: Math.max(0, category.misses - (own?.misses ?? 0)),
  };
  const categoryRate = shrink(others, prefs.overall, LEARN.categoryPriorStrength);
  const probability = shrink(own, categoryRate, LEARN.itemPriorStrength);
  const ratio = probability / prefs.overall;
  return {
    probability,
    multiplier: Math.min(LEARN.maxPreference, Math.max(LEARN.minPreference, ratio)),
    evidence: own ? "item" : category ? "category" : "none",
  };
}

// Resurfacing intervals -----------------------------------------------------------

export type LearnedInterval = {
  /** The interval the planner uses. */
  days: number;
  /** Set by hand: used as is, nothing learned. */
  handSet: boolean;
  /** The skill type's preset this started from. */
  preset: number;
  /** The median gap between work days, when there are any gaps. */
  observed: number | null;
  /** How much the observed gap counts, 0 (none) to towards 1 (lots of evidence). */
  weight: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Each category's interval: hand-set ones as they are; automatic ones as the
 * preset blended with the median gap between the days you worked on it. With
 * n gaps the gap's weight is n / (n + prior strength), so a few gaps barely
 * move it, and the result stays within a range around the preset.
 */
export function learnIntervals({ items, categories, workLogs, today }: LearningInput): Map<string, LearnedInterval> {
  const categoryOf = new Map(items.map((i) => [i.id, i.category_id]));
  const daysByCategory = new Map<string, Set<string>>();
  for (const log of workLogs) {
    const categoryId = categoryOf.get(log.item_id);
    const age = daysBetween(log.day, today);
    if (!categoryId || age < 0 || age > LEARN.intervalWindowDays) continue;
    daysByCategory.set(categoryId, (daysByCategory.get(categoryId) ?? new Set()).add(log.day));
  }

  const intervals = new Map<string, LearnedInterval>();
  for (const category of categories) {
    const preset = SKILL_PRESETS[category.skill_type].resurfaceDays;
    if (category.resurface_days !== null) {
      intervals.set(category.id, { days: category.resurface_days, handSet: true, preset, observed: null, weight: 0 });
      continue;
    }
    // Dates as YYYY-MM-DD sort correctly as strings.
    const days = [...(daysByCategory.get(category.id) ?? [])].sort();
    const gaps = days.slice(1).map((day, i) => daysBetween(days[i], day));
    if (gaps.length === 0) {
      intervals.set(category.id, { days: preset, handSet: false, preset, observed: null, weight: 0 });
      continue;
    }
    const observed = median(gaps);
    const weight = gaps.length / (gaps.length + LEARN.intervalPriorStrength);
    const blended = Math.round((1 - weight) * preset + weight * observed);
    const bounded = Math.min(preset * LEARN.maxIntervalRatio, Math.max(preset * LEARN.minIntervalRatio, blended));
    intervals.set(category.id, {
      days: Math.min(365, Math.max(1, Math.round(bounded))),
      handSet: false,
      preset,
      observed,
      weight,
    });
  }
  return intervals;
}

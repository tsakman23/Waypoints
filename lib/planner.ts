import { dependentsOf, isAvailable, prerequisitesOf } from "./graph.ts";
import { sessionsOn, type LocalDay } from "./profile.ts";
import { scoreOf } from "./scoring.ts";
import type { Category, Dependency, Item, Profile, WorkLog } from "./types.ts";

// The route planner: a quality-diversity schedule of work sessions for the
// coming days. Each session goes to the available item with the best
// adjusted score; interests rotate between sessions, neglected interests
// come back on their skill clock, and each session offers alternatives
// from other interests. See the "Waypoints Route Research" write-up.

/** Tunable numbers, kept together so they're easy to find and adjust. */
export const PLAN = {
  /** How many days ahead to plan, starting today. */
  horizonDays: 7,
  /** Penalty for the same interest 1, 2 and 3 sessions back. Soft: never a ban. */
  repeatPenalty: [0.7, 0.85, 0.95],
  /** Bonus for items already in progress: finishing beats starting. */
  continueBonus: 1.25,
  /** Alternatives offered per session, each from a different interest. */
  alternatives: 2,
  /** Extra whole plans offered besides the main one. */
  alternativeRoutes: 2,
  /** Alternative routes may not reuse earlier routes' items in this many first sessions. */
  noveltySessions: 3,
};

/** One option for a session, with the reasons behind its rank. */
export type Option = {
  item: Item;
  /** The plain value-for-effort score from scoring.ts. */
  score: number;
  /** After the continue bonus, skill clock and repeat penalty. */
  adjusted: number;
  /** Already active, so it got the continue bonus. */
  continuing: boolean;
  /** Its interest has gone untouched for at least its resurfacing interval. */
  due: boolean;
};

/** One work session: the pick, plus what else would be a good use of it. */
export type Session = Option & { alternatives: Option[] };

export type PlanDay = { date: string; weekday: number; sessions: Session[] };

/** A plan for the coming days. */
export type Route = { days: PlanDay[] };

export type Plan = { main: Route; alternatives: Route[] };

export type PlannerInput = {
  items: Item[];
  dependencies: Dependency[];
  categories: Category[];
  workLogs: WorkLog[];
  profile: Profile;
  /** Today as the user sees it, from localDay(). */
  today: LocalDay;
};

// Dates ---------------------------------------------------------------------
// Plain YYYY-MM-DD strings; arithmetic at noon UTC stays clear of DST edges.

const DAY_MS = 24 * 60 * 60 * 1000;
const noon = (date: string) => Date.parse(`${date}T12:00:00Z`);

export function addDays(date: string, days: number): string {
  return new Date(noon(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to) - noon(from)) / DAY_MS);
}

// Skill clock -----------------------------------------------------------------

/**
 * How much an interest's items are pulled forward by time away from it.
 * ×1 while the interest is fresh (under half its interval), rising to ×1.5
 * when it's due (a full interval untouched) and capping at ×2 at twice the
 * interval. An interest never worked on counts as due.
 */
export function clockFactor(daysSince: number | null, interval: number): number {
  if (daysSince === null) return 1.5;
  const ratio = daysSince / interval;
  if (ratio <= 0.5) return 1;
  // Straight line from (0.5, 1) through (1, 1.5) to (2, 2).
  return ratio <= 1 ? 1 + (ratio - 0.5) : Math.min(2, 1.5 + (ratio - 1) * 0.5);
}

/** The interest an item belongs to, for rotation and clocks; "" when uncategorised. */
const interestOf = (item: Item) => item.category_id ?? "";

/** The latest day each interest was worked on, from the work log. */
function lastTouchedByInterest(items: Item[], workLogs: WorkLog[]): Map<string, string> {
  const interestOfItem = new Map(items.map((i) => [i.id, interestOf(i)]));
  const latest = new Map<string, string>();
  for (const log of workLogs) {
    const interest = interestOfItem.get(log.item_id);
    if (interest === undefined) continue;
    if (!latest.has(interest) || latest.get(interest)! < log.day) latest.set(interest, log.day);
  }
  return latest;
}

// Planning ----------------------------------------------------------------------

/** Everything that stays the same while planning one set of routes. */
type Context = {
  input: PlannerInput;
  /** What can be worked on now: not done or parked, prerequisites done. */
  available: Item[];
  /** Each available item's plain score. */
  scores: Map<string, number>;
  intervals: Map<string, number>;
  touchedBefore: Map<string, string>;
};

function contextFor(input: PlannerInput): Context {
  const { items, dependencies, categories, workLogs } = input;
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const prereqs = prerequisitesOf(dependencies);
  const dependents = dependentsOf(dependencies);
  const available = items.filter((i) => i.status !== "parked" && isAvailable(i, itemsById, prereqs));
  return {
    input,
    available,
    scores: new Map(available.map((i) => [i.id, scoreOf(i, itemsById, dependents).score])),
    intervals: new Map(categories.map((c) => [c.id, c.resurface_days])),
    touchedBefore: lastTouchedByInterest(items, workLogs),
  };
}

/** Rate one item for a session on `date`, given the interests of the sessions before it. */
function rate(item: Item, date: string, history: string[], touched: Map<string, string>, ctx: Context): Option {
  const score = ctx.scores.get(item.id)!;
  const interest = interestOf(item);
  const continuing = item.status === "active";

  // Skill clock: only for categorised items; uncategorised chores never resurface.
  const interval = ctx.intervals.get(interest);
  const last = touched.get(interest);
  const daysSince = last === undefined ? null : daysBetween(last, date);
  const clock = interval === undefined ? 1 : clockFactor(daysSince, interval);
  const due = interval !== undefined && (daysSince === null || daysSince >= interval);

  // Repeat penalty for the same interest in the last few sessions.
  let repeat = 1;
  PLAN.repeatPenalty.forEach((penalty, k) => {
    if (history[history.length - 1 - k] === interest) repeat *= penalty;
  });

  const adjusted = score * (continuing ? PLAN.continueBonus : 1) * clock * repeat;
  return { item, score, adjusted, continuing, due };
}

/** Best first; ties broken by plain score, then title, so plans are stable. */
const byRank = (a: Option, b: Option) =>
  b.adjusted - a.adjusted || b.score - a.score || a.item.title.localeCompare(b.item.title);

/**
 * Plan sessions day by day. For alternative routes, `avoid` lists sets of
 * items to keep out of the first PLAN.noveltySessions sessions, strictest
 * first: the first set that still leaves something to pick is used.
 */
function planRoute(ctx: Context, avoid: Set<string>[]): Route {
  const { profile, today } = ctx.input;
  const touched = new Map(ctx.touchedBefore);
  const history: string[] = [];
  const days: PlanDay[] = [];

  for (let offset = 0; offset < PLAN.horizonDays; offset++) {
    const date = addDays(today.date, offset);
    const weekday = (today.weekday + offset) % 7;
    const sessions: Session[] = [];

    for (let s = 0; s < sessionsOn(profile, weekday); s++) {
      const options = ctx.available.map((item) => rate(item, date, history, touched, ctx)).sort(byRank);
      if (options.length === 0) break;
      const tiers = history.length < PLAN.noveltySessions ? avoid : [];
      const allowed = tiers
        .map((banned) => options.filter((o) => !banned.has(o.item.id)))
        .find((list) => list.length > 0);
      const pick = (allowed ?? options)[0];

      sessions.push({ ...pick, alternatives: alternativesFor(pick, options) });
      history.push(interestOf(pick.item));
      touched.set(interestOf(pick.item), date);
    }
    days.push({ date, weekday, sessions });
  }
  return { days };
}

/** The best option from each other interest, strongest first. */
function alternativesFor(pick: Option, options: Option[]): Option[] {
  const best = new Map<string, Option>();
  for (const o of options) {
    const interest = interestOf(o.item);
    if (interest === interestOf(pick.item) || best.has(interest)) continue;
    best.set(interest, o); // options are sorted, so the first seen is the best
  }
  return [...best.values()].slice(0, PLAN.alternatives);
}

/** The main route plus alternative routes that start differently. */
export function planRoutes(input: PlannerInput): Plan {
  const ctx = contextFor(input);
  const opening = (r: Route) =>
    r.days.flatMap((d) => d.sessions).slice(0, PLAN.noveltySessions).map((s) => s.item.id);
  const main = planRoute(ctx, []);
  const routes = [main];
  for (let k = 0; k < PLAN.alternativeRoutes; k++) {
    // Avoid every earlier route's opening if possible, else just the main one's.
    const everyEarlier = new Set(routes.flatMap(opening));
    const mainOnly = new Set(opening(main));
    routes.push(planRoute(ctx, [everyEarlier, mainOnly]));
  }
  return { main, alternatives: routes.slice(1) };
}

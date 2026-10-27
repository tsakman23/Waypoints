// Row shapes as they come back from Supabase (see supabase/schema.sql).

export const STATUSES = ["idea", "active", "parked", "done"] as const;
export type Status = (typeof STATUSES)[number];

/** A 1–5 score the user sets by hand. */
export type Score = 1 | 2 | 3 | 4 | 5;

/** What kind of skill a category is; picks its default resurfacing interval. */
export const SKILL_TYPES = ["fitness", "language", "technical", "instrument", "creative", "other"] as const;
export type SkillType = (typeof SKILL_TYPES)[number];

export type Category = {
  id: string;
  name: string;
  color: string;
  skill_type: SkillType;
  /**
   * Days the interest can go untouched before the route brings it back, when
   * set by hand. null means automatic: the skill type's preset, adjusted by
   * what the app learns from the work log.
   */
  resurface_days: number | null;
};

export type Item = {
  id: string;
  title: string;
  notes: string;
  category_id: string | null;
  status: Status;
  interest: Score;
  impact: Score;
  effort: Score;
};

/** What the app sends when creating or editing; the database assigns ids. */
export type ItemInput = Omit<Item, "id">;
/** Skill type and interval are optional: the database defaults them. */
export type CategoryInput = Omit<Category, "id" | "skill_type" | "resurface_days"> &
  Partial<Pick<Category, "skill_type" | "resurface_days">>;

/** An edge: `item_id` can't start until `depends_on_id` is done. */
export type Dependency = {
  item_id: string;
  depends_on_id: string;
};

/** "Worked on this item on this day." Days are `YYYY-MM-DD` in the user's timezone. */
export type WorkLog = {
  item_id: string;
  day: string;
};

/** One planned session in a snapshot: the item and the category it had that day. */
export type SnapshotSession = {
  item_id: string;
  category_id: string | null;
};

/**
 * What the planner suggested on one day, saved at that morning's check-in.
 * `answered` means the next day's check-in reported what was actually done,
 * so the day counts as evidence for learning.
 */
export type PlanSnapshot = {
  day: string;
  sessions: SnapshotSession[];
  answered: boolean;
};

/** The setup wizard's answers and the check-in state. */
export type Profile = {
  weekday_minutes: number;
  weekend_minutes: number;
  session_minutes: number;
  /** 0 = Sunday ... 6 = Saturday, matching JavaScript's getDay(). */
  weekend_days: number[];
  /** IANA timezone name, e.g. "Europe/London". */
  timezone: string;
  animate_orbits: boolean;
  /** The last day the check-in asked about, or null if it never has. */
  last_check_in: string | null;
  /** The day today_order was saved for; it's ignored on any other day. */
  today_order_date: string | null;
  /** The user's own order for that day's sessions, as item ids. */
  today_order: string[];
};

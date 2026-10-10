import { createClient } from "@/lib/supabase/server";
import { yesterdayIn } from "@/lib/profile";
import type { Category, Dependency, Item, Profile } from "@/lib/types";

export type Data = {
  items: Item[];
  categories: Category[];
  dependencies: Dependency[];
};

/**
 * Everything the signed-in user owns. Server-only. No user filter is needed
 * in the queries: row-level security already limits each table to the
 * user's own rows.
 */
export async function getData(): Promise<Data> {
  const supabase = await createClient();

  const [items, categories, dependencies] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, notes, category_id, status, interest, impact, effort")
      .order("created_at"),
    supabase.from("categories").select("id, name, color, skill_type, resurface_days").order("name"),
    supabase.from("dependencies").select("item_id, depends_on_id"),
  ]);

  const error = items.error ?? categories.error ?? dependencies.error;
  if (error) throw new Error(error.message);

  return {
    items: (items.data ?? []) as Item[],
    categories: categories.data ?? [],
    dependencies: dependencies.data ?? [],
  };
}

/** The signed-in user's settings, or null before the setup wizard is done. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("weekday_minutes, weekend_minutes, session_minutes, weekend_days, timezone, animate_orbits, last_check_in")
    // At most one row, and RLS means it can only be the user's own.
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type CheckIn = {
  /** The day being asked about, `YYYY-MM-DD`: yesterday in the user's timezone. */
  day: string;
  /** Active items, the things you might have worked on, with their category colour. */
  items: { id: string; title: string; color: string | null }[];
};

/**
 * The check-in to show right now, or null when yesterday is already
 * answered or there are no active items to ask about.
 */
export async function getCheckIn(profile: Profile): Promise<CheckIn | null> {
  const day = yesterdayIn(profile.timezone);
  // Dates as YYYY-MM-DD compare correctly as plain strings.
  if (profile.last_check_in && profile.last_check_in >= day) return null;

  const supabase = await createClient();
  const [items, categories] = await Promise.all([
    supabase.from("items").select("id, title, category_id").eq("status", "active").order("title"),
    supabase.from("categories").select("id, color"),
  ]);
  const error = items.error ?? categories.error;
  if (error) throw new Error(error.message);
  if (!items.data?.length) return null;

  const colors = new Map((categories.data ?? []).map((c) => [c.id, c.color]));
  return {
    day,
    items: items.data.map((i) => ({
      id: i.id,
      title: i.title,
      color: i.category_id ? (colors.get(i.category_id) ?? null) : null,
    })),
  };
}

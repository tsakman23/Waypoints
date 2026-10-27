"use server";

import { revalidatePath } from "next/cache";
import { backtest } from "@/lib/backtest";
import { getData, getPlanSnapshots, getProfile, getWorkLogs } from "@/lib/data";
import { wouldCreateCycle } from "@/lib/graph";
import { planRoutes } from "@/lib/planner";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone, localDay, yesterdayIn } from "@/lib/profile";
import {
  SKILL_TYPES,
  type CategoryInput,
  type Evaluation,
  type ItemInput,
  type Profile,
  type SnapshotSession,
} from "@/lib/types";

// Server actions can be called with any payload, not just what our forms
// send. Row-level security still guarantees users can only touch their own
// rows, and the table constraints reject bad statuses and scores; the checks
// here just turn the common mistakes into readable messages.

export type ActionResult = { error?: string };

/** Re-render every page so it shows the change. */
function refresh(): ActionResult {
  revalidatePath("/", "layout");
  return {};
}

// Items ---------------------------------------------------------------------

export async function createItem(input: ItemInput): Promise<ActionResult & { id?: string }> {
  if (!input.title.trim()) return { error: "Give it a title." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .insert({ ...input, title: input.title.trim() })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { ...refresh(), id: data.id };
}

export async function updateItem(id: string, input: Partial<ItemInput>): Promise<ActionResult> {
  if (input.title !== undefined && !input.title.trim()) return { error: "Give it a title." };
  const supabase = await createClient();
  const { error } = await supabase.from("items").update(input).eq("id", id);
  if (error) return { error: error.message };

  // Finishing something counts as working on it today.
  if (input.status === "done") {
    const today = localDay(new Date(), await timeZoneOf(supabase)).date;
    const { error: logError } = await supabase
      .from("work_logs")
      .upsert({ item_id: id, day: today }, { onConflict: "item_id,day", ignoreDuplicates: true });
    if (logError) return { error: logError.message };
  }
  return refresh();
}

export async function deleteItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Its dependency edges are removed by the cascade in the schema.
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) return { error: error.message };
  return refresh();
}

// Categories ----------------------------------------------------------------

/** Readable messages for a bad skill type or interval; undefined when fine. */
function skillError(input: Partial<CategoryInput>): string | undefined {
  if (input.skill_type !== undefined && !SKILL_TYPES.includes(input.skill_type)) {
    return "Choose one of the listed skill types.";
  }
  const days = input.resurface_days;
  // undefined: not being changed; null: automatic. Only a number needs checking.
  if (days !== undefined && days !== null && !(Number.isInteger(days) && days >= 1 && days <= 365)) {
    return "The interval must be between 1 and 365 days.";
  }
}

export async function createCategory(input: CategoryInput): Promise<ActionResult & { id?: string }> {
  if (!input.name.trim()) return { error: "Give the category a name." };
  const invalid = skillError(input);
  if (invalid) return { error: invalid };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ ...input, name: input.name.trim() })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { ...refresh(), id: data.id };
}

export async function updateCategory(id: string, input: Partial<CategoryInput>): Promise<ActionResult> {
  if (input.name !== undefined && !input.name.trim()) return { error: "Give the category a name." };
  const invalid = skillError(input);
  if (invalid) return { error: invalid };
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update(input).eq("id", id);
  if (error) return { error: error.message };
  return refresh();
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Its items become uncategorised (on delete set null in the schema).
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  return refresh();
}

// Dependencies --------------------------------------------------------------

export async function addDependency(itemId: string, dependsOnId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: deps, error: loadError } = await supabase
    .from("dependencies")
    .select("item_id, depends_on_id");
  if (loadError) return { error: loadError.message };

  if (wouldCreateCycle(deps, itemId, dependsOnId)) {
    return { error: "That would create a loop: it already depends on this item." };
  }

  const { error } = await supabase
    .from("dependencies")
    .insert({ item_id: itemId, depends_on_id: dependsOnId });
  if (error) return { error: error.message };
  return refresh();
}

export async function removeDependency(itemId: string, dependsOnId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("dependencies")
    .delete()
    .eq("item_id", itemId)
    .eq("depends_on_id", dependsOnId);
  if (error) return { error: error.message };
  return refresh();
}

// Profile ---------------------------------------------------------------------

/** The settings the wizard and settings page edit (not check-in or ordering state). */
export type ProfileInput = Omit<Profile, "last_check_in" | "today_order_date" | "today_order">;

/** Creates the profile on first save, updates it afterwards. */
export async function saveProfile(input: ProfileInput): Promise<ActionResult> {
  const inRange = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
  if (!inRange(input.weekday_minutes, 0, 1440) || !inRange(input.weekend_minutes, 0, 1440)) {
    return { error: "Daily time must be between 0 and 24 hours." };
  }
  if (!inRange(input.session_minutes, 15, 480)) {
    return { error: "A session must be between 15 minutes and 8 hours." };
  }
  if (!input.weekend_days.every((d) => inRange(d, 0, 6))) {
    return { error: "Weekend days must be days of the week." };
  }
  if (!isValidTimeZone(input.timezone)) {
    return { error: `"${input.timezone}" isn't a timezone this app recognises.` };
  }

  const supabase = await createClient();
  // user_id defaults to the signed-in user, so this is "insert mine, or
  // update mine if it exists".
  const { error } = await supabase.from("profiles").upsert(
    {
      weekday_minutes: input.weekday_minutes,
      weekend_minutes: input.weekend_minutes,
      session_minutes: input.session_minutes,
      weekend_days: [...new Set(input.weekend_days)].sort(),
      timezone: input.timezone,
      animate_orbits: input.animate_orbits,
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };

  // On first setup, count yesterday as answered: the first check-in comes
  // tomorrow instead of asking about the day before you started.
  const { error: checkInError } = await supabase
    .from("profiles")
    .update({ last_check_in: yesterdayIn(input.timezone) })
    .eq("user_id", (await userIdOf(supabase)) ?? "")
    .is("last_check_in", null);
  if (checkInError) return { error: checkInError.message };
  return refresh();
}

// Check-in --------------------------------------------------------------------

/** The signed-in user's id. Updates must name a row, even with RLS. */
async function userIdOf(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | undefined> {
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub;
}

/** The user's saved timezone, or UTC before setup. */
async function timeZoneOf(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("profiles").select("timezone").maybeSingle();
  return data?.timezone ?? "UTC";
}

/**
 * Answers "What did you work on yesterday?": logs each item for yesterday
 * and marks the day as asked. An empty list means "Nothing". Yesterday is
 * worked out here from the saved timezone, not taken from the browser.
 */
export async function submitCheckIn(itemIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const day = yesterdayIn(await timeZoneOf(supabase));

  if (itemIds.length > 0) {
    const { error } = await supabase
      .from("work_logs")
      .upsert(
        itemIds.map((item_id) => ({ item_id, day })),
        // Already logged for that day (say, marked done yesterday): keep it.
        { onConflict: "item_id,day", ignoreDuplicates: true },
      );
    if (error) return { error: error.message };
  }

  const userId = (await userIdOf(supabase)) ?? "";
  const { error } = await supabase.from("profiles").update({ last_check_in: day }).eq("user_id", userId);
  if (error) return { error: error.message };

  // Yesterday's plan now has its answer, so it counts as evidence for learning.
  // (No snapshot for that day, say you didn't open the app: nothing to update.)
  const { error: answerError } = await supabase
    .from("plan_snapshots")
    .update({ answered: true })
    .eq("user_id", userId)
    .eq("day", day);
  if (answerError) return { error: answerError.message };

  const afterError = await afterCheckIn();
  if (afterError) return { error: afterError };
  return refresh();
}

/**
 * Once yesterday's answers are in:
 * - saves the plan the user is about to see this morning, so tomorrow's
 *   check-in can be compared with it. Planned with the same data and planner
 *   as Next up. Only the first snapshot of a day is kept: it records what was
 *   suggested, not later changes.
 * - re-runs their backtest and saves its totals, for the admin page's pooled
 *   evaluation. It runs here, in their own session on their own data, so no
 *   one else's history is ever read.
 */
async function afterCheckIn(): Promise<string | undefined> {
  try {
    const [{ items, categories, dependencies }, profile, workLogs, snapshots] = await Promise.all([
      getData(),
      getProfile(),
      getWorkLogs(),
      getPlanSnapshots(),
    ]);
    if (!profile) return;
    const today = localDay(new Date(), profile.timezone);
    const { main } = planRoutes({ items, dependencies, categories, workLogs, snapshots, profile, today });
    const sessions: SnapshotSession[] = (main.days[0]?.sessions ?? []).map((s) => ({
      item_id: s.item.id,
      category_id: s.item.category_id,
    }));

    const supabase = await createClient();
    const { error } = await supabase
      .from("plan_snapshots")
      .upsert({ day: today.date, sessions }, { onConflict: "user_id,day", ignoreDuplicates: true });
    if (error) return error.message;

    // Nothing to save until there's enough history to mean anything.
    const result = backtest({ items, categories, workLogs, snapshots });
    if (!result) return;
    const n = result.predictions.length;
    const evaluation: Evaluation = {
      days: result.days,
      predictions: n,
      model_brier_sum: result.modelScore * n,
      baseline_brier_sum: result.baselineScore * n,
    };
    const { error: evaluationError } = await supabase
      .from("evaluations")
      .upsert({ ...evaluation, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    return evaluationError?.message;
  } catch (error) {
    // The loaders throw on database errors; report it like any other.
    return error instanceof Error ? error.message : "Couldn't save today's plan.";
  }
}

// Today's order -----------------------------------------------------------------

/**
 * Saves the user's own order for today's sessions (item ids, first to last).
 * "Today" is worked out here from the saved timezone; the order is ignored
 * on any other day.
 */
export async function saveTodayOrder(itemIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const today = localDay(new Date(), await timeZoneOf(supabase)).date;
  const { error } = await supabase
    .from("profiles")
    .update({ today_order_date: today, today_order: itemIds })
    .eq("user_id", (await userIdOf(supabase)) ?? "");
  if (error) return { error: error.message };
  return refresh();
}

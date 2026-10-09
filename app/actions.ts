"use server";

import { revalidatePath } from "next/cache";
import { wouldCreateCycle } from "@/lib/graph";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/profile";
import type { CategoryInput, ItemInput, Profile } from "@/lib/types";

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

export async function createCategory(input: CategoryInput): Promise<ActionResult & { id?: string }> {
  if (!input.name.trim()) return { error: "Give the category a name." };
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

/** The settings the wizard and settings page edit (not the check-in state). */
export type ProfileInput = Omit<Profile, "last_check_in">;

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
  return refresh();
}

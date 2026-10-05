"use server";

import { revalidatePath } from "next/cache";
import { wouldCreateCycle } from "@/lib/graph";
import { createClient } from "@/lib/supabase/server";
import type { CategoryInput, ItemInput } from "@/lib/types";

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

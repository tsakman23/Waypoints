import { createClient } from "@/lib/supabase/server";
import type { Category, Dependency, Item } from "@/lib/types";

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
    supabase.from("categories").select("id, name, color").order("name"),
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

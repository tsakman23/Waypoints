import { signOut } from "@/app/auth/actions";
import { ItemList } from "@/components/item-list";
import { Button } from "@/components/ui/button";
import { getData } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: auth }, { items, categories }] = await Promise.all([
    supabase.auth.getClaims(),
    getData(),
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Waypoints</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {auth?.claims.email}
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <ItemList items={items} categories={categories} />
    </main>
  );
}

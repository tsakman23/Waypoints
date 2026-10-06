import { signOut } from "@/app/auth/actions";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/** Header and page frame for every signed-in view. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-semibold">Waypoints</h1>
          <NavLinks />
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {data?.claims.email}
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

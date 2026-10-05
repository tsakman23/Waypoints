import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main className="flex flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-semibold">Waypoints</h1>
      <p className="text-muted-foreground">Signed in as {data?.claims.email}</p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}

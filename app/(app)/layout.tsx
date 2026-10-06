import { signOut } from "@/app/auth/actions";
import { NavLinks } from "@/components/nav-links";
import { createClient } from "@/lib/supabase/server";

/** Floating glass header over every signed-in view. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <>
      <header
        className="fixed top-4 left-1/2 z-50 flex w-[min(94vw,46rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-transparent py-1.5 pr-1.5 pl-5 text-sm shadow-[0_10px_40px_rgb(0_0_0/0.35)] backdrop-blur-xl backdrop-saturate-150"
        style={{
          // A glass fill plus a gradient border: two backgrounds, clipped to padding and border.
          background:
            "linear-gradient(rgb(14 18 48 / 0.55), rgb(14 18 48 / 0.55)) padding-box, linear-gradient(110deg, rgb(139 108 255 / 0.6), rgb(255 255 255 / 0.08) 40%, rgb(62 224 245 / 0.5)) border-box",
        }}
      >
        <span className="mr-1 flex items-center gap-2 font-heading text-[15px] font-bold whitespace-nowrap">
          <span className="size-1.5 rounded-full bg-cyan shadow-[0_0_10px_var(--cyan)]" />
          Waypoints
        </span>
        <NavLinks />
        <div className="ml-auto flex items-center gap-3 whitespace-nowrap text-muted-foreground">
          <span className="hidden truncate md:inline">{data?.claims.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground transition-[background,border-color,transform] duration-200 ease-(--ease-out) hover:-translate-y-px hover:border-violet/50 hover:bg-accent"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-24 pb-12 sm:px-8">{children}</main>
    </>
  );
}

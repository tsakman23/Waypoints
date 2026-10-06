import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase sends the browser back after an OAuth sign-in (Google),
 * with a one-time ?code= to exchange for a session.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect("/");
  }

  // Supabase adds error_description if the user cancelled or something failed.
  redirect(
    "/login?error=" +
      encodeURIComponent(params.get("error_description") ?? "Couldn't sign you in with Google."),
  );
}

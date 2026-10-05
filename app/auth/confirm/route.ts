import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Target of the link in the sign-up confirmation email. The Supabase email
 * template builds that link as
 *   {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
 * where RedirectTo is the emailRedirectTo passed at sign-up (this route).
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect("/");
  }

  redirect("/login?error=" + encodeURIComponent("That confirmation link is invalid or has expired."));
}

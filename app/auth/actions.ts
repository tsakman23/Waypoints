"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

/**
 * Handles the login form. Its two submit buttons send intent=signin or
 * intent=signup, so one action covers both.
 */
export async function authenticate(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const credentials = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const supabase = await createClient();

  if (formData.get("intent") === "signup") {
    // Becomes {{ .RedirectTo }} in the confirmation email template, so the
    // link returns to whichever site (local or deployed) the user signed up on.
    const origin = (await headers()).get("origin");
    const { error } = await supabase.auth.signUp({
      ...credentials,
      options: { emailRedirectTo: `${origin}/auth/confirm` },
    });
    if (error) return { error: error.message };
    return { message: "Check your email for a link to confirm your account." };
  }

  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return { error: error.message };
  redirect("/");
}

/**
 * Starts "Continue with Google": asks Supabase for Google's sign-in page and
 * sends the browser there. Google returns to Supabase, which returns to
 * /auth/callback with a code.
 */
export async function signInWithGoogle() {
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

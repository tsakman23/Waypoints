"use client";

import { useActionState } from "react";
import { authenticate, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    authenticate,
    { error: initialError },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={6}
          required
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" name="intent" value="signin" disabled={pending}>
          Sign in
        </Button>
        <Button type="submit" name="intent" value="signup" variant="outline" disabled={pending}>
          Create account
        </Button>
      </div>
    </form>
  );
}

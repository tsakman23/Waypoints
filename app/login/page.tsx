import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Waypoints</CardTitle>
          <CardDescription>Sign in or create an account.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm initialError={error} />
        </CardContent>
      </Card>
    </main>
  );
}

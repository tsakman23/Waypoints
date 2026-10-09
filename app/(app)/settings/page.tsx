import { SettingsForm } from "@/components/settings-form";
import { getProfile } from "@/lib/data";

export default async function SettingsPage() {
  const profile = await getProfile();
  // No profile yet: the layout is showing the setup wizard instead.
  if (!profile) return null;
  const { last_check_in: _unused, ...settings } = profile;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-wide">Settings</h1>
        <p className="text-sm text-muted-foreground">
          How much time you have, and how the route plans around it.
        </p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}

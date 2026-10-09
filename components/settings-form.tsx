"use client";

import { useState, useTransition } from "react";
import { saveProfile, type ProfileInput } from "@/app/actions";
import { TimeFields, WeekFields } from "@/components/profile-fields";
import { Button } from "@/components/ui/button";

/** Every setting on one screen, starting from the saved profile. */
export function SettingsForm({ initial }: { initial: ProfileInput }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, startTransition] = useTransition();
  const changed = JSON.stringify(value) !== JSON.stringify(initial);

  function save() {
    setStatus({});
    startTransition(async () => {
      const result = await saveProfile(value);
      setStatus(result.error ? { error: result.error } : { saved: true });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="wp-glass flex flex-col gap-4 rounded-2xl p-5">
        <h2 className="font-heading text-sm font-semibold tracking-wider uppercase">Your time</h2>
        <TimeFields value={value} onChange={setValue} />
      </section>
      <section className="wp-glass flex flex-col gap-4 rounded-2xl p-5">
        <h2 className="font-heading text-sm font-semibold tracking-wider uppercase">Your week</h2>
        <WeekFields value={value} onChange={setValue} />
      </section>
      <div className="flex items-center gap-4">
        <Button onClick={save} disabled={pending || !changed}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {status.error && <p className="text-sm text-destructive">{status.error}</p>}
        {status.saved && !changed && <p className="text-sm text-muted-foreground">Saved.</p>}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { saveProfile, type ProfileInput } from "@/app/actions";
import { TimeFields, useDetectedTimeZone, WeekFields } from "@/components/profile-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_PROFILE } from "@/lib/profile";

const STEPS = [
  { title: "Your time", description: "How much time do you want to give your interests each day?" },
  { title: "Your week", description: "When is your weekend, and where are you?" },
];

/**
 * First-run setup, shown by the app layout while the user has no profile.
 * It can't be dismissed: the route planner needs these answers. Saving
 * creates the profile, the layout re-renders without the wizard, and it
 * never shows again.
 */
export function SetupWizard() {
  const { last_check_in: _unused, ...defaults } = DEFAULT_PROFILE;
  const [value, setValue] = useState<ProfileInput>(defaults);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // Start from the device's timezone once it's known.
  const detected = useDetectedTimeZone();
  useEffect(() => {
    if (detected) setValue((v) => ({ ...v, timezone: detected }));
  }, [detected]);

  const last = step === STEPS.length - 1;

  function finish() {
    setError(undefined);
    startTransition(async () => {
      const result = await saveProfile(value);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        // No closing by Escape or by clicking outside: setup must finish.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <span className="text-xs font-semibold tracking-[0.14em] text-cyan uppercase">
            Setup · step {step + 1} of {STEPS.length}
          </span>
          <DialogTitle className="font-heading text-lg tracking-wide">{STEPS[step].title}</DialogTitle>
          <DialogDescription>{STEPS[step].description}</DialogDescription>
        </DialogHeader>

        {step === 0 ? (
          <TimeFields value={value} onChange={setValue} />
        ) : (
          <WeekFields value={value} onChange={setValue} />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="sm:justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {last ? (
            <Button onClick={finish} disabled={pending}>
              {pending ? "Saving…" : "Finish"}
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { submitCheckIn } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CheckIn } from "@/lib/data";
import { cn } from "@/lib/utils";

/** "2026-10-08" → "Thursday 8 October". Noon UTC keeps it on the same date everywhere. */
function readableDay(day: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

/**
 * The daily "What did you work on yesterday?". Shown by the app layout once
 * per day while the user has active items. Answering, even with "Nothing",
 * records the day so it isn't asked again.
 */
export function CheckInDialog({ checkIn }: { checkIn: CheckIn }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function toggle(id: string, on: boolean) {
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function answer(itemIds: string[]) {
    setError(undefined);
    startTransition(async () => {
      const result = await submitCheckIn(itemIds);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <span className="text-xs font-semibold tracking-[0.14em] text-cyan uppercase">
            Daily check-in · {readableDay(checkIn.day)}
          </span>
          <DialogTitle className="font-heading text-lg tracking-wide">
            What did you work on yesterday?
          </DialogTitle>
          <DialogDescription>Tick everything you made progress on.</DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {checkIn.items.map((item) => {
            const on = picked.has(item.id);
            return (
              <li key={item.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 ease-(--ease-out)",
                    on
                      ? "border-violet/60 bg-violet/15 shadow-[0_0_18px_rgb(139_108_255/0.2)]"
                      : "border-transparent hover:bg-accent",
                  )}
                  style={item.color ? ({ "--c": item.color } as React.CSSProperties) : undefined}
                >
                  <Checkbox checked={on} onCheckedChange={(v) => toggle(item.id, v === true)} />
                  {item.color ? <span className="wp-dot" /> : <span className="size-2.5" />}
                  <span className="flex-1">{item.title}</span>
                </label>
              </li>
            );
          })}
        </ul>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => answer([])} disabled={pending}>
            Nothing
          </Button>
          <Button onClick={() => answer([...picked])} disabled={pending || picked.size === 0}>
            {pending ? "Saving…" : `Save${picked.size > 1 ? ` ${picked.size}` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

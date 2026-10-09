"use client";

import { useEffect, useState } from "react";
import type { ProfileInput } from "@/app/actions";
import { TimeZonePicker } from "@/components/timezone-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { sessionsIn } from "@/lib/profile";
import { cn } from "@/lib/utils";

/** Props shared by both field groups: the whole settings object and a way to change it. */
type FieldsProps = {
  value: ProfileInput;
  onChange: (value: ProfileInput) => void;
};

const SESSION_LENGTHS = [30, 45, 60, 90, 120];

/** Monday first, as most calendars show it; values match JavaScript's getDay(). */
const WEEK = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 0, label: "Sun" },
];

/** The browser's timezone, e.g. "Europe/London". Only known after the page loads. */
export function useDetectedTimeZone(): string | null {
  const [zone, setZone] = useState<string | null>(null);
  // Read in an effect, not during render: the server can't know the visitor's
  // zone, and a different value on each side would be a hydration mismatch.
  useEffect(() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  return zone;
}

/** How much time per day, and how long a session is. */
export function TimeFields({ value, onChange }: FieldsProps) {
  const weekdaySessions = sessionsIn(value.weekday_minutes, value.session_minutes);
  const weekendSessions = sessionsIn(value.weekend_minutes, value.session_minutes);
  const plural = (n: number) => `${n} session${n === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <HoursField
          id="weekday-hours"
          label="On a weekday"
          minutes={value.weekday_minutes}
          onChange={(minutes) => onChange({ ...value, weekday_minutes: minutes })}
        />
        <HoursField
          id="weekend-hours"
          label="On a weekend day"
          minutes={value.weekend_minutes}
          onChange={(minutes) => onChange({ ...value, weekend_minutes: minutes })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Session length</Label>
        <Select
          value={String(value.session_minutes)}
          onValueChange={(v) => onChange({ ...value, session_minutes: Number(v) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SESSION_LENGTHS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        That&apos;s <span className="text-foreground">{plural(weekdaySessions)}</span> on weekdays and{" "}
        <span className="text-foreground">{plural(weekendSessions)}</span> at weekends, each on one
        interest.
      </p>
    </div>
  );
}

function HoursField({
  id,
  label,
  minutes,
  onChange,
}: {
  id: string;
  label: string;
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={minutes / 60}
          // Stored as whole minutes; an empty box counts as no time.
          onChange={(e) => onChange(Math.round((Number(e.target.value) || 0) * 60))}
          className="pr-14"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
          hours
        </span>
      </div>
    </div>
  );
}

/** Which days are the weekend, the timezone, and orbit animation. */
export function WeekFields({ value, onChange }: FieldsProps) {
  const detected = useDetectedTimeZone();

  function toggleDay(day: number) {
    const days = value.weekend_days.includes(day)
      ? value.weekend_days.filter((d) => d !== day)
      : [...value.weekend_days, day];
    onChange({ ...value, weekend_days: days });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Weekend days</Label>
        <div className="flex flex-wrap gap-1.5">
          {WEEK.map(({ day, label }) => {
            const on = value.weekend_days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(day)}
                className={cn(
                  "h-9 w-12 cursor-pointer rounded-lg border text-sm font-semibold transition-all duration-200 ease-(--ease-out)",
                  on
                    ? "border-transparent bg-(image:--glow) text-primary-foreground shadow-[0_0_18px_rgb(139_108_255/0.4)]"
                    : "border-border bg-secondary text-muted-foreground hover:-translate-y-0.5 hover:border-cyan/50 hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Timezone</Label>
        <TimeZonePicker
          value={value.timezone}
          detected={detected}
          onChange={(timezone) => onChange({ ...value, timezone })}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="animate-orbits" className="flex flex-col items-start gap-0.5">
          Animate the solar system
          <span className="font-normal text-muted-foreground">Planets orbit their suns. Off keeps them still.</span>
        </Label>
        <Switch
          id="animate-orbits"
          checked={value.animate_orbits}
          onCheckedChange={(animate_orbits) => onChange({ ...value, animate_orbits })}
        />
      </div>
    </div>
  );
}

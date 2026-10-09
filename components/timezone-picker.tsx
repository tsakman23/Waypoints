"use client";

import { useMemo, useState } from "react";
import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Zone = { id: string; city: string; region: string; offset: string; time: string };

/** "Europe/London" → London, Europe, GMT+1, 14:32 (right now). */
function describe(id: string, now: Date): Zone {
  const parts = id.split("/");
  const offset =
    new Intl.DateTimeFormat("en-GB", { timeZone: id, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: id, hour: "2-digit", minute: "2-digit" }).format(now);
  return {
    id,
    city: parts[parts.length - 1].replaceAll("_", " "),
    // "America/Argentina/Salta" → "America · Argentina"; "UTC" → "Other".
    region: parts.length > 1 ? parts.slice(0, -1).join(" · ").replaceAll("_", " ") : "Other",
    offset,
    time,
  };
}

/**
 * The user's timezone, detected automatically by the setup wizard. Shown as
 * a readable line; "Change" opens a searchable list for the rare manual
 * override, grouped by region, with each zone's offset and current time.
 */
export function TimeZonePicker({
  value,
  detected,
  onChange,
}: {
  value: string;
  /** The device's own zone, once known; null on the server and first render. */
  detected: string | null;
  onChange: (zone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // The selected zone, without the clock: a time in server-rendered HTML
  // would differ from the browser's by the time the page hydrates.
  const current = useMemo(() => {
    const { city, region, offset } = describe(value, new Date());
    return { city, region, offset };
  }, [value]);

  // Built when the list opens, so the times shown are current.
  const groups = useMemo(() => {
    if (!open) return [];
    const now = new Date();
    const byRegion = new Map<string, Zone[]>();
    for (const id of Intl.supportedValuesOf("timeZone")) {
      const zone = describe(id, now);
      byRegion.set(zone.region, [...(byRegion.get(zone.region) ?? []), zone]);
    }
    return [...byRegion.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([region, zones]) => ({ region, zones: zones.sort((a, b) => a.city.localeCompare(b.city)) }));
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <Globe className="size-4 shrink-0 text-cyan" />
        <div className="min-w-0 flex-1">
          <span className="font-medium">{current.city}</span>
          <span className="text-muted-foreground">
            {" "}
            · {current.region} · {current.offset}
          </span>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Change
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <Command>
              <CommandInput placeholder="Search city, region or GMT+2…" />
              <CommandList className="max-h-72">
                <CommandEmpty>No timezone found.</CommandEmpty>
                {groups.map(({ region, zones }) => (
                  <CommandGroup key={region} heading={region}>
                    {zones.map((zone) => (
                      <CommandItem
                        key={zone.id}
                        // What the search box matches against.
                        value={`${zone.city} ${zone.region} ${zone.id} ${zone.offset}`}
                        onSelect={() => {
                          onChange(zone.id);
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("size-4", zone.id === value ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1 truncate">{zone.city}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {zone.offset} · {zone.time}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {detected === value && <p className="pl-7 text-xs text-muted-foreground">Detected from this device.</p>}
      {detected && detected !== value && (
        <button
          type="button"
          onClick={() => onChange(detected)}
          className="cursor-pointer self-start pl-7 text-xs text-cyan hover:underline"
        >
          This device is in {describe(detected, new Date()).city}. Switch to it?
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";
import { ItemEditor } from "@/components/item-editor";
import { TodaySortable } from "@/components/today-sortable";
import type { Option, Plan, PlanDay, Session } from "@/lib/planner";
import { reasonFor } from "@/lib/reasons";
import type { Category, Dependency, Item } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROUTE_NAMES = ["Main", "Alt 1", "Alt 2"];

/** "2026-10-10" at offset 0 → { name: "Today", date: "Sat 10 Oct" }; later days → { name: "Monday", date: "12" }. */
function dayLabel(day: PlanDay, offset: number) {
  const at = new Date(`${day.date}T12:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(at);
  if (offset === 0) return { name: "Today", date: format({ weekday: "short", day: "numeric", month: "short" }) };
  return { name: offset === 1 ? "Tomorrow" : format({ weekday: "long" }), date: format({ day: "numeric" }) };
}

export function PlanView({
  plan,
  items,
  categories,
  dependencies,
}: {
  plan: Plan;
  items: Item[];
  categories: Category[];
  dependencies: Dependency[];
}) {
  const [routeIndex, setRouteIndex] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  // The day whose alternatives are showing, if any.
  const [swapOpen, setSwapOpen] = useState<string | null>(null);
  const routes = [plan.main, ...plan.alternatives];
  const route = routes[routeIndex];
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const [today, ...later] = route.days;
  const hasAnything = route.days.some((d) => d.sessions.length > 0);
  const toggleSwap = (date: string) => setSwapOpen((open) => (open === date ? null : date));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-heading text-xl font-bold tracking-wide">Your route</h1>
        {/* Which route to show. */}
        <div role="tablist" aria-label="Routes" className="flex gap-5 text-sm">
          {routes.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={routeIndex === i}
              onClick={() => setRouteIndex(i)}
              className={cn(
                "cursor-pointer border-b-2 pb-1 transition-colors duration-200",
                routeIndex === i ? "border-violet text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {ROUTE_NAMES[i]}
            </button>
          ))}
        </div>
      </div>

      {!hasAnything ? (
        <p className="py-8 text-center text-muted-foreground">
          Nothing to plan: everything is done, parked or waiting on something else.
        </p>
      ) : (
        // The week as stops on one line; today's stop glows.
        <ol className="ml-1.5 flex flex-col gap-9 border-l border-border pl-8">
          <li className="relative flex flex-col gap-3">
            <span className="absolute top-1 -left-[39px] size-[13px] rounded-full bg-cyan shadow-[0_0_0_4px_rgb(62_224_245/0.18),0_0_16px_var(--cyan)]" />
            <DayHeading
              day={today}
              offset={0}
              swapOpen={swapOpen === today.date}
              onSwap={today.alternatives.length > 0 ? () => toggleSwap(today.date) : undefined}
            />
            {today.sessions.length === 0 ? null : (
              <div className="wp-glass overflow-hidden rounded-2xl">
                {routeIndex === 0 ? (
                  // Your plan: drag the grips to choose the order you'll do them in.
                  <TodaySortable
                    sessions={today.sessions}
                    className="flex flex-col divide-y divide-white/6"
                    renderItem={(session, grip) => (
                      <SessionRow session={session} categoriesById={categoriesById} onOpen={setEditing} grip={grip} large />
                    )}
                  />
                ) : (
                  <ol className="flex flex-col divide-y divide-white/6">
                    {today.sessions.map((session, i) => (
                      <li key={i}>
                        <SessionRow session={session} categoriesById={categoriesById} onOpen={setEditing} large />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
            {swapOpen === today.date && (
              <Alternatives options={today.alternatives} categoriesById={categoriesById} onOpen={setEditing} />
            )}
          </li>

          {later.map((day, d) => (
            <li key={day.date} className="relative flex flex-col gap-1">
              <span className="absolute top-1.5 -left-[37px] size-[9px] rounded-full border border-muted-foreground/60 bg-background" />
              <DayHeading
                day={day}
                offset={d + 1}
                swapOpen={swapOpen === day.date}
                onSwap={day.alternatives.length > 0 ? () => toggleSwap(day.date) : undefined}
              />
              {day.sessions.map((session, i) => (
                <SessionRow key={i} session={session} categoriesById={categoriesById} onOpen={setEditing} />
              ))}
              {swapOpen === day.date && (
                <Alternatives options={day.alternatives} categoriesById={categoriesById} onOpen={setEditing} />
              )}
            </li>
          ))}
        </ol>
      )}

      {editing && (
        <ItemEditor
          key={editing}
          item={items.find((i) => i.id === editing)}
          items={items}
          categories={categories}
          dependencies={dependencies}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** A day's name and date, "Rest" when nothing's planned, and a button to see its alternatives. */
function DayHeading({
  day,
  offset,
  swapOpen,
  onSwap,
}: {
  day: PlanDay;
  offset: number;
  swapOpen: boolean;
  onSwap?: () => void;
}) {
  const { name, date } = dayLabel(day, offset);
  const rest = day.sessions.length === 0;
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <h2 className={cn("text-sm font-semibold", offset === 0 ? "text-cyan" : rest && "text-muted-foreground")}>
        {name} <span className="font-normal text-muted-foreground">· {date}</span>
        {rest && <span className="font-normal text-muted-foreground"> · Rest</span>}
      </h2>
      {onSwap && (
        <button
          type="button"
          onClick={onSwap}
          aria-expanded={swapOpen}
          aria-label={`Other options for ${name.toLowerCase()}`}
          className={cn(
            "group relative grid size-11 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            swapOpen && "bg-secondary text-foreground",
          )}
        >
          <Shuffle className="size-4" />
          {/* What the button does, shown on hover or keyboard focus. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 rounded-lg border border-border bg-popover px-2.5 py-1 text-xs whitespace-nowrap text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {swapOpen ? "Hide other options" : "See other options"}
          </span>
        </button>
      )}
    </div>
  );
}

type RowProps = {
  session: Session;
  categoriesById: Map<string, Category>;
  onOpen: (id: string) => void;
  /** Drag handle, when the row can be reordered. */
  grip?: React.ReactNode;
  /** Today's rows: bigger, with the category named. */
  large?: boolean;
};

/**
 * One session: a category dot, its title, and on the right "Due" when its interest
 * is overdue. Today's rows say why in a few words when there's a reason (what the
 * check-ins have taught the planner), and otherwise name the category.
 */
function SessionRow({ session, categoriesById, onOpen, grip, large = false }: RowProps) {
  const category = session.item.category_id ? categoriesById.get(session.item.category_id) : undefined;
  return (
    <div
      className={cn("wp-row flex items-center gap-2", large ? "bg-[rgb(14_18_50)] px-3" : "-mx-2 rounded-lg px-2")}
      style={category ? ({ "--c": category.color } as React.CSSProperties) : undefined}
    >
      {grip}
      <button
        type="button"
        onClick={() => onOpen(session.item.id)}
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left",
          large ? "py-4 text-[17px] font-medium" : "py-1.5 text-[15px]",
          large && !grip && "pl-2",
        )}
      >
        {category ? <span className={cn("wp-dot", !large && "size-2")} /> : <span className="size-2.5 flex-none" />}
        <span className="min-w-0 flex-1 truncate">{session.item.title}</span>
        {large ? (
          <span className={cn("flex-none text-xs", session.due ? "text-amber-300" : "text-muted-foreground")}>
            {reasonFor(session, category?.name) ?? category?.name}
          </span>
        ) : (
          session.due && <span className="flex-none text-xs text-amber-300">Due</span>
        )}
      </button>
      {large && <span className="w-1" />}
    </div>
  );
}

/** A day's alternatives, shown when its swap button is open; each opens its item. */
function Alternatives({
  options,
  categoriesById,
  onOpen,
}: {
  options: Option[];
  categoriesById: Map<string, Category>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      Or instead:
      {options.map((o) => {
        const category = o.item.category_id ? categoriesById.get(o.item.category_id) : undefined;
        return (
          <button
            key={o.item.id}
            type="button"
            onClick={() => onOpen(o.item.id)}
            style={category ? ({ "--c": category.color } as React.CSSProperties) : undefined}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-foreground transition-colors duration-200 hover:border-violet/50"
          >
            {category && <span className="wp-dot size-2" />}
            {o.item.title}
          </button>
        );
      })}
    </div>
  );
}

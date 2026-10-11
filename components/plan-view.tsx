"use client";

import { useState } from "react";
import { ItemEditor } from "@/components/item-editor";
import { StatusBadge } from "@/components/status-badge";
import type { Option, Plan, PlanDay, Session } from "@/lib/planner";
import type { Category, Dependency, Item } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROUTE_NAMES = ["Main route", "Alternative 1", "Alternative 2"];

/** "2026-10-10" at offset 0 → "Today · Saturday 10 October". */
function dayLabel(day: PlanDay, offset: number) {
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${day.date}T12:00:00Z`),
  );
  return offset === 0 ? `Today · ${date}` : offset === 1 ? `Tomorrow · ${date}` : date;
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
  const routes = [plan.main, ...plan.alternatives];
  const route = routes[routeIndex];
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const [today, ...later] = route.days;
  const hasAnything = route.days.some((d) => d.sessions.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-wide">Your week</h1>
          <p className="text-sm text-muted-foreground">
            One interest per session, rotating so nothing goes stale. Click anything to open it.
          </p>
        </div>
        {/* Which route to show. */}
        <div role="tablist" aria-label="Routes" className="wp-glass flex rounded-full p-1 text-sm">
          {routes.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={routeIndex === i}
              onClick={() => setRouteIndex(i)}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 transition-all duration-200 ease-(--ease-out)",
                routeIndex === i
                  ? "bg-violet/25 text-foreground shadow-[inset_0_0_0_1px_rgb(139_108_255/0.45),0_0_18px_rgb(139_108_255/0.3)]"
                  : "text-muted-foreground hover:text-foreground",
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
        <>
          {/* Today: the sessions as full cards. */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-cyan uppercase">{dayLabel(today, 0)}</h2>
            {today.sessions.length === 0 ? (
              <RestDay />
            ) : (
              today.sessions.map((session, i) => (
                <SessionCard
                  key={i}
                  session={session}
                  categoriesById={categoriesById}
                  onOpen={setEditing}
                />
              ))
            )}
          </section>

          {/* The rest of the week: compact rows. */}
          <section className="wp-glass flex flex-col rounded-2xl p-2">
            {later.map((day, d) => (
              <div key={day.date} className="flex flex-col gap-1 px-2 py-2">
                <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {dayLabel(day, d + 1)}
                </h2>
                {day.sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70">Rest day</p>
                ) : (
                  day.sessions.map((session, i) => (
                    <SessionRow key={i} session={session} categoriesById={categoriesById} onOpen={setEditing} />
                  ))
                )}
              </div>
            ))}
          </section>
        </>
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

type CardProps = {
  session: Session;
  categoriesById: Map<string, Category>;
  onOpen: (id: string) => void;
};

/** A session today: the pick in full, with tags and the alternatives. */
function SessionCard({ session, categoriesById, onOpen }: CardProps) {
  const category = session.item.category_id ? categoriesById.get(session.item.category_id) : undefined;
  return (
    <div
      className="wp-glass wp-card-hover flex flex-col gap-3 rounded-2xl p-4"
      style={category ? ({ "--c": category.color } as React.CSSProperties) : undefined}
    >
      <button type="button" onClick={() => onOpen(session.item.id)} className="flex cursor-pointer flex-col gap-1.5 text-left">
        <span className="font-heading text-base font-semibold tracking-wide">{session.item.title}</span>
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {category && (
            <span className="inline-flex items-center gap-1.5">
              <span className="wp-dot" />
              {category.name}
            </span>
          )}
          <StatusBadge status={session.item.status} />
          <Tags option={session} />
        </span>
      </button>
      <Alternatives options={session.alternatives} categoriesById={categoriesById} onOpen={onOpen} />
    </div>
  );
}

/** A session later in the week: one line. */
function SessionRow({ session, categoriesById, onOpen }: CardProps) {
  const category = session.item.category_id ? categoriesById.get(session.item.category_id) : undefined;
  return (
    <div
      className="wp-row flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5"
      style={category ? ({ "--c": category.color } as React.CSSProperties) : undefined}
    >
      <button type="button" onClick={() => onOpen(session.item.id)} className="flex cursor-pointer items-center gap-2 text-left">
        {category ? <span className="wp-dot" /> : <span className="size-2.5" />}
        <span>{session.item.title}</span>
      </button>
      <Tags option={session} />
      <span className="ml-auto">
        <Alternatives options={session.alternatives} categoriesById={categoriesById} onOpen={onOpen} compact />
      </span>
    </div>
  );
}

/** Small reasons a session was chosen. */
function Tags({ option }: { option: Option }) {
  return (
    <>
      {option.continuing && (
        <span className="rounded-full border border-cyan/40 px-2 text-xs text-cyan">continuing</span>
      )}
      {option.due && (
        <span className="rounded-full border border-amber-300/40 px-2 text-xs text-amber-200">due</span>
      )}
    </>
  );
}

/** "or" chips for the session's alternatives, each opening its item. */
function Alternatives({
  options,
  categoriesById,
  onOpen,
  compact = false,
}: {
  options: Option[];
  categoriesById: Map<string, Category>;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", !compact && "text-sm")}>
      or
      {options.map((o) => {
        const category = o.item.category_id ? categoriesById.get(o.item.category_id) : undefined;
        return (
          <button
            key={o.item.id}
            type="button"
            onClick={() => onOpen(o.item.id)}
            style={category ? ({ "--c": category.color } as React.CSSProperties) : undefined}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary px-2 py-0.5 text-foreground transition-all duration-200 ease-(--ease-out) hover:-translate-y-px hover:border-violet/50"
          >
            {category && <span className="wp-dot size-2" />}
            {o.item.title}
          </button>
        );
      })}
    </span>
  );
}

function RestDay() {
  return <p className="wp-glass rounded-2xl p-4 text-sm text-muted-foreground">Rest day. Nothing planned.</p>;
}

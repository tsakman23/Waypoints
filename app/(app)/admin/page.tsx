import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pool } from "@/lib/backtest";
import { getAdminOverview, isAdmin } from "@/lib/data";
import { addDays } from "@/lib/profile";
import type { AdminUserRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

const percent = (fraction: number) => `${Math.round(Math.abs(fraction) * 100)}%`;

/**
 * Pooled planner accuracy and activity across all users, anonymised. Only
 * admins get here; to anyone else the page doesn't exist.
 */
export default async function AdminPage() {
  if (!(await isAdmin())) notFound();
  const rows = await getAdminOverview();
  // Demo and test accounts are listed but never counted: their history is made up.
  const counted = rows.filter((r) => !r.excluded);
  const pooled = pool(counted);
  // The database works in UTC, so "this week" does too.
  const weekAgo = addDays(new Date().toISOString().slice(0, 10), -7);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-wide">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Anonymised: score totals and activity dates only, never titles, notes or emails. Excluded accounts
          (demo and test) are listed but left out of every number.
        </p>
      </div>

      <section className="wp-glass flex flex-col gap-2 rounded-2xl p-5 text-sm">
        <h2 className="font-heading font-bold tracking-wide">Planner accuracy, everyone together</h2>
        {pooled ? (
          <>
            <p className="text-muted-foreground">
              Across {pooled.users} user{pooled.users === 1 ? "" : "s"} and {pooled.predictions} predictions, the
              model was {percent(pooled.improvement)} {pooled.improvement > 0 ? "more" : "less"} accurate than guessing
              each person&apos;s average.
            </p>
            <p className="text-xs text-muted-foreground/80">
              Brier score {pooled.modelScore.toFixed(3)} against {pooled.baselineScore.toFixed(3)}; lower is better.
              Each prediction counts once, whoever made it.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">No one has enough history for a backtest yet.</p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Have checked in" value={counted.length} />
        <Stat label="Active this week" value={counted.filter((r) => r.last_answered >= weekAgo).length} />
        <Stat label="Evaluated" value={counted.filter((r) => r.predictions > 0).length} />
      </div>

      {rows.length > 0 && <UserTable rows={rows} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="wp-glass flex flex-col gap-1 rounded-2xl p-4">
      {/* The body font: Orbitron's zero is a slashed square that reads like "Ø". */}
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** One row per user, most recently active first. */
function UserTable({ rows }: { rows: AdminUserRow[] }) {
  return (
    <div className="wp-glass overflow-x-auto rounded-2xl">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 text-right font-medium">Days answered</th>
            <th className="px-4 py-3 font-medium">Last</th>
            <th className="px-4 py-3 text-right font-medium">Streak</th>
            <th className="px-4 py-3 text-right font-medium">Predictions</th>
            <th className="px-4 py-3 text-right font-medium">Model vs average</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => {
            const own = pool([r]);
            return (
              <tr key={r.label} className={cn("border-t border-border", r.excluded && "opacity-50")}>
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                  {r.label}
                  {r.excluded && <span className="ml-2 font-sans text-muted-foreground">excluded</span>}
                </td>
                <td className="px-4 py-3 text-right">{r.answered_days}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.last_answered}</td>
                <td className="px-4 py-3 text-right">{r.current_streak}</td>
                <td className="px-4 py-3 text-right">{r.predictions || "—"}</td>
                <td className="px-4 py-3 text-right">
                  {own ? `${own.improvement > 0 ? "+" : "−"}${percent(own.improvement)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

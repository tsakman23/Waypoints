import { SettingsForm } from "@/components/settings-form";
import { backtest } from "@/lib/backtest";
import { getData, getPlanSnapshots, getProfile, getWorkLogs } from "@/lib/data";
import { LEARN } from "@/lib/learning";

export default async function SettingsPage() {
  const [profile, { items, categories }, workLogs, snapshots] = await Promise.all([
    getProfile(),
    getData(),
    getWorkLogs(),
    getPlanSnapshots(),
  ]);
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
      <Accuracy
        result={backtest({ items, categories, workLogs, snapshots })}
        answeredDays={snapshots.filter((s) => s.answered).length}
      />
    </div>
  );
}

/**
 * How well the learning predicts you: the walk-forward backtest against
 * guessing your average, in one sentence, or how much more history it needs.
 */
function Accuracy({ result, answeredDays }: { result: ReturnType<typeof backtest>; answeredDays: number }) {
  const percent = (fraction: number) => `${Math.round(Math.abs(fraction) * 100)}%`;
  return (
    <section className="wp-glass flex flex-col gap-2 rounded-2xl p-5 text-sm">
      <h2 className="font-heading font-bold tracking-wide">How well the planner knows you</h2>
      {result ? (
        <>
          <p className="text-muted-foreground">
            Over {result.days} days and {result.predictions.length} planned sessions, the planner&apos;s predictions of
            what you&apos;d do were{" "}
            {result.improvement > 0
              ? `${percent(result.improvement)} more accurate than`
              : `${percent(result.improvement)} less accurate than`}{" "}
            guessing your average.
          </p>
          <p className="text-xs text-muted-foreground/80">
            Brier score {result.modelScore.toFixed(3)} against {result.baselineScore.toFixed(3)}; lower is better. Each
            day is predicted only from the days before it.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">
          Not enough history yet: {answeredDays} of {LEARN.backtestMinDays} check-ins. After that, this shows how well
          the planner predicts what you&apos;ll actually do.
        </p>
      )}
    </section>
  );
}

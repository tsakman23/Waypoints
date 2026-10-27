import { LEARN, learnPreferences, preferenceOf, type LearningInput } from "./learning.ts";
import type { Evaluation } from "./types.ts";

// Does the learning actually predict you? A walk-forward backtest: replay the
// answered days in order, and before each one, train the model only on the
// days before it. Predict, for every item planned that day, the chance you'll
// do it, then check against what you logged. A baseline predicts your overall
// rate (from the same past days) for everything. Both are scored with the
// Brier score, the mean of (prediction − outcome)²: 0 is perfect, and always
// guessing 0.5 scores 0.25.

/** One prediction: an item planned on a day, what each forecaster said, and what happened. */
export type Prediction = {
  day: string;
  itemId: string;
  /** The model's predicted chance you'd do it. */
  model: number;
  /** The baseline's: your overall rate so far. */
  baseline: number;
  done: boolean;
};

export type Backtest = {
  /** Answered days replayed. */
  days: number;
  predictions: Prediction[];
  /** Brier scores; lower is better. */
  modelScore: number;
  baselineScore: number;
  /** How much lower the model's score is than the baseline's, as a fraction: 0.2 is 20% better. */
  improvement: number;
};

const brier = (p: number, done: boolean) => (p - (done ? 1 : 0)) ** 2;

/**
 * Replays the answered days oldest first. Returns null with fewer than
 * LEARN.backtestMinDays answered days: too little to mean anything.
 */
export function backtest({ items, categories, workLogs, snapshots }: Omit<LearningInput, "today">): Backtest | null {
  const itemsById = new Map(items.map((i) => [i.id, i]));
  // Oldest first; dates as YYYY-MM-DD sort correctly as strings.
  const answered = snapshots.filter((s) => s.answered).sort((a, b) => a.day.localeCompare(b.day));
  if (answered.length < LEARN.backtestMinDays) return null;

  const predictions: Prediction[] = [];
  for (const snapshot of answered) {
    // Train on the past only: logs and snapshots from before this day.
    const prefs = learnPreferences({
      items,
      categories,
      workLogs: workLogs.filter((l) => l.day < snapshot.day),
      snapshots: answered.filter((s) => s.day < snapshot.day),
      today: snapshot.day,
    });
    const done = new Set(workLogs.filter((l) => l.day === snapshot.day).map((l) => l.item_id));
    // Each planned item once, in plan order, skipping items deleted since.
    const planned = [...new Set(snapshot.sessions.map((s) => s.item_id))].filter((id) => itemsById.has(id));
    for (const itemId of planned) {
      predictions.push({
        day: snapshot.day,
        itemId,
        model: preferenceOf(prefs, itemsById.get(itemId)!).probability,
        baseline: prefs.overall,
        done: done.has(itemId),
      });
    }
  }
  if (predictions.length === 0) return null;

  const mean = (score: (p: Prediction) => number) => predictions.reduce((sum, p) => sum + score(p), 0) / predictions.length;
  const modelScore = mean((p) => brier(p.model, p.done));
  const baselineScore = mean((p) => brier(p.baseline, p.done));
  return {
    days: answered.length,
    predictions,
    modelScore,
    baselineScore,
    improvement: baselineScore === 0 ? 0 : 1 - modelScore / baselineScore,
  };
}

export type Pooled = {
  /** Users with an evaluation. */
  users: number;
  predictions: number;
  /** Brier scores over every prediction from every user; lower is better. */
  modelScore: number;
  baselineScore: number;
  /** How much lower the model's score is than the baseline's, as a fraction. */
  improvement: number;
};

/**
 * Everyone's backtests as one: total Brier over total predictions, so each
 * prediction counts once, whoever made it. (Averaging per-user scores would
 * let a user with 5 predictions weigh as much as one with 500.) Null when
 * there's nothing to pool.
 */
export function pool(evaluations: Evaluation[]): Pooled | null {
  const counted = evaluations.filter((e) => e.predictions > 0);
  const predictions = counted.reduce((sum, e) => sum + e.predictions, 0);
  if (predictions === 0) return null;
  const modelScore = counted.reduce((sum, e) => sum + e.model_brier_sum, 0) / predictions;
  const baselineScore = counted.reduce((sum, e) => sum + e.baseline_brier_sum, 0) / predictions;
  return {
    users: counted.length,
    predictions,
    modelScore,
    baselineScore,
    improvement: baselineScore === 0 ? 0 : 1 - modelScore / baselineScore,
  };
}

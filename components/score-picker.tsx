import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Score } from "@/lib/types";

const SCORES: Score[] = [1, 2, 3, 4, 5];

/** A row of five buttons for picking a 1–5 score. */
export function ScorePicker({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: Score;
  onChange: (value: Score) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label} <span className="font-normal text-muted-foreground">{hint}</span>
      </Label>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={score === value}
            onClick={() => onChange(score)}
            className={cn(
              "size-8 rounded-md border text-sm tabular-nums transition-colors",
              score === value
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

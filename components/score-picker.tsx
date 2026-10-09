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
              "size-9 cursor-pointer rounded-lg border text-sm font-semibold tabular-nums transition-all duration-200 ease-(--ease-out)",
              score === value
                ? "border-transparent bg-(image:--glow) text-primary-foreground shadow-[0_0_20px_rgb(139_108_255/0.45)]"
                : "border-border bg-secondary text-muted-foreground hover:-translate-y-0.5 hover:border-cyan/50 hover:text-foreground hover:shadow-[0_0_16px_rgb(62_224_245/0.25)]",
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

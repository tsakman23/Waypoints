import { LEARN } from "./learning.ts";
import type { Option } from "./planner.ts";

/**
 * One short reason for a planned session, or undefined when there's nothing
 * worth saying. At most one, strongest first: due (with how often you really
 * return, once that's learned), then the item's own follow-through, then its
 * category's.
 */
export function reasonFor(option: Option, categoryName: string | undefined): string | undefined {
  const { due, interval, preference } = option;
  if (due) {
    const learned = interval && !interval.handSet && interval.weight >= LEARN.intervalReasonWeight;
    return learned && categoryName ? `Due · back to ${categoryName} about every ${interval.days} days` : "Due";
  }
  const { multiplier, evidence } = preference;
  if (evidence === "item" && multiplier <= LEARN.skipReasonBelow) return "You often skip this";
  if (evidence === "item" && multiplier >= LEARN.keenReasonAbove) return "You usually do this";
  if (evidence === "category" && multiplier <= LEARN.skipReasonBelow && categoryName) {
    return `You often skip ${categoryName}`;
  }
}

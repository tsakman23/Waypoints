import type { SkillType } from "./types.ts";

export type SkillPreset = {
  label: string;
  /** Default days before an untouched interest is brought back into the route. */
  resurfaceDays: number;
};

/**
 * Defaults per skill type, from the route research (see the "Waypoints Route
 * Research" write-up). They are starting points extrapolated from lab,
 * training and athlete studies, not validated for hobbies; every category
 * can override its interval.
 */
export const SKILL_PRESETS: Record<SkillType, SkillPreset> = {
  // Endurance drops measurably after 2–3 weeks off (Coyle et al. 1984);
  // one hard session a week maintains strength (Bickel et al. 2011).
  fitness: { label: "Fitness", resurfaceDays: 7 },
  // Spaced practice beats massed (Cepeda et al. 2006); learners need
  // refreshers every few weeks (Bahrick et al. 1993).
  language: { label: "Language", resurfaceDays: 21 },
  // Cognitive skills lose about 0.08 SD a month unused (Tatel & Ackerman 2025).
  technical: { label: "Technical", resurfaceDays: 28 },
  // Motor skills decay slowly; fine accuracy and fluency go first.
  instrument: { label: "Instrument", resurfaceDays: 42 },
  // No direct research; a middle value.
  creative: { label: "Creative", resurfaceDays: 28 },
  // General default for anything without a closer match.
  other: { label: "Other", resurfaceDays: 28 },
};

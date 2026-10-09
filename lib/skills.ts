import type { SkillType } from "./types.ts";

export type SkillPreset = {
  label: string;
  /** Default days before an untouched interest is brought back into the route. */
  resurfaceDays: number;
  /** Why that number, in a sentence the settings UI can show. */
  basis: string;
};

/**
 * Defaults per skill type, from the route research (see the "Waypoints Route
 * Research" write-up). They are starting points extrapolated from lab,
 * training and athlete studies, not validated for hobbies; every category
 * can override its interval.
 */
export const SKILL_PRESETS: Record<SkillType, SkillPreset> = {
  fitness: {
    label: "Fitness",
    resurfaceDays: 7,
    basis: "Endurance drops measurably after 2–3 weeks off; one hard session a week maintains strength.",
  },
  language: {
    label: "Language",
    resurfaceDays: 21,
    basis: "Spaced practice beats cramming; learners need refreshers every few weeks.",
  },
  technical: {
    label: "Technical",
    resurfaceDays: 28,
    basis: "Cognitive skills lose detail at about 0.08 SD a month without practice.",
  },
  instrument: {
    label: "Instrument",
    resurfaceDays: 42,
    basis: "Motor skills decay slowly; fine accuracy and fluency go first.",
  },
  creative: {
    label: "Creative",
    resurfaceDays: 28,
    basis: "No direct research; a middle value.",
  },
  other: {
    label: "Other",
    resurfaceDays: 28,
    basis: "General default for anything without a closer match.",
  },
};

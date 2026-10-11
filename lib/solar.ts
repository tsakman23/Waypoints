import { isAvailable, prerequisitesOf } from "./graph.ts";
import { dependentsOf } from "./graph.ts";
import { scoreOf } from "./scoring.ts";
import type { Category, Dependency, Item } from "./types.ts";

// The solar-system layout: every interest is a sun, its items are planets
// on elliptical orbits. Pure maths with no rendering, so it can be tested;
// components/solar-system draws whatever this works out.
// Units are three.js world units; times are seconds.

export const SOLAR = {
  sunRadius: 1.6,
  /** Distance from the sun to the first orbit, and between orbits. */
  firstOrbit: 4,
  orbitSpacing: 2.2,
  /** Extra space between availability bands (available / locked / parked / done). */
  bandGap: 1.2,
  /** How long the innermost orbit takes, in seconds; outer orbits follow Kepler. */
  innerPeriod: 60,
  /** Space kept between neighbouring systems. */
  systemGap: 6,
};

export type Tier = "available" | "locked" | "parked" | "done";
const TIER_ORDER: Tier[] = ["available", "locked", "parked", "done"];

export type Orbit = {
  /** Semi-major axis: half the ellipse's long diameter. */
  a: number;
  /** Eccentricity: 0 is a circle, towards 1 a long thin ellipse. */
  e: number;
  /** Seconds for one full orbit. */
  period: number;
  /** Where in its orbit the planet starts, 0–1. */
  phase: number;
  /** Tilt of the orbit, in radians, and the direction it tilts towards. */
  inclination: number;
  node: number;
};

export type Planet = {
  id: string;
  title: string;
  tier: Tier;
  /** Planet radius in world units, from its score. */
  radius: number;
  orbit: Orbit;
  /** Titles of unfinished prerequisites; empty unless locked. */
  lockedBy: string[];
};

export type SolarSystem = {
  /** Category id, or "" for uncategorised items. */
  id: string;
  name: string;
  color: string;
  /** Where the sun sits, on the galaxy's flat plane. */
  position: [number, number];
  /** Radius of the outermost orbit, used to keep systems apart. */
  radius: number;
  planets: Planet[];
};

// Kepler ------------------------------------------------------------------------

/**
 * Kepler's third law: a planet's year grows with its orbit to the power 1.5.
 * An orbit 4× wider takes 8× as long.
 */
export function periodFor(a: number): number {
  return SOLAR.innerPeriod * (a / SOLAR.firstOrbit) ** 1.5;
}

/**
 * Solve Kepler's equation E − e·sin(E) = M for E (the "eccentric anomaly")
 * with Newton's method: start from a guess and improve it a few times.
 */
function eccentricAnomaly(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

/**
 * Where a planet is, relative to its sun, `t` seconds in. The sun sits at
 * one focus of the ellipse, so the planet speeds up as it swings close
 * (perihelion) and slows down far out (aphelion). Returns [x, y, z] with y up.
 */
export function orbitPosition(orbit: Orbit, t: number): [number, number, number] {
  const { a, e, period, phase, inclination, node } = orbit;
  const M = 2 * Math.PI * (t / period + phase); // mean anomaly: steady angle through the year
  const E = eccentricAnomaly(M, e);
  const b = a * Math.sqrt(1 - e * e); // semi-minor axis
  // Position in the orbit's own plane, measured from the sun (the focus).
  const px = a * (Math.cos(E) - e);
  const pz = b * Math.sin(E);
  // Tilt the plane by `inclination` around an axis at angle `node`.
  const along = px * Math.cos(node) + pz * Math.sin(node);
  const across = -px * Math.sin(node) + pz * Math.cos(node);
  return [
    along * Math.cos(node) - across * Math.cos(inclination) * Math.sin(node),
    across * Math.sin(inclination),
    along * Math.sin(node) + across * Math.cos(inclination) * Math.cos(node),
  ];
}

// Layout -------------------------------------------------------------------------

/** A stable number from 0 to 1 for a string, so layouts don't reshuffle. */
function hashUnit(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Score → planet radius; square root so a few big scores don't dominate. */
function radiusFor(score: number): number {
  return Math.min(1.1, Math.max(0.4, 0.3 + 0.18 * Math.sqrt(score)));
}

function tierOf(item: Item, itemsById: Map<string, Item>, prereqs: Map<string, string[]>): Tier {
  if (item.status === "done") return "done";
  if (!isAvailable(item, itemsById, prereqs)) return "locked";
  if (item.status === "parked") return "parked";
  return "available";
}

/**
 * Lay out one system per interest: planets ordered by availability band,
 * then by score, each band on its own run of orbits; suns on a spiral far
 * enough apart that no two systems overlap.
 */
export function layoutGalaxy(items: Item[], categories: Category[], dependencies: Dependency[]): SolarSystem[] {
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const prereqs = prerequisitesOf(dependencies);
  const dependents = dependentsOf(dependencies);

  const groups: { id: string; name: string; color: string; items: Item[] }[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    items: items.filter((i) => i.category_id === c.id),
  }));
  const loose = items.filter((i) => !i.category_id || !categories.some((c) => c.id === i.category_id));
  if (loose.length > 0) groups.push({ id: "", name: "Uncategorised", color: "#9aa3c7", items: loose });

  const systems = groups
    .filter((g) => g.items.length > 0)
    .map((group) => {
      const rated = group.items.map((item) => ({
        item,
        tier: tierOf(item, itemsById, prereqs),
        score: scoreOf(item, itemsById, dependents).score,
      }));
      rated.sort(
        (x, y) =>
          TIER_ORDER.indexOf(x.tier) - TIER_ORDER.indexOf(y.tier) ||
          y.score - x.score ||
          x.item.title.localeCompare(y.item.title),
      );

      let a = SOLAR.firstOrbit - SOLAR.orbitSpacing;
      let previousTier: Tier | undefined;
      const planets: Planet[] = rated.map(({ item, tier, score }) => {
        a += SOLAR.orbitSpacing + (previousTier && tier !== previousTier ? SOLAR.bandGap : 0);
        previousTier = tier;
        return {
          id: item.id,
          title: item.title,
          tier,
          radius: tier === "done" ? 0.3 : radiusFor(score),
          orbit: {
            a,
            e: 0.04 + 0.16 * hashUnit(item.id, 1),
            period: periodFor(a),
            phase: hashUnit(item.id, 2),
            inclination: (hashUnit(item.id, 3) - 0.5) * 0.25,
            node: hashUnit(item.id, 4) * Math.PI * 2,
          },
          lockedBy:
            tier === "locked"
              ? (prereqs.get(item.id) ?? [])
                  .map((id) => itemsById.get(id))
                  .filter((p): p is Item => p !== undefined && p.status !== "done")
                  .map((p) => p.title)
              : [],
        };
      });
      // The farthest a planet gets: aphelion of the outermost orbit.
      const radius = Math.max(...planets.map((p) => p.orbit.a * (1 + p.orbit.e)));
      return { id: group.id, name: group.name, color: group.color, radius, planets, position: [0, 0] as [number, number] };
    });

  placeOnSpiral(systems);
  return systems;
}

/**
 * Put suns on a golden-angle spiral, pushing each outwards until it clears
 * every system already placed.
 */
function placeOnSpiral(systems: SolarSystem[]) {
  const golden = Math.PI * (3 - Math.sqrt(5)); // ~137.5°, spreads points evenly
  systems.forEach((system, i) => {
    if (i === 0) return; // the first sun sits at the centre
    let distance = 0;
    const angle = i * golden;
    const clear = () =>
      systems
        .slice(0, i)
        .every(
          (other) =>
            Math.hypot(Math.cos(angle) * distance - other.position[0], Math.sin(angle) * distance - other.position[1]) >=
            system.radius + other.radius + SOLAR.systemGap,
        );
    while (!clear()) distance += 1;
    system.position = [Math.cos(angle) * distance, Math.sin(angle) * distance];
  });
}

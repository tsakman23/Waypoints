import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { Dependency } from "./types.ts";

/** One thing to place. Boxes in the same `group` (category) drift together. */
export type Box = { id: string; width: number; height: number; group: string };

/** Horizontal distance per step of a dependency chain. */
const STEP = 260;
/** Vertical distance between category regions. */
const GROUP_GAP = 300;
const TICKS = 300;

type SimNode = SimulationNodeDatum & { id: string; radius: number; depth: number; groupY: number };

/**
 * A constellation layout: a small physics simulation where every box pushes
 * the others away, dependencies pull their two ends together like springs,
 * each category drifts towards its own band of the sky, and a gentle pull
 * keeps prerequisites to the left of what they unlock.
 *
 * Deterministic: d3-force seeds its own randomness and starting positions,
 * so the same input always gives the same picture. Returns each box's
 * top-left corner, which is what React Flow expects (the simulation works
 * with centres).
 */
export function layoutGraph(
  boxes: Box[],
  deps: Dependency[],
): Map<string, { x: number; y: number }> {
  const depths = chainDepths(boxes, deps);
  const groups = [...new Set(boxes.map((b) => b.group))];
  // Spread the category bands around the middle: 0, +1, -1, +2, -2, ...
  const bandOf = (group: string) => {
    const i = groups.indexOf(group);
    return (i % 2 === 0 ? i / 2 : -(i + 1) / 2) * GROUP_GAP;
  };

  const nodes: SimNode[] = boxes.map((b) => ({
    id: b.id,
    // Half the box's longer side, plus breathing room, so labels never touch.
    radius: Math.max(b.width, b.height) / 2 + 14,
    depth: depths.get(b.id) ?? 0,
    groupY: bandOf(b.group),
  }));
  const links: SimulationLinkDatum<SimNode>[] = deps.map((d) => ({
    source: d.depends_on_id,
    target: d.item_id,
  }));

  forceSimulation(nodes)
    .force("charge", forceManyBody<SimNode>().strength(-420))
    .force("link", forceLink<SimNode, SimulationLinkDatum<SimNode>>(links).id((n) => n.id).distance(STEP * 0.8).strength(0.5))
    .force("collide", forceCollide<SimNode>((n) => n.radius).strength(0.9))
    .force("depth", forceX<SimNode>((n) => n.depth * STEP).strength(0.35))
    .force("band", forceY<SimNode>((n) => n.groupY).strength(0.12))
    .stop()
    .tick(TICKS);

  const sizes = new Map(boxes.map((b) => [b.id, b]));
  return new Map(
    nodes.map((n) => {
      const box = sizes.get(n.id)!;
      return [n.id, { x: (n.x ?? 0) - box.width / 2, y: (n.y ?? 0) - box.height / 2 }];
    }),
  );
}

/** How many prerequisites deep each box sits: 0 for anything that needs nothing. */
function chainDepths(boxes: Box[], deps: Dependency[]): Map<string, number> {
  const prereqs = new Map<string, string[]>();
  for (const d of deps) prereqs.set(d.item_id, [...(prereqs.get(d.item_id) ?? []), d.depends_on_id]);

  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // only possible with bad data containing a loop
    visiting.add(id);
    const depth = Math.max(-1, ...(prereqs.get(id) ?? []).map(depthOf)) + 1;
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };
  for (const b of boxes) depthOf(b.id);
  return depths;
}

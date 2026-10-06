import dagre from "@dagrejs/dagre";
import type { Dependency } from "./types.ts";

export type Box = { id: string; width: number; height: number };

/**
 * Positions for a left-to-right dependency graph: each prerequisite sits to
 * the left of what it unlocks. Returns each box's top-left corner, which is
 * what React Flow expects (dagre itself works with centres).
 */
export function layoutGraph(
  boxes: Box[],
  deps: Dependency[],
): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 90 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const box of boxes) graph.setNode(box.id, { width: box.width, height: box.height });
  for (const d of deps) graph.setEdge(d.depends_on_id, d.item_id);

  dagre.layout(graph);

  return new Map(
    boxes.map((box) => {
      const { x, y } = graph.node(box.id);
      return [box.id, { x: x - box.width / 2, y: y - box.height / 2 }];
    }),
  );
}

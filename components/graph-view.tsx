"use client";

import { useMemo, useState } from "react";
import {
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useInternalNode,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Check } from "lucide-react";
import { ItemEditor } from "@/components/item-editor";
import { dependentsOf } from "@/lib/graph";
import { layoutGraph } from "@/lib/layout";
import { recommendedPath, scoreOf } from "@/lib/scoring";
import type { Category, Dependency, Item, Score, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Room for the title under each orb. */
const NODE_WIDTH = 160;
const LABEL_HEIGHT = 48;
const DONE_SIZE = 28;
const UNCATEGORISED = "#9aa3c7";

type ItemNodeData = {
  title: string;
  color: string;
  categoryName: string;
  status: Status;
  scores: { interest: Score; impact: Score; effort: Score };
  /** Orb diameter in px. */
  size: number;
  /** "start" is the first step of the recommended path. */
  emphasis: "start" | "path" | "dimmed" | "normal";
};
type ItemNode = Node<ItemNodeData, "item">;

/** Score → orb diameter. Square root so big scores don't dwarf the rest. */
function sizeFor(score: number) {
  return Math.round(Math.min(110, Math.max(40, 30 + 14 * Math.sqrt(score))));
}

function ItemNodeView({ data }: NodeProps<ItemNode>) {
  const { title, color, categoryName, status, scores, size, emphasis } = data;
  const onPath = emphasis === "start" || emphasis === "path";
  // React Flow needs handles to exist, but StarEdge draws from the orb's
  // centre itself, so these are invisible and their position doesn't matter.
  const handleStyle = { top: size / 2, opacity: 0 };

  return (
    <div
      className={cn(
        "wp-node relative flex flex-col items-center gap-2.5",
        onPath && "on-path",
        (emphasis === "dimmed" || status === "done") && "is-dimmed",
        status === "done" && "is-done",
        status === "parked" && "is-parked",
      )}
      style={{ width: NODE_WIDTH, "--c": color } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} isConnectable={false} />

      <div className="relative" style={{ width: size, height: size }}>
        {emphasis === "start" && (
          <>
            <span className="wp-pulse" />
            <span className="wp-start-chip">START HERE</span>
          </>
        )}
        {onPath && <span className="wp-orbit" />}
        <div className="wp-orb">{status === "done" && <Check className="size-4" />}</div>

        <div className="wp-tooltip" role="tooltip">
          <div className="font-heading text-sm font-semibold text-foreground">{title}</div>
          <div className="mb-2 text-xs text-muted-foreground capitalize">
            {categoryName} · {status}
          </div>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1">
            {(["interest", "impact", "effort"] as const).map((key) => (
              <div key={key} className="contents">
                <span className="text-[11px] tracking-wider text-muted-foreground uppercase">{key}</span>
                <div className="wp-bar">
                  <i style={{ width: `${scores[key] * 20}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="wp-label">{title}</span>
      <Handle type="source" position={Position.Right} style={handleStyle} isConnectable={false} />
    </div>
  );
}

type StarEdgeData = { highlighted: boolean };
type StarEdgeType = Edge<StarEdgeData, "star">;

/** Where an orb sits on the canvas, and how far a line should stop short of its centre. */
function orbOf(node: InternalNode) {
  const { size, emphasis } = node.data as ItemNodeData;
  const onPath = emphasis === "start" || emphasis === "path";
  return {
    x: node.internals.positionAbsolute.x + NODE_WIDTH / 2,
    y: node.internals.positionAbsolute.y + size / 2,
    // Clear the orb, plus its orbit ring when it's on the path.
    gap: size / 2 + (onPath ? 13 : 6),
  };
}

/**
 * A constellation line: straight from one orb towards the other's centre,
 * starting and ending at the orbs' edges, whatever the angle. On the
 * recommended path it's a gradient with a soft glow and light flowing along it.
 */
function StarEdge({ id, source, target, markerEnd, data }: EdgeProps<StarEdgeType>) {
  const from = useInternalNode(source);
  const to = useInternalNode(target);
  if (!from || !to) return null;

  const a = orbOf(from);
  const b = orbOf(to);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length <= a.gap + b.gap) return null; // orbs touching: nothing to draw
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const start = { x: a.x + ux * a.gap, y: a.y + uy * a.gap };
  const end = { x: b.x - ux * b.gap, y: b.y - uy * b.gap };
  const path = `M${start.x},${start.y} L${end.x},${end.y}`;

  if (!data?.highlighted) {
    return <BaseEdge id={id} path={path} markerEnd={markerEnd} className="wp-edge" />;
  }

  // Edge ids contain "->", which isn't safe inside url(#...).
  const gradientId = `wp-grad-${id.replace(/[^\w-]/g, "_")}`;
  const stroke = `url(#${gradientId})`;
  return (
    <>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
          <stop offset="0" style={{ stopColor: "var(--violet)" }} />
          <stop offset="1" style={{ stopColor: "var(--cyan)" }} />
        </linearGradient>
      </defs>
      <path d={path} className="wp-path-glow" stroke={stroke} />
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: 2.4 }} />
      <path d={path} className="wp-path-flow" />
      <path d={path} className="wp-path-flow is-slow" />
    </>
  );
}

// Defined outside the component so React Flow doesn't see new objects on
// every render (it warns about that, and re-mounts every node).
const nodeTypes = { item: ItemNodeView };
const edgeTypes = { star: StarEdge };

export function GraphView({
  items,
  categories,
  dependencies,
}: {
  items: Item[];
  categories: Category[];
  dependencies: Dependency[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const itemsById = new Map(items.map((i) => [i.id, i]));
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const dependents = dependentsOf(dependencies);
    const path = recommendedPath(items, dependencies);
    const onPath = new Set(path);

    const sizes = new Map(
      items.map((item) => [
        item.id,
        item.status === "done" ? DONE_SIZE : sizeFor(scoreOf(item, itemsById, dependents).score),
      ]),
    );
    const positions = layoutGraph(
      items.map((i) => ({
        id: i.id,
        width: NODE_WIDTH,
        height: sizes.get(i.id)! + LABEL_HEIGHT,
        group: i.category_id ?? "none",
      })),
      dependencies,
    );

    const nodes: ItemNode[] = items.map((item) => {
      const category = item.category_id ? categoriesById.get(item.category_id) : undefined;
      return {
        id: item.id,
        type: "item",
        position: positions.get(item.id)!,
        data: {
          title: item.title,
          color: category?.color ?? UNCATEGORISED,
          categoryName: category?.name ?? "Uncategorised",
          status: item.status,
          scores: { interest: item.interest, impact: item.impact, effort: item.effort },
          size: sizes.get(item.id)!,
          emphasis:
            path.length === 0
              ? "normal"
              : item.id === path[0]
                ? "start"
                : onPath.has(item.id)
                  ? "path"
                  : "dimmed",
        },
      };
    });

    // An edge is on the path when it joins two consecutive path steps.
    const pathEdges = new Set(path.slice(1).map((id, i) => `${path[i]}->${id}`));
    const edges: StarEdgeType[] = dependencies.map((d) => {
      const id = `${d.depends_on_id}->${d.item_id}`;
      const highlighted = pathEdges.has(id);
      return {
        id,
        source: d.depends_on_id,
        target: d.item_id,
        type: "star",
        data: { highlighted },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: highlighted ? "#3ee0f5" : "rgb(232 235 247 / 0.45)",
        },
        zIndex: highlighted ? 1 : 0,
      };
    });

    return { nodes, edges };
  }, [items, categories, dependencies]);

  return (
    // Fills the whole window, underneath the floating header.
    <div className="fixed inset-0">
      {items.length === 0 ? (
        <p className="flex h-full items-center justify-center text-muted-foreground">
          No items yet. Add some from the list.
        </p>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode="dark"
          onNodeClick={(_, node) => setEditing(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
        >
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      )}

      <p className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-xl sm:block">
        Bigger stars are better value for the effort · the glowing route is the recommended path
      </p>

      {editing && (
        <ItemEditor
          key={editing}
          item={items.find((i) => i.id === editing)}
          items={items}
          categories={categories}
          dependencies={dependencies}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

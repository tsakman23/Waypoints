"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Check } from "lucide-react";
import { ItemEditor } from "@/components/item-editor";
import { dependentsOf } from "@/lib/graph";
import { layoutGraph } from "@/lib/layout";
import { recommendedPath, scoreOf } from "@/lib/scoring";
import type { Category, Dependency, Item } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Room for the title under each circle. */
const NODE_WIDTH = 150;
const LABEL_HEIGHT = 44;
const DONE_SIZE = 28;
const UNCATEGORISED = "#94a3b8";

type ItemNodeData = {
  title: string;
  color: string;
  /** Circle diameter in px. */
  size: number;
  done: boolean;
  /** "start" is the first step of the recommended path. */
  emphasis: "start" | "path" | "dimmed" | "normal";
};
type ItemNode = Node<ItemNodeData, "item">;

/** Score → circle diameter. Square root so big scores don't dwarf the rest. */
function sizeFor(score: number) {
  return Math.round(Math.min(110, Math.max(40, 30 + 14 * Math.sqrt(score))));
}

function ItemNodeView({ data }: NodeProps<ItemNode>) {
  const { title, color, size, done, emphasis } = data;
  const onPath = emphasis === "start" || emphasis === "path";
  // Edges attach at the circle's middle, not the middle of circle + label.
  const handleStyle = { top: size / 2, opacity: 0 };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 transition-opacity duration-500",
        emphasis === "dimmed" && "opacity-35",
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} isConnectable={false} />
      <div className="relative" style={{ width: size, height: size }}>
        {emphasis === "start" && (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-40"
            style={{ backgroundColor: color }}
          />
        )}
        <div
          className="relative flex size-full items-center justify-center rounded-full border-2 border-background text-white"
          style={{
            backgroundColor: color,
            opacity: done ? 0.5 : 1,
            boxShadow: onPath ? `0 0 0 3px var(--background), 0 0 22px 6px ${color}` : undefined,
          }}
        >
          {done && <Check className="size-4" />}
        </div>
      </div>
      <span
        className={cn(
          "line-clamp-2 text-center text-xs leading-tight",
          onPath ? "font-semibold text-foreground" : "text-muted-foreground",
          done && "line-through",
        )}
      >
        {title}
      </span>
      <Handle type="source" position={Position.Right} style={handleStyle} isConnectable={false} />
    </div>
  );
}

// Defined outside the component so React Flow doesn't see a new object on
// every render (it warns about that, and re-mounts every node).
const nodeTypes = { item: ItemNodeView };

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
    const colors = new Map(categories.map((c) => [c.id, c.color]));
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
      items.map((i) => ({ id: i.id, width: NODE_WIDTH, height: sizes.get(i.id)! + LABEL_HEIGHT })),
      dependencies,
    );

    const nodes: ItemNode[] = items.map((item) => ({
      id: item.id,
      type: "item",
      position: positions.get(item.id)!,
      data: {
        title: item.title,
        color: (item.category_id && colors.get(item.category_id)) || UNCATEGORISED,
        size: sizes.get(item.id)!,
        done: item.status === "done",
        emphasis:
          path.length === 0
            ? "normal"
            : item.id === path[0]
              ? "start"
              : onPath.has(item.id)
                ? "path"
                : "dimmed",
      },
    }));

    // An edge is on the path when it joins two consecutive path steps.
    const pathEdges = new Set(path.slice(1).map((id, i) => `${path[i]}->${id}`));
    const edges: Edge[] = dependencies.map((d) => {
      const id = `${d.depends_on_id}->${d.item_id}`;
      const highlighted = pathEdges.has(id);
      return {
        id,
        source: d.depends_on_id,
        target: d.item_id,
        animated: highlighted,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: highlighted
          ? { stroke: "var(--primary)", strokeWidth: 2.5 }
          : { stroke: "var(--muted-foreground)", opacity: path.length ? 0.3 : 0.7 },
        zIndex: highlighted ? 1 : 0,
      };
    });

    return { nodes, edges };
  }, [items, categories, dependencies]);

  if (items.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No items yet. Add some from the list.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Bigger means better value for the effort. The glowing path is the recommended route,
        starting from the pulsing item.
      </p>
      <div className="h-[calc(100vh-12rem)] min-h-96 rounded-lg border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setEditing(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

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

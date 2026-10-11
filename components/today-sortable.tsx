"use client";

import { useEffect, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { saveTodayOrder } from "@/app/actions";
import type { Session } from "@/lib/planner";
import { cn } from "@/lib/utils";

/** A session plus a key that stays the same while it's dragged around. */
type Entry = { key: string; session: Session };

const entriesOf = (sessions: Session[]): Entry[] =>
  sessions.map((session, i) => ({ key: `${i}:${session.item.id}`, session }));

/**
 * Today's sessions as a drag-and-drop list. Grab the grip to reorder (mouse,
 * touch or keyboard); the new order shows at once and is saved in the
 * background, and the planner, Next up and the solar system all follow it.
 */
export function TodaySortable({
  sessions,
  renderItem,
  className,
  onOrderChange,
}: {
  sessions: Session[];
  /** Draws one session; `grip` is the drag handle to place in it. */
  renderItem: (session: Session, grip: React.ReactNode) => React.ReactNode;
  className?: string;
  /** Told about a new order right away, before it's saved. */
  onOrderChange?: (sessions: Session[]) => void;
}) {
  const [entries, setEntries] = useState(() => entriesOf(sessions));
  const [, startTransition] = useTransition();

  // When the server sends a new plan, start from it.
  const signature = sessions.map((s) => s.item.id).join(",");
  useEffect(() => setEntries(entriesOf(sessions)), [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    // A small movement before a drag starts, so clicks still click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // A short press on touch screens, so scrolling doesn't grab cards.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = entries.findIndex((e) => e.key === active.id);
    const to = entries.findIndex((e) => e.key === over.id);
    const next = arrayMove(entries, from, to);
    setEntries(next);
    onOrderChange?.(next.map((e) => e.session));
    startTransition(async () => {
      await saveTodayOrder(next.map((e) => e.session.item.id));
    });
  }

  return (
    // A fixed id keeps dnd-kit's generated ids the same on server and
    // browser, so hydration matches.
    <DndContext id="today-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={entries.map((e) => e.key)} strategy={verticalListSortingStrategy}>
        <ol className={className}>
          {entries.map(({ key, session }) => (
            <SortableRow key={key} id={key}>
              {(grip) => renderItem(session, grip)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (grip: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const grip = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="cursor-grab touch-none rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative list-none", isDragging && "z-10 opacity-90 [&>*]:shadow-[0_18px_40px_rgb(0_0_0/0.5)]")}
    >
      {children(grip)}
    </li>
  );
}

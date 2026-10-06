"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  addDependency,
  createCategory,
  createItem,
  deleteItem,
  removeDependency,
  updateItem,
} from "@/app/actions";
import { ScorePicker } from "@/components/score-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { wouldCreateCycle } from "@/lib/graph";
import {
  STATUSES,
  type Category,
  type Dependency,
  type Item,
  type ItemInput,
  type Status,
} from "@/lib/types";

/** Select value for the "New category…" option; not a real category id. */
const NEW_CATEGORY = "__new";

const NEW_ITEM: ItemInput = {
  title: "",
  notes: "",
  category_id: null,
  status: "idea",
  interest: 3,
  impact: 3,
  effort: 3,
};

/**
 * Create or edit an item. Pass `item` to edit it; leave it out to create a
 * new one. The parent mounts this only while it's open.
 */
export function ItemEditor({
  item,
  items,
  categories,
  dependencies,
  onClose,
}: {
  item?: Item;
  items: Item[];
  categories: Category[];
  dependencies: Dependency[];
  onClose: () => void;
}) {
  // Starts from the item being edited (minus its id) or the defaults.
  const [fields, setFields] = useState<ItemInput>(() => {
    if (!item) return NEW_ITEM;
    const { id: _id, ...rest } = item;
    return rest;
  });
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [addingCategory, setAddingCategory] = useState(false);

  function set<K extends keyof ItemInput>(key: K, value: ItemInput[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  /** Run a server action; close on success, show its error otherwise. */
  function run(action: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => (item ? updateItem(item.id, fields) : createItem(fields)));
  }

  function remove() {
    if (item && confirm(`Delete "${item.title}"? This also removes its dependencies.`)) {
      run(() => deleteItem(item.id));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "New item"}</DialogTitle>
        </DialogHeader>

        <form id="item-form" onSubmit={save} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={fields.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Write a compiler"
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={fields.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              {addingCategory ? (
                <NewCategory
                  onCreated={(id) => {
                    set("category_id", id);
                    setAddingCategory(false);
                  }}
                  onCancel={() => setAddingCategory(false)}
                />
              ) : (
                <Select
                  value={fields.category_id ?? "none"}
                  onValueChange={(value) => {
                    if (value === NEW_CATEGORY) setAddingCategory(true);
                    else set("category_id", value === "none" ? null : value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorised</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_CATEGORY}>New category…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={fields.status} onValueChange={(value) => set("status", value as Status)}>
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScorePicker
            label="Interest"
            hint="how much you want to"
            value={fields.interest}
            onChange={(v) => set("interest", v)}
          />
          <ScorePicker
            label="Impact"
            hint="how much it matters"
            value={fields.impact}
            onChange={(v) => set("impact", v)}
          />
          <ScorePicker
            label="Effort"
            hint="how much work it is"
            value={fields.effort}
            onChange={(v) => set("effort", v)}
          />
        </form>

        {item ? (
          <Prerequisites item={item} items={items} dependencies={dependencies} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Save the item first, then open it again to add what it depends on.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="sm:justify-between">
          {item ? (
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="item-form" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline name + colour form that replaces the category picker while open. */
function NewCategory({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await createCategory({ name, color });
      if (result.error) setError(result.error);
      else if (result.id) onCreated(result.id);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Category colour"
          className="h-8 w-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          // Enter adds the category instead of submitting the item form.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Name"
          aria-label="Category name"
          autoFocus
        />
        <Button type="button" size="sm" onClick={add} disabled={pending || !name.trim()}>
          Add
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onCancel} aria-label="Cancel">
          <X />
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/**
 * The item's prerequisites, with remove buttons, and a picker to add more.
 * Changes save immediately. Items that would create a loop aren't offered;
 * the server checks again before inserting.
 */
function Prerequisites({
  item,
  items,
  dependencies,
}: {
  item: Item;
  items: Item[];
  dependencies: Dependency[];
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const itemsById = new Map(items.map((i) => [i.id, i]));
  const current = dependencies
    .filter((d) => d.item_id === item.id)
    .flatMap((d) => itemsById.get(d.depends_on_id) ?? []);
  const currentIds = new Set(current.map((i) => i.id));
  const candidates = items.filter(
    (i) =>
      i.id !== item.id &&
      !currentIds.has(i.id) &&
      !wouldCreateCycle(dependencies, item.id, i.id),
  );

  function run(action: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Depends on</Label>
      {current.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing. It can start any time.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {current.map((prereq) => (
            <li key={prereq.id} className="flex items-center justify-between gap-2 text-sm">
              <span className={prereq.status === "done" ? "text-muted-foreground line-through" : undefined}>
                {prereq.title}
              </span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${prereq.title}`}
                disabled={pending}
                onClick={() => run(() => removeDependency(item.id, prereq.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <Select
          value=""
          onValueChange={(id) => run(() => addDependency(item.id, id))}
          disabled={pending}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Add a prerequisite…" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

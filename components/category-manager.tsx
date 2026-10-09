"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteCategory, updateCategory } from "@/app/actions";
import { NewCategory } from "@/components/new-category";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SKILL_PRESETS } from "@/lib/skills";
import { SKILL_TYPES, type Category, type Item, type SkillType } from "@/lib/types";

/** Rename, recolour, delete and add categories. Mounted only while open. */
export function CategoryManager({
  categories,
  items,
  onClose,
}: {
  categories: Category[];
  items: Item[];
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>Deleting a category leaves its items uncategorised.</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-5">
          {categories.map((category) => (
            <CategoryRow
              // Keyed by every saved field too, so the row's drafts reset
              // once a save comes back from the server.
              key={`${category.id}:${category.name}:${category.color}:${category.skill_type}:${category.resurface_days}`}
              category={category}
              itemCount={items.filter((i) => i.category_id === category.id).length}
            />
          ))}
          {categories.length === 0 && (
            <li className="text-sm text-muted-foreground">No categories yet.</li>
          )}
        </ul>

        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm font-medium">Add a category</p>
          <NewCategory onCreated={() => {}} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({ category, itemCount }: { category: Category; itemCount: number }) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [skillType, setSkillType] = useState<SkillType>(category.skill_type);
  const [days, setDays] = useState(category.resurface_days);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const changed =
    name.trim() !== category.name ||
    color !== category.color ||
    skillType !== category.skill_type ||
    days !== category.resurface_days;

  /** Picking a type fills in its research-based interval; the number stays editable. */
  function chooseSkillType(type: SkillType) {
    setSkillType(type);
    setDays(SKILL_PRESETS[type].resurfaceDays);
  }

  function run(action: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  function save() {
    run(() => updateCategory(category.id, { name, color, skill_type: skillType, resurface_days: days }));
  }

  function remove() {
    const usage =
      itemCount === 0
        ? "No items use it."
        : `${itemCount} item${itemCount === 1 ? "" : "s"} will become uncategorised.`;
    if (confirm(`Delete "${category.name}"? ${usage}`)) {
      run(() => deleteCategory(category.id));
    }
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label={`Colour for ${category.name}`}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && changed) save();
          }}
          aria-label="Category name"
        />
        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
        {changed && (
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            Save
          </Button>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={remove}
          disabled={pending}
          aria-label={`Delete ${category.name}`}
        >
          <Trash2 />
        </Button>
      </div>

      {/* Second line: what kind of skill it is, and how long it can rest. */}
      <div className="flex flex-wrap items-center gap-2 pl-10 text-sm text-muted-foreground">
        <Select value={skillType} onValueChange={(v) => chooseSkillType(v as SkillType)}>
          <SelectTrigger size="sm" className="w-32" aria-label={`Skill type for ${category.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SKILL_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {SKILL_PRESETS[type].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>back after</span>
        <Input
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(Math.round(Number(e.target.value)) || 1)}
          aria-label={`Days before ${category.name} comes back`}
          className="h-8 w-16 text-center"
        />
        <span>days untouched</span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </li>
  );
}

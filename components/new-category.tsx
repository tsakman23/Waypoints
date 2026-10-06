"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { createCategory } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Inline name + colour form for adding a category. */
export function NewCategory({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  /** Shows a cancel button when given. */
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await createCategory({ name, color });
      if (result.error) setError(result.error);
      else if (result.id) {
        setName("");
        setError(undefined);
        onCreated(result.id);
      }
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
        {onCancel && (
          <Button type="button" size="icon-sm" variant="ghost" onClick={onCancel} aria-label="Cancel">
            <X />
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

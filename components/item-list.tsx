"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Tags } from "lucide-react";
import { CategoryManager } from "@/components/category-manager";
import { ItemEditor } from "@/components/item-editor";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_SORT, filterItems, NO_FILTERS, sortItems, type Filters, type Sort, type SortKey } from "@/lib/list";
import { STATUSES, type Category, type Dependency, type Item } from "@/lib/types";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "title", label: "Title" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "interest", label: "Interest", numeric: true },
  { key: "impact", label: "Impact", numeric: true },
  { key: "effort", label: "Effort", numeric: true },
];

export function ItemList({
  items,
  categories,
  dependencies,
}: {
  items: Item[];
  categories: Category[];
  dependencies: Dependency[];
}) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  // Which item the editor is open for: an id, "new", or closed.
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);

  // Only recompute when the data, filters or sort actually change.
  const visible = useMemo(
    () => sortItems(filterItems(items, filters), sort, categories),
    [items, categories, filters, sort],
  );
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Clicking the sorted column flips direction; a new column starts ascending
  // (descending for scores, where high values are usually what you want).
  function toggleSort(key: SortKey, numeric?: boolean) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: numeric ? "desc" : "asc" },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search titles and notes…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-64"
        />
        <Select
          value={filters.category}
          onValueChange={(category) => setFilters({ ...filters, category })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="none">Uncategorised</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(status) => setFilters({ ...filters, status: status as Filters["status"] })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setManagingCategories(true)}>
            <Tags />
            Categories
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus />
            New item
          </Button>
        </div>
      </div>

      {managingCategories && (
        <CategoryManager
          categories={categories}
          items={items}
          onClose={() => setManagingCategories(false)}
        />
      )}

      {editing && (
        <ItemEditor
          // A new key per item resets the form when switching between items.
          key={editing}
          item={editing === "new" ? undefined : items.find((i) => i.id === editing)}
          items={items}
          categories={categories}
          dependencies={dependencies}
          onClose={() => setEditing(null)}
        />
      )}

      {/* A glass panel keeps the table readable over the moving sky. */}
      <div className="wp-glass overflow-hidden rounded-2xl px-2 py-1">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map(({ key, label, numeric }) => (
              <TableHead key={key} className={numeric ? "text-right" : undefined}>
                <button
                  type="button"
                  onClick={() => toggleSort(key, numeric)}
                  className="inline-flex cursor-pointer items-center gap-1 text-xs tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
                >
                  {label}
                  {sort.key === key &&
                    (sort.direction === "asc" ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    ))}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((item) => {
            const category = item.category_id ? categoriesById.get(item.category_id) : undefined;
            return (
              <TableRow
                key={item.id}
                onClick={() => setEditing(item.id)}
                className="wp-row cursor-pointer hover:bg-transparent"
              >
                <TableCell className="font-medium">
                  {/* A real button so the row can be opened from the keyboard too. */}
                  <button type="button" className="cursor-pointer text-left">
                    {item.title}
                  </button>
                </TableCell>
                <TableCell>
                  {category ? (
                    <span
                      className="inline-flex items-center gap-2"
                      style={{ "--c": category.color } as React.CSSProperties}
                    >
                      <span className="wp-dot" />
                      {category.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.interest}</TableCell>
                <TableCell className="text-right tabular-nums">{item.impact}</TableCell>
                <TableCell className="text-right tabular-nums">{item.effort}</TableCell>
              </TableRow>
            );
          })}
          {visible.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-muted-foreground">
                {items.length === 0 ? "No items yet." : "Nothing matches these filters."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

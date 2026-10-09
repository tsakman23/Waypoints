import { Badge } from "@/components/ui/badge";
import type { Status } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A status shown so it reads without colour too: active is a gradient pill,
 * parked is dashed, done is struck through, idea is a plain outline.
 */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge
      variant={status === "active" ? "default" : "secondary"}
      className={cn(
        "capitalize",
        status === "parked" && "border-dashed",
        status === "done" && "line-through opacity-70",
      )}
    >
      {status}
    </Badge>
  );
}

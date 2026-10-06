import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getData } from "@/lib/data";
import { nextUp, type Suggestion } from "@/lib/scoring";
import type { Category } from "@/lib/types";

/** How many goals to name under each suggestion. */
const SHOWN_UNLOCKS = 3;

export default async function NextUpPage() {
  const { items, categories, dependencies } = await getData();
  const suggestions = nextUp(items, dependencies);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const waiting = items.filter(
    (i) => i.status !== "done" && i.status !== "parked" && !suggestions.some((s) => s.item.id === i.id),
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Next up</h2>
        <p className="text-sm text-muted-foreground">
          What you can start now, best value for effort first. Items get a boost for the goals
          they lead to.
          {waiting > 0 && ` ${waiting} more ${waiting === 1 ? "is" : "are"} waiting on prerequisites.`}
        </p>
      </div>

      {suggestions.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nothing to start right now. Everything is done, parked, or waiting on something else.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.item.id}>
              <SuggestionCard
                rank={index + 1}
                suggestion={suggestion}
                category={
                  suggestion.item.category_id
                    ? categoriesById.get(suggestion.item.category_id)
                    : undefined
                }
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SuggestionCard({
  rank,
  suggestion: { item, score, unlocks },
  category,
}: {
  rank: number;
  suggestion: Suggestion;
  category?: Category;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl font-semibold text-muted-foreground tabular-nums">{rank}</span>
          <div className="flex flex-col gap-1">
            <CardTitle>{item.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {category && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name}
                </span>
              )}
              <Badge variant={item.status === "active" ? "default" : "secondary"} className="capitalize">
                {item.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">{score.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">score</div>
        </div>
      </CardHeader>
      {unlocks.length > 0 && (
        <CardContent className="text-sm text-muted-foreground">
          Leads to{" "}
          {unlocks.slice(0, SHOWN_UNLOCKS).map((u, i) => (
            <span key={u.item.id}>
              {i > 0 && ", "}
              <span className="text-foreground">{u.item.title}</span>
            </span>
          ))}
          {unlocks.length > SHOWN_UNLOCKS && ` and ${unlocks.length - SHOWN_UNLOCKS} more`}
        </CardContent>
      )}
    </Card>
  );
}

// Row shapes as they come back from Supabase (see supabase/schema.sql).

export const STATUSES = ["idea", "active", "parked", "done"] as const;
export type Status = (typeof STATUSES)[number];

/** A 1–5 score the user sets by hand. */
export type Score = 1 | 2 | 3 | 4 | 5;

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Item = {
  id: string;
  title: string;
  notes: string;
  category_id: string | null;
  status: Status;
  interest: Score;
  impact: Score;
  effort: Score;
};

/** An edge: `item_id` can't start until `depends_on_id` is done. */
export type Dependency = {
  item_id: string;
  depends_on_id: string;
};

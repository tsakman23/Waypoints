-- The user's own order for today's sessions, set by dragging them on Next up
-- or the solar system. Only applies on the day it was saved: tomorrow starts
-- again from the planner's suggestion.

alter table profiles
  add column today_order_date date,
  add column today_order uuid[] not null default '{}';

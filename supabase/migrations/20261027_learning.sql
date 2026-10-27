-- Learning from behaviour: tell hand-set resurfacing intervals apart from
-- defaults, and keep a snapshot of each day's plan so it can be compared with
-- what was actually done. Run once in the Supabase SQL editor on a database
-- created from an earlier schema. (schema.sql already includes these.)

-- Categories: null resurface_days means "automatic" ------------------------
-- Until now, choosing a skill type wrote its preset into resurface_days, so a
-- default and a value typed by hand looked the same. From now on null means
-- automatic (the skill type's preset, adjusted by what the app learns), and a
-- number means the user set it, which always wins.

alter table categories
  alter column resurface_days drop not null,
  alter column resurface_days drop default;

-- Existing values equal to their type's preset (lib/skills.ts) were almost
-- certainly the default, so they become automatic. Anything else was typed
-- by hand and is kept.
update categories
set resurface_days = null
where resurface_days = case skill_type
  when 'fitness' then 7
  when 'language' then 21
  when 'technical' then 28
  when 'instrument' then 42
  when 'creative' then 28
  else 28
end;

-- Plan snapshots --------------------------------------------------------------
-- One row per user per day: the sessions the planner suggested that morning,
-- saved when the daily check-in is answered. `answered` turns true when the
-- next day's check-in reports what was actually done, and only answered days
-- count as evidence: a day nobody asked about isn't a day you skipped.

create table plan_snapshots (
  day        date not null,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  -- [{ "item_id": uuid, "category_id": uuid | null }, ...], in plan order. The
  -- category is the one the item had that day. Items deleted later are
  -- ignored when learning.
  sessions   jsonb not null default '[]' check (jsonb_typeof(sessions) = 'array'),
  answered   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table plan_snapshots enable row level security;

create policy "Owners manage their plan snapshots" on plan_snapshots
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

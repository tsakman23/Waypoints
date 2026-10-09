-- Waypoints schema. Run once in the Supabase SQL editor on a new project.
-- Every table carries a user_id and a row-level security policy so each
-- user can only read and write their own rows.
--
-- This is the complete, current schema. A database created from an earlier
-- version is brought up to date with the files in supabase/migrations/.

-- Categories ----------------------------------------------------------------

create table categories (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  name           text not null,
  color          text not null,
  -- A preset chosen in the app that fills in resurface_days, which the user
  -- can then change: how long the interest can go untouched before the
  -- route brings it back.
  skill_type     text not null default 'other'
                 check (skill_type in ('fitness', 'language', 'technical', 'instrument', 'creative', 'other')),
  resurface_days smallint not null default 28 check (resurface_days between 1 and 365),
  created_at     timestamptz not null default now(),
  -- Lets items reference (id, user_id) together, so an item can't point at
  -- another user's category.
  unique (id, user_id)
);

alter table categories enable row level security;

create policy "Owners manage their categories" on categories
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Items ---------------------------------------------------------------------

create table items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  category_id uuid,
  title       text not null,
  notes       text not null default '',
  status      text not null default 'idea'
              check (status in ('idea', 'active', 'parked', 'done')),
  interest    smallint not null default 3 check (interest between 1 and 5),
  impact      smallint not null default 3 check (impact between 1 and 5),
  effort      smallint not null default 3 check (effort between 1 and 5),
  created_at  timestamptz not null default now(),
  -- Deleting a category leaves its items uncategorised rather than deleting
  -- them. Only category_id is cleared; user_id must stay set.
  foreign key (category_id, user_id)
    references categories (id, user_id) on delete set null (category_id),
  unique (id, user_id)
);

alter table items enable row level security;

create policy "Owners manage their items" on items
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Dependencies --------------------------------------------------------------
-- One row per edge: item_id can't start until depends_on_id is done.
-- Cycles are rejected in the app before inserting (see lib/).

create table dependencies (
  item_id       uuid not null,
  depends_on_id uuid not null,
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (item_id, depends_on_id),
  check (item_id <> depends_on_id),
  foreign key (item_id, user_id)
    references items (id, user_id) on delete cascade,
  foreign key (depends_on_id, user_id)
    references items (id, user_id) on delete cascade
);

alter table dependencies enable row level security;

create policy "Owners manage their dependencies" on dependencies
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Work log ------------------------------------------------------------------
-- One row per item worked on per day, from the daily check-in (and when an
-- item is marked done). A day with no rows means nothing was done that day.

create table work_logs (
  item_id    uuid not null,
  day        date not null,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, day),
  foreign key (item_id, user_id) references items (id, user_id) on delete cascade
);

-- "When was each category last worked on?" reads the newest days per user.
create index work_logs_user_day on work_logs (user_id, day desc);

alter table work_logs enable row level security;

create policy "Owners manage their work logs" on work_logs
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Profiles ------------------------------------------------------------------
-- One row per user: the setup wizard's answers and the check-in state. The app
-- creates it when the wizard is finished; no row means "show the wizard".

create table profiles (
  user_id         uuid primary key default auth.uid() references auth.users on delete cascade,
  -- Time for interests per day, split into sessions of session_minutes.
  weekday_minutes smallint not null default 60  check (weekday_minutes between 0 and 1440),
  weekend_minutes smallint not null default 120 check (weekend_minutes between 0 and 1440),
  session_minutes smallint not null default 60  check (session_minutes between 15 and 480),
  -- Days of the week that count as weekend, 0 = Sunday ... 6 = Saturday.
  weekend_days    smallint[] not null default '{0,6}'
                  check (weekend_days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  -- IANA name detected in the browser, e.g. 'Europe/London'.
  timezone        text not null default 'UTC',
  animate_orbits  boolean not null default true,
  -- The last day the check-in has asked about, so it asks once per day.
  last_check_in   date,
  created_at      timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Owners manage their profile" on profiles
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

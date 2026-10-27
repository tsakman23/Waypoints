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
  -- What kind of skill it is; picks the default for how long the interest
  -- can go untouched before the route brings it back.
  skill_type     text not null default 'other'
                 check (skill_type in ('fitness', 'language', 'technical', 'instrument', 'creative', 'other')),
  -- null: automatic (the skill type's preset, adjusted by what the app
  -- learns). A number: set by the user, which always wins.
  resurface_days smallint check (resurface_days between 1 and 365),
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
  -- The user's own order for today's sessions; ignored on any other day.
  today_order_date date,
  today_order     uuid[] not null default '{}',
  created_at      timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Owners manage their profile" on profiles
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

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

-- Evaluations -------------------------------------------------------------------
-- One row per user: their latest walk-forward backtest, saved at check-in.
-- Sums rather than averages, so scores pool exactly across users.

create table evaluations (
  user_id            uuid primary key default auth.uid() references auth.users on delete cascade,
  days               integer not null check (days >= 0),
  predictions        integer not null check (predictions >= 0),
  model_brier_sum    double precision not null check (model_brier_sum >= 0),
  baseline_brier_sum double precision not null check (baseline_brier_sum >= 0),
  updated_at         timestamptz not null default now()
);

alter table evaluations enable row level security;

create policy "Owners manage their evaluation" on evaluations
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Admins ------------------------------------------------------------------------
-- Who can see /admin. RLS with no policies: nobody can read or change this
-- through the app. Add an admin in the SQL editor:
--   insert into admins (user_id) select id from auth.users where email = '…';

create table admins (
  user_id uuid primary key references auth.users on delete cascade
);

alter table admins enable row level security;

-- Whether the signed-in user is an admin.
create function is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Accounts left out of the admin page's statistics (demo and test accounts).
-- RLS with no policies: changed only in the SQL editor.

create table stats_excluded (
  user_id uuid primary key references auth.users on delete cascade
);

alter table stats_excluded enable row level security;

-- One row per user who has answered at least one check-in: an anonymous,
-- stable label, activity dates, their evaluation totals, and whether they're
-- excluded from stats. Admins only.
create function admin_overview()
returns table (
  label              text,
  answered_days      integer,
  last_answered      date,
  current_streak     integer,
  days               integer,
  predictions        integer,
  model_brier_sum    double precision,
  baseline_brier_sum double precision,
  excluded           boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  return query
  with answered as (
    select s.user_id, s.day from public.plan_snapshots s where s.answered
  ),
  -- Gaps and islands: consecutive days share the same (day - row number).
  runs as (
    select a.user_id, a.day,
           a.day - (row_number() over (partition by a.user_id order by a.day))::integer as run
    from answered a
  ),
  latest_run as (
    select r.user_id, count(*)::integer as length, max(r.day) as ends
    from runs r
    group by r.user_id, r.run
  ),
  per_user as (
    select a.user_id, count(*)::integer as answered_days, max(a.day) as last_answered
    from answered a
    group by a.user_id
  )
  select
    -- Stable and anonymous: a short hash of the user id, never the email.
    'User ' || left(md5(p.user_id::text), 6),
    p.answered_days,
    p.last_answered,
    -- A day is answered by the next morning's check-in, so a streak is still
    -- alive while its last answered day is yesterday or the day before (UTC).
    coalesce((
      select l.length from latest_run l
      where l.user_id = p.user_id and l.ends = p.last_answered and l.ends >= current_date - 2
    ), 0),
    coalesce(e.days, 0),
    coalesce(e.predictions, 0),
    coalesce(e.model_brier_sum, 0),
    coalesce(e.baseline_brier_sum, 0),
    exists (select 1 from public.stats_excluded x where x.user_id = p.user_id)
  from per_user p
  left join public.evaluations e on e.user_id = p.user_id
  order by p.last_answered desc, 1;
end;
$$;

-- Only signed-in users may call them, and admin_overview checks for admins.
revoke execute on function is_admin() from public, anon;
revoke execute on function admin_overview() from public, anon;
grant execute on function is_admin() to authenticated;
grant execute on function admin_overview() to authenticated;

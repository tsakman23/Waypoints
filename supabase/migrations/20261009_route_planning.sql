-- Route planning: skill clocks per category, a daily work log, and per-user
-- settings. Run once in the Supabase SQL editor on a database created from
-- the earlier schema. (schema.sql already includes these for fresh setups.)

-- Categories: skill type and resurfacing interval ---------------------------
-- The type is a preset chosen in the app; it fills in resurface_days, which
-- the user can then change. Defaults: 'other' and 28 days.

alter table categories
  add column skill_type text not null default 'other'
    check (skill_type in ('fitness', 'language', 'technical', 'instrument', 'creative', 'other')),
  add column resurface_days smallint not null default 28
    check (resurface_days between 1 and 365);

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

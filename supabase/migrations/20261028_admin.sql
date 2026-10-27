-- Admin: pooled evaluation and usage, without exposing anyone's data. Run
-- once in the Supabase SQL editor on a database created from an earlier
-- schema. (schema.sql already includes these.)
--
-- Each user's backtest runs in their own session, on their own data, and
-- only its score totals are stored here. Admins see those totals and
-- activity dates through admin_overview(), never titles, notes or emails.

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

-- One row per user who has answered at least one check-in: an anonymous,
-- stable label, activity dates and their evaluation totals. Admins only.
create function admin_overview()
returns table (
  label              text,
  answered_days      integer,
  last_answered      date,
  current_streak     integer,
  days               integer,
  predictions        integer,
  model_brier_sum    double precision,
  baseline_brier_sum double precision
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
    coalesce(e.baseline_brier_sum, 0)
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

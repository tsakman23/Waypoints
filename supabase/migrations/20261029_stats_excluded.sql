-- Accounts left out of the admin page's statistics: demo and test accounts,
-- whose made-up or artificial history would distort the pooled evaluation.
-- Run once in the Supabase SQL editor. (schema.sql already includes these.)

-- RLS with no policies, like admins: changed only in the SQL editor:
--   insert into stats_excluded (user_id) select id from auth.users where email = '…';

create table stats_excluded (
  user_id uuid primary key references auth.users on delete cascade
);

alter table stats_excluded enable row level security;

-- admin_overview gains an `excluded` column. A function's result columns
-- can't be changed in place, so it's dropped and recreated, and its
-- permissions granted again.
drop function admin_overview();

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

revoke execute on function admin_overview() from public, anon;
grant execute on function admin_overview() to authenticated;

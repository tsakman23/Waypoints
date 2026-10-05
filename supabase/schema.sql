-- Waypoints schema. Run once in the Supabase SQL editor.
-- Every table carries a user_id and a row-level security policy so each
-- user can only read and write their own rows.

-- Categories ----------------------------------------------------------------

create table categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  color      text not null,
  created_at timestamptz not null default now(),
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

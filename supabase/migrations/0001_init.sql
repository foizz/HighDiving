-- Dive lists, one row per list, owned by the signing-in user.
--
-- The dives themselves are stored as JSON rather than a child table: a list is always
-- exactly four slots, is always read and written whole, and is never queried by dive.

create table if not exists public.dive_lists (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'New list',
  rule_set    text not null check (rule_set in ('redbull', 'worldaquatics')),
  gender      text not null check (gender in ('men', 'women')),
  dives       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists dive_lists_user_updated_idx
  on public.dive_lists (user_id, updated_at desc);

alter table public.dive_lists enable row level security;

-- Each policy is scoped to the authenticated user, so one account can never read or
-- write another's lists even though every client shares the same anon key.
drop policy if exists "read own lists" on public.dive_lists;
create policy "read own lists" on public.dive_lists
  for select using (auth.uid() = user_id);

drop policy if exists "insert own lists" on public.dive_lists;
create policy "insert own lists" on public.dive_lists
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own lists" on public.dive_lists;
create policy "update own lists" on public.dive_lists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own lists" on public.dive_lists;
create policy "delete own lists" on public.dive_lists
  for delete using (auth.uid() = user_id);

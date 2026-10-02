-- Competition results, and the admin role allowed to upload them.
--
-- The two season rankings are computed from these rows and must never be merged:
-- the World Series ranking counts Red Bull tour stops only (rule 3.3.1), while the World
-- Ranking also counts World Aquatics High Diving World Cups (rule 6.2). That distinction
-- lives in the two boolean flags on `competitions` rather than being inferred from
-- `rule_set`, so a one-off event can be included in either table without special-casing.

create table if not exists public.divers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  country    text,
  gender     text not null check (gender in ('men', 'women')),
  created_at timestamptz not null default now(),
  unique (name, gender)
);

create table if not exists public.competitions (
  id                       uuid primary key default gen_random_uuid(),
  season                   int  not null,
  name                     text not null,
  location                 text,
  held_on                  date,
  -- Which book the event was judged under; also picks the DD table and panel size.
  rule_set                 text not null check (rule_set in ('redbull', 'worldaquatics')),
  gender                   text not null check (gender in ('men', 'women')),
  counts_for_series        boolean not null default false,
  counts_for_world_ranking boolean not null default true,
  created_at               timestamptz not null default now()
);

create index if not exists competitions_season_idx
  on public.competitions (season, gender);

create table if not exists public.results (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  diver_id       uuid not null references public.divers (id) on delete cascade,
  rank           int  not null check (rank >= 1),
  score          numeric(7, 2),
  -- The best dive of that competition: one point, World Series ranking only (rule 3.4.1).
  best_dive      boolean not null default false,
  created_at     timestamptz not null default now(),
  primary key (competition_id, diver_id)
);

create index if not exists results_competition_idx on public.results (competition_id);
create index if not exists results_diver_idx on public.results (diver_id);

-- Note: a finishing position is deliberately NOT unique within a competition. Divers do
-- tie, and the rules say so explicitly — "if two divers are in first place, both get the
-- prize money for the 1st place and ... both will get 20 points" (Red Bull 3.3.2). The
-- 2025 World Championships and the 2025 World Cup each have a shared placing.
-- The primary key already stops the same diver being recorded twice.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Per-user, per-day counter for assistant requests, so a runaway client cannot spend the
-- project's whole API budget. Enforced by the `ask` edge function before it calls Claude.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  calls   int  not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.divers       enable row level security;
alter table public.competitions enable row level security;
alter table public.results      enable row level security;
alter table public.admins       enable row level security;
alter table public.ai_usage     enable row level security;

-- `security definer` so the check itself does not need a readable `admins` row, which
-- would otherwise require a policy that recurses into this same function.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Standings are public to anyone signed in; only admins may change them.
do $$
declare t text;
begin
  foreach t in array array['divers', 'competitions', 'results'] loop
    execute format('drop policy if exists "read %1$s" on public.%1$I', t);
    execute format(
      'create policy "read %1$s" on public.%1$I for select to authenticated using (true)', t);

    execute format('drop policy if exists "admin writes %1$s" on public.%1$I', t);
    execute format(
      'create policy "admin writes %1$s" on public.%1$I for all to authenticated '
      'using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- A user may see whether they are an admin, and nothing about anyone else.
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- Usage rows are private to the user they belong to.
drop policy if exists "own usage" on public.ai_usage;
create policy "own usage" on public.ai_usage
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Make yourself an admin: run this once, with your own address.
-- Nothing else in the app can grant this, by design.
-- ---------------------------------------------------------------------------
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'you@example.com'
-- on conflict do nothing;

-- Base para: peso corporal, medidas, gordura nos macros e refeições favoritas.

-- ── Peso corporal ──
-- Um registro por dia (o peso oscila muito; a média móvel é calculada na tela).
create table if not exists public.body_weight (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  weight numeric not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.body_weight enable row level security;
drop policy if exists "own body weight" on public.body_weight;
create policy "own body weight" on public.body_weight
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists body_weight_user_date_idx
  on public.body_weight (user_id, date desc);

-- ── Medidas corporais (cm) ──
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  chest numeric,
  waist numeric,
  hip numeric,
  arm numeric,
  thigh numeric,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.body_measurements enable row level security;
drop policy if exists "own body measurements" on public.body_measurements;
create policy "own body measurements" on public.body_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists body_measurements_user_date_idx
  on public.body_measurements (user_id, date desc);

-- ── Gordura: fecha os três macros ──
alter table public.meals      add column if not exists fat integer;
alter table public.meal_slots add column if not exists fat_goal integer not null default 0;

-- ── Refeições favoritas ──
-- Evita redigitar o que se come todo dia (com 6 refeições diárias, o atrito
-- de digitar tudo é o que faz largar o app).
create table if not exists public.favorite_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  calories integer,
  protein integer,
  carbs integer,
  fat integer,
  -- Refeição da rotina onde costuma ser usada (opcional)
  slot_id uuid references public.meal_slots(id) on delete set null,
  times_used integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.favorite_meals enable row level security;
drop policy if exists "own favorite meals" on public.favorite_meals;
create policy "own favorite meals" on public.favorite_meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists favorite_meals_user_idx
  on public.favorite_meals (user_id, times_used desc);

-- ── Copiar a alimentação de um dia para outro ──
create or replace function public.copy_meals_from(p_from date, p_to date)
returns setof public.meals
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  insert into public.meals (user_id, date, name, calories, protein, carbs, fat, slot_id)
  select user_id, p_to, name, calories, protein, carbs, fat, slot_id
  from public.meals
  where user_id = auth.uid() and date = p_from;

  return query select * from public.meals where user_id = auth.uid() and date = p_to;
end;
$$;

revoke all on function public.copy_meals_from(date, date) from public, anon;
grant execute on function public.copy_meals_from(date, date) to authenticated;

-- ── Resumo de um período (alimenta o histórico e o resumo semanal) ──
create or replace function public.diet_daily_totals(p_from date, p_to date)
returns table (date date, kcal bigint, protein bigint, carbs bigint, fat bigint, items bigint)
language sql
security definer
stable
set search_path = ''
as $$
  select m.date,
         coalesce(sum(m.calories), 0),
         coalesce(sum(m.protein), 0),
         coalesce(sum(m.carbs), 0),
         coalesce(sum(m.fat), 0),
         count(*)
  from public.meals m
  where m.user_id = auth.uid() and m.date between p_from and p_to
  group by m.date
  order by m.date;
$$;

revoke all on function public.diet_daily_totals(date, date) from public, anon;
grant execute on function public.diet_daily_totals(date, date) to authenticated;

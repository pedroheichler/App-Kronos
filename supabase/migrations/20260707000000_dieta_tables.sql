-- Tabelas do app Dieta: hidratação, refeições e metas

-- ── Registros de água ──
create table if not exists public.water_intake (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  ml integer not null,
  created_at timestamptz default now()
);

alter table public.water_intake enable row level security;

drop policy if exists "own water" on public.water_intake;
create policy "own water" on public.water_intake
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists water_intake_user_date_idx
  on public.water_intake (user_id, date);

-- ── Refeições ──
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  name text not null,
  calories integer,
  protein integer,
  carbs integer,
  created_at timestamptz default now()
);

-- Garante a coluna em bases que já tinham a tabela sem ela
alter table public.meals add column if not exists carbs integer;

alter table public.meals enable row level security;

drop policy if exists "own meals" on public.meals;
create policy "own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists meals_user_date_idx
  on public.meals (user_id, date);

-- ── Configurações de dieta (metas) ──
create table if not exists public.diet_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  water_goal_ml integer not null default 2000,
  calorie_goal integer,
  protein_goal integer,
  updated_at timestamptz default now()
);

alter table public.diet_settings enable row level security;

drop policy if exists "own diet settings" on public.diet_settings;
create policy "own diet settings" on public.diet_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

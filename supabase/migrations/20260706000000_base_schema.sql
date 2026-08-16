-- Schema-base do Kronos.
-- Antes estas tabelas existiam apenas no projeto remoto, o que impedia um
-- `supabase db reset` de reconstruir o ambiente a partir do Git.

-- Finance --------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null check (amount >= 0),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  notes text,
  is_recurring boolean not null default false,
  installment_total integer check (installment_total is null or installment_total > 0),
  installment_current integer check (installment_current is null or installment_current > 0),
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, created_at desc);

create table if not exists public.spending_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric not null check (monthly_limit >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  initial_amount numeric not null default 0 check (initial_amount >= 0),
  current_value numeric not null default 0 check (current_value >= 0),
  type text not null,
  date timestamptz not null default now(),
  crypto_id text,
  quantity numeric check (quantity is null or quantity >= 0)
);

create index if not exists investments_user_date_idx
  on public.investments (user_id, date desc);

-- Treino ---------------------------------------------------------------------
create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.squad_members (
  squad_id uuid not null references public.squads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

create index if not exists squad_members_user_idx on public.squad_members (user_id);

create table if not exists public.workout_days (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  name text not null,
  focus text,
  day_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (squad_id, day_order)
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references public.workout_days(id) on delete cascade,
  name text not null,
  sets integer not null default 3 check (sets > 0 and sets <= 20),
  reps text not null default '10',
  rest text not null default '60s',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists exercises_day_idx
  on public.exercises (workout_day_id, created_at);

create table if not exists public.exercise_progress (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (exercise_id, user_id, date)
);

create index if not exists exercise_progress_user_date_idx
  on public.exercise_progress (user_id, date desc);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.tracked_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.exercise_loads (
  id uuid primary key default gen_random_uuid(),
  tracked_exercise_id uuid not null references public.tracked_exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  load_notes text not null,
  created_at timestamptz not null default now()
);

create index if not exists exercise_loads_user_date_idx
  on public.exercise_loads (user_id, date desc);

-- Todolist -------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  date date,
  time time,
  status text not null default 'pending' check (status in ('pending', 'done')),
  priority text check (priority is null or priority in ('high', 'medium', 'low')),
  project_id uuid references public.projects(id) on delete set null,
  recurrence text check (recurrence is null or recurrence in ('daily', 'weekly')),
  recurrence_days text,
  recurring_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks (user_id, date);
create index if not exists tasks_recurring_group_idx on public.tasks (user_id, recurring_group_id);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  frequency_days text,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, user_id, date)
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  created_at timestamptz not null default now()
);

create table if not exists public.board_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists board_items_board_idx on public.board_items (board_id, created_at);

-- Bloqueio padrão: as policies específicas são consolidadas na migração de hardening.
alter table public.transactions enable row level security;
alter table public.spending_goals enable row level security;
alter table public.investments enable row level security;
alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.workout_days enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_progress enable row level security;
alter table public.profiles enable row level security;
alter table public.tracked_exercises enable row level security;
alter table public.exercise_loads enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.boards enable row level security;
alter table public.board_items enable row level security;

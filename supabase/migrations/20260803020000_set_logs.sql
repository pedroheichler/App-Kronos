-- Cargas por série saem do localStorage e vão para o banco.
--
-- Antes ficavam só em `localStorage.kronos_set_loads`: trocar de aparelho,
-- limpar o cache ou usar o navegador anônimo apagava tudo silenciosamente.
--
-- Guardar peso e repetições como NÚMERO (e não texto livre) também abre caminho
-- para gráfico de progressão e detecção de recorde de verdade.

create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  date date not null default current_date,
  set_index integer not null,
  weight numeric,
  reps integer,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id, date, set_index)
);

alter table public.set_logs enable row level security;

drop policy if exists "own set logs" on public.set_logs;
create policy "own set logs" on public.set_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists set_logs_user_date_idx
  on public.set_logs (user_id, date);

create index if not exists set_logs_exercise_idx
  on public.set_logs (user_id, exercise_id, date desc);

-- Recorde por exercício: maior peso já registrado numa série concluída.
-- Usado para destacar PR sem depender do localStorage.
create or replace function public.exercise_personal_records()
returns table (exercise_id uuid, best_weight numeric)
language sql
security definer
stable
set search_path = ''
as $$
  select l.exercise_id, max(l.weight)
  from public.set_logs l
  where l.user_id = auth.uid()
    and l.weight is not null
    and l.done
  group by l.exercise_id;
$$;

revoke all on function public.exercise_personal_records() from public, anon;
grant execute on function public.exercise_personal_records() to authenticated;

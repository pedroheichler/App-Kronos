-- Modo treino em andamento: sessão, esforço percebido e exercício pulado.

-- ── RPE por série ──
-- Escala de esforço percebido (1–10). RIR (repetições em reserva) é o
-- complemento: RIR = 10 − RPE, então uma coluna só atende as duas leituras
-- e a tela decide qual mostrar.
alter table public.set_logs
  add column if not exists rpe smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'set_logs_rpe_range'
  ) then
    alter table public.set_logs
      add constraint set_logs_rpe_range check (rpe is null or (rpe between 1 and 10));
  end if;
end $$;

-- ── Exercício pulado ──
-- Diferente de "não feito": registra a intenção de pular (equipamento ocupado,
-- dor, falta de tempo) sem quebrar a sequência nem contar como concluído.
alter table public.exercise_progress
  add column if not exists skipped boolean not null default false;

-- ── Sessão de treino ──
-- Guarda o treino "em andamento": se o app fechar no meio, ao voltar o usuário
-- continua de onde parou, e no fim sobra a duração real da sessão.
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_day_id uuid references public.workout_days(id) on delete set null,
  date date not null default current_date,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Volume total da sessão (kg × reps), calculado ao encerrar
  total_volume numeric,
  created_at timestamptz not null default now()
);

alter table public.workout_sessions enable row level security;

drop policy if exists "own workout sessions" on public.workout_sessions;
create policy "own workout sessions" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, date desc);

-- Só uma sessão aberta por vez
create unique index if not exists workout_sessions_uma_aberta
  on public.workout_sessions (user_id) where ended_at is null;

-- ── Encerrar a sessão calculando o volume ──
create or replace function public.finish_workout_session(p_session_id uuid)
returns public.workout_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.workout_sessions;
  v_volume numeric;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  select * into v_session
  from public.workout_sessions
  where id = p_session_id and user_id = auth.uid();

  if v_session.id is null then
    raise exception 'sessao_invalida';
  end if;

  select coalesce(sum(l.weight * l.reps), 0) into v_volume
  from public.set_logs l
  where l.user_id = auth.uid()
    and l.date = v_session.date
    and l.done
    and l.weight is not null
    and l.reps is not null;

  update public.workout_sessions
     set ended_at = now(), total_volume = v_volume
   where id = p_session_id and user_id = auth.uid()
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.finish_workout_session(uuid) from public, anon;
grant execute on function public.finish_workout_session(uuid) to authenticated;

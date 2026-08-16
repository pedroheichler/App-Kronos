-- Consolida RLS das tabelas antigas que antes existiam apenas no projeto remoto.

create or replace function public.is_squad_member(p_squad_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.squad_members sm
     where sm.squad_id = p_squad_id
       and sm.user_id = auth.uid()
  );
$$;

create or replace function public.is_squad_admin(p_squad_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.squad_members sm
     where sm.squad_id = p_squad_id
       and sm.user_id = auth.uid()
       and sm.role = 'admin'
  );
$$;

create or replace function public.shares_squad_with(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p_user_id = auth.uid() or exists (
    select 1
      from public.squad_members mine
      join public.squad_members theirs on theirs.squad_id = mine.squad_id
     where mine.user_id = auth.uid()
       and theirs.user_id = p_user_id
  );
$$;

revoke all on function public.is_squad_member(uuid) from public, anon;
revoke all on function public.is_squad_admin(uuid) from public, anon;
revoke all on function public.shares_squad_with(uuid) from public, anon;
grant execute on function public.is_squad_member(uuid) to authenticated;
grant execute on function public.is_squad_admin(uuid) to authenticated;
grant execute on function public.shares_squad_with(uuid) to authenticated;

-- Remove policies antigas para evitar que uma policy permissiva sobreviva ao hardening.
do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'transactions', 'spending_goals', 'investments',
    'tasks', 'projects', 'habits', 'habit_completions', 'boards', 'board_items',
    'squad_members', 'workout_days', 'exercises', 'exercise_progress',
    'profiles', 'tracked_exercises', 'exercise_loads'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    for v_policy in
      select policyname
        from pg_policies
       where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy %I on public.%I', v_policy.policyname, v_table);
    end loop;
  end loop;
end;
$$;

-- Dados estritamente pessoais.
create policy "own transactions" on public.transactions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own spending goals" on public.spending_goals
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own investments" on public.investments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tasks" on public.tasks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own projects" on public.projects
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own habits" on public.habits
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own habit completions" on public.habit_completions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own boards" on public.boards
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own board items" on public.board_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tracked exercises" on public.tracked_exercises
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own exercise loads" on public.exercise_loads
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Membros podem ver a equipe; apenas o próprio usuário sai e admins gerenciam.
create policy "members view squad members" on public.squad_members
  for select to authenticated using (public.is_squad_member(squad_id));
create policy "creator adds first admin" on public.squad_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and role = 'admin'
    and exists (
      select 1 from public.squads s
       where s.id = squad_id and s.created_by = auth.uid()
    )
  );
create policy "member leaves squad" on public.squad_members
  for delete to authenticated using (user_id = auth.uid() or public.is_squad_admin(squad_id));
create policy "admin updates members" on public.squad_members
  for update to authenticated
  using (public.is_squad_admin(squad_id))
  with check (public.is_squad_admin(squad_id));

create policy "members view workout days" on public.workout_days
  for select to authenticated using (public.is_squad_member(squad_id));
create policy "admins create workout days" on public.workout_days
  for insert to authenticated with check (public.is_squad_admin(squad_id));
create policy "admins update workout days" on public.workout_days
  for update to authenticated
  using (public.is_squad_admin(squad_id))
  with check (public.is_squad_admin(squad_id));
create policy "admins delete workout days" on public.workout_days
  for delete to authenticated using (public.is_squad_admin(squad_id));

create policy "members view exercises" on public.exercises
  for select to authenticated using (
    exists (
      select 1 from public.workout_days wd
       where wd.id = workout_day_id and public.is_squad_member(wd.squad_id)
    )
  );
create policy "admins create exercises" on public.exercises
  for insert to authenticated with check (
    exists (
      select 1 from public.workout_days wd
       where wd.id = workout_day_id and public.is_squad_admin(wd.squad_id)
    )
  );
create policy "admins update exercises" on public.exercises
  for update to authenticated
  using (
    exists (
      select 1 from public.workout_days wd
       where wd.id = workout_day_id and public.is_squad_admin(wd.squad_id)
    )
  )
  with check (
    exists (
      select 1 from public.workout_days wd
       where wd.id = workout_day_id and public.is_squad_admin(wd.squad_id)
    )
  );
create policy "admins delete exercises" on public.exercises
  for delete to authenticated using (
    exists (
      select 1 from public.workout_days wd
       where wd.id = workout_day_id and public.is_squad_admin(wd.squad_id)
    )
  );

-- Ranking pode ler progresso de colegas de squad; escrita continua sendo própria.
create policy "squad views exercise progress" on public.exercise_progress
  for select to authenticated using (public.shares_squad_with(user_id));
create policy "own exercise progress insert" on public.exercise_progress
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own exercise progress update" on public.exercise_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own exercise progress delete" on public.exercise_progress
  for delete to authenticated using (auth.uid() = user_id);

create policy "squad views profiles" on public.profiles
  for select to authenticated using (public.shares_squad_with(id));
create policy "own profile insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "own profile delete" on public.profiles
  for delete to authenticated using (auth.uid() = id);

-- Criação de squad é atômica: squad, admin e sete dias ou nada.
create or replace function public.create_squad(p_name text, p_personal boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_squad_id uuid;
  v_invite_code text;
  v_day text;
  v_position integer := 0;
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if length(trim(p_name)) < 2 or length(trim(p_name)) > 80 then
    raise exception 'nome_invalido';
  end if;

  loop
    v_invite_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.squads where invite_code = v_invite_code
    );
  end loop;

  insert into public.squads (name, created_by, invite_code, is_personal)
  values (trim(p_name), auth.uid(), v_invite_code, p_personal)
  returning id into v_squad_id;

  insert into public.squad_members (squad_id, user_id, role)
  values (v_squad_id, auth.uid(), 'admin');

  foreach v_day in array array['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
  loop
    insert into public.workout_days (squad_id, name, day_order)
    values (v_squad_id, v_day, v_position);
    v_position := v_position + 1;
  end loop;

  return v_squad_id;
end;
$$;

revoke all on function public.create_squad(text, boolean) from public, anon;
grant execute on function public.create_squad(text, boolean) to authenticated;

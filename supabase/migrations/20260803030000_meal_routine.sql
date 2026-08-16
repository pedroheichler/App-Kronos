-- Rotina alimentar: o usuário define suas refeições do dia (café, almoço,
-- lanches, jantar, ceia) e cada uma tem meta própria de kcal, proteína e carbo.
--
-- Antes existia só uma meta diária solta e as refeições eram uma lista única.
-- Agora cada refeição registrada pertence a um "slot" da rotina, e dá para ver
-- se bateu a meta daquela refeição específica.

create table if not exists public.meal_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position integer not null,
  -- Horário sugerido, só informativo (ex: "07:00")
  time_hint text,
  kcal_goal integer not null default 0,
  protein_goal integer not null default 0,
  carbs_goal integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, position)
);

alter table public.meal_slots enable row level security;

drop policy if exists "own meal slots" on public.meal_slots;
create policy "own meal slots" on public.meal_slots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Liga a refeição registrada ao slot da rotina
alter table public.meals
  add column if not exists slot_id uuid
  references public.meal_slots(id) on delete set null;

create index if not exists meals_slot_idx on public.meals (slot_id);

-- ── Rotina padrão ──
-- Cria as 6 refeições na primeira vez, distribuindo a meta diária do usuário
-- (ou 2500 kcal / 150 g de proteína / 280 g de carbo como ponto de partida).
create or replace function public.ensure_meal_routine()
returns setof public.meal_slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kcal integer;
  v_prot integer;
  v_carb integer;
  -- nome, horário, % das calorias, % da proteína
  v_defaults constant text[][] := array[
    array['Café da manhã',    '07:00', '20', '20'],
    array['Lanche da manhã',  '10:00', '10', '10'],
    array['Almoço',           '12:30', '30', '30'],
    array['Lanche da tarde',  '16:00', '10', '10'],
    array['Jantar',           '19:30', '25', '25'],
    array['Ceia',             '22:00', '5',  '5']
  ];
  v_row text[];
  i integer := 0;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  if exists (select 1 from public.meal_slots where user_id = auth.uid()) then
    return query select * from public.meal_slots where user_id = auth.uid() order by position;
    return;
  end if;

  select coalesce(calorie_goal, 2500), coalesce(protein_goal, 150)
    into v_kcal, v_prot
    from public.diet_settings where user_id = auth.uid();

  v_kcal := coalesce(v_kcal, 2500);
  v_prot := coalesce(v_prot, 150);
  v_carb := 280;

  foreach v_row slice 1 in array v_defaults loop
    insert into public.meal_slots (user_id, name, position, time_hint, kcal_goal, protein_goal, carbs_goal)
    values (
      auth.uid(),
      v_row[1],
      i,
      v_row[2],
      round(v_kcal * v_row[3]::numeric / 100),
      round(v_prot * v_row[4]::numeric / 100),
      round(v_carb * v_row[3]::numeric / 100)
    );
    i := i + 1;
  end loop;

  return query select * from public.meal_slots where user_id = auth.uid() order by position;
end;
$$;

revoke all on function public.ensure_meal_routine() from public, anon;
grant execute on function public.ensure_meal_routine() to authenticated;

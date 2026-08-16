-- A rotina padrão deve ser criada UMA vez só.
--
-- Sem isso, apagar todas as refeições fazia as 6 padrão voltarem no próximo
-- carregamento — o usuário não conseguiria montar a rotina do zero. É o mesmo
-- problema que a recorrência do Finance tinha: sem registrar que já gerou, não
-- há como distinguir "apaguei de propósito" de "nunca criei".

alter table public.diet_settings
  add column if not exists routine_seeded boolean not null default false;

-- Quem já tem rotina criada não deve ser semeado de novo
insert into public.diet_settings (user_id, routine_seeded)
select distinct user_id, true from public.meal_slots
on conflict (user_id) do update set routine_seeded = true;

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
  v_seeded boolean;
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

  select coalesce(routine_seeded, false), coalesce(calorie_goal, 2500), coalesce(protein_goal, 150)
    into v_seeded, v_kcal, v_prot
    from public.diet_settings where user_id = auth.uid();

  -- Já semeada uma vez: devolve o que existir (mesmo que vazio, se o usuário
  -- apagou tudo de propósito)
  if coalesce(v_seeded, false) then
    return query select * from public.meal_slots where user_id = auth.uid() order by position;
    return;
  end if;

  v_kcal := coalesce(v_kcal, 2500);
  v_prot := coalesce(v_prot, 150);
  v_carb := 280;

  foreach v_row slice 1 in array v_defaults loop
    insert into public.meal_slots (user_id, name, position, time_hint, kcal_goal, protein_goal, carbs_goal)
    values (
      auth.uid(), v_row[1], i, v_row[2],
      round(v_kcal * v_row[3]::numeric / 100),
      round(v_prot * v_row[4]::numeric / 100),
      round(v_carb * v_row[3]::numeric / 100)
    );
    i := i + 1;
  end loop;

  insert into public.diet_settings (user_id, routine_seeded)
  values (auth.uid(), true)
  on conflict (user_id) do update set routine_seeded = true;

  return query select * from public.meal_slots where user_id = auth.uid() order by position;
end;
$$;

revoke all on function public.ensure_meal_routine() from public, anon;
grant execute on function public.ensure_meal_routine() to authenticated;

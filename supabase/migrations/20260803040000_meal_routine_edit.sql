-- Permite adicionar e remover refeições da rotina.
--
-- A restrição de unicidade em (user_id, position) atrapalhava a reordenação:
-- ao remover uma refeição do meio, as seguintes precisam subir de posição e o
-- Postgres reclamava do conflito no meio da atualização. A ordem continua vindo
-- de `position` — ela só não precisa mais ser única.
alter table public.meal_slots
  drop constraint if exists meal_slots_user_id_position_key;

create index if not exists meal_slots_user_pos_idx
  on public.meal_slots (user_id, position);

-- Salva a rotina inteira de uma vez: remove o que saiu, cria o que entrou e
-- atualiza o resto. Tudo numa transação só, para nunca ficar pela metade.
create or replace function public.save_meal_routine(p_slots jsonb)
returns setof public.meal_slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_keep uuid[] := array[]::uuid[];
  v_id uuid;
  i integer := 0;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  if jsonb_typeof(p_slots) <> 'array' then
    raise exception 'payload_invalido';
  end if;

  for v_item in select * from jsonb_array_elements(p_slots) loop
    v_id := nullif(v_item->>'id', '')::uuid;

    if v_id is null or not exists (
      select 1 from public.meal_slots where id = v_id and user_id = auth.uid()
    ) then
      -- Refeição nova
      insert into public.meal_slots (user_id, name, position, time_hint, kcal_goal, protein_goal, carbs_goal)
      values (
        auth.uid(),
        coalesce(nullif(trim(v_item->>'name'), ''), 'Refeição'),
        i,
        nullif(trim(coalesce(v_item->>'time_hint', '')), ''),
        greatest(0, coalesce((v_item->>'kcal_goal')::int, 0)),
        greatest(0, coalesce((v_item->>'protein_goal')::int, 0)),
        greatest(0, coalesce((v_item->>'carbs_goal')::int, 0))
      )
      returning id into v_id;
    else
      update public.meal_slots set
        name         = coalesce(nullif(trim(v_item->>'name'), ''), 'Refeição'),
        position     = i,
        time_hint    = nullif(trim(coalesce(v_item->>'time_hint', '')), ''),
        kcal_goal    = greatest(0, coalesce((v_item->>'kcal_goal')::int, 0)),
        protein_goal = greatest(0, coalesce((v_item->>'protein_goal')::int, 0)),
        carbs_goal   = greatest(0, coalesce((v_item->>'carbs_goal')::int, 0))
      where id = v_id and user_id = auth.uid();
    end if;

    v_keep := v_keep || v_id;
    i := i + 1;
  end loop;

  -- O que ficou de fora foi removido pelo usuário.
  -- As refeições já registradas nesses slots não somem: o slot_id vira null
  -- (ON DELETE SET NULL) e elas aparecem como "Fora da rotina".
  delete from public.meal_slots
  where user_id = auth.uid()
    and not (id = any(v_keep));

  return query select * from public.meal_slots where user_id = auth.uid() order by position;
end;
$$;

revoke all on function public.save_meal_routine(jsonb) from public, anon;
grant execute on function public.save_meal_routine(jsonb) to authenticated;

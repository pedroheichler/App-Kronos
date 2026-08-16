-- CORREÇÃO DE SEGURANÇA: a tabela `squads` estava legível por qualquer pessoa,
-- expondo nome e invite_code de todos os squads. Como a chave anônima é pública
-- (vai no bundle JS), qualquer um podia listar os squads, pegar os códigos e
-- entrar neles para ver os treinos dos outros.
--
-- Agora só dá para ver squads dos quais você participa. A entrada por código de
-- convite passa a ser feita por uma função no servidor, que não expõe a lista.

-- ── Helpers (SECURITY DEFINER para não disparar RLS recursivo) ──
create or replace function public.is_squad_member(p_squad_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.squad_members
    where squad_id = p_squad_id and user_id = auth.uid()
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
    select 1 from public.squad_members
    where squad_id = p_squad_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- ── Recria as policies de `squads` do zero ──
alter table public.squads enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'squads'
  loop
    execute format('drop policy %I on public.squads', pol.policyname);
  end loop;
end $$;

-- Ver: apenas squads em que você está (ou que você criou)
create policy "ver squads que participo" on public.squads
  for select
  using (public.is_squad_member(id) or created_by = auth.uid());

-- Criar: só em nome próprio
create policy "criar squad proprio" on public.squads
  for insert
  with check (created_by = auth.uid());

-- Editar: só admin do squad
create policy "admin edita squad" on public.squads
  for update
  using (public.is_squad_admin(id) or created_by = auth.uid())
  with check (public.is_squad_admin(id) or created_by = auth.uid());

-- Apagar: só quem criou
create policy "criador apaga squad" on public.squads
  for delete
  using (created_by = auth.uid());

-- ── Entrada por código de convite ──
-- Roda no servidor: acha o squad pelo código e insere a associação, sem que o
-- cliente precise de permissão para ler a tabela inteira.
create or replace function public.join_squad_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_squad_id uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  select id into v_squad_id
  from public.squads
  where upper(invite_code) = upper(trim(p_code))
    and coalesce(is_personal, false) = false
  limit 1;

  if v_squad_id is null then
    raise exception 'codigo_invalido';
  end if;

  insert into public.squad_members (squad_id, user_id, role)
  values (v_squad_id, auth.uid(), 'member')
  on conflict do nothing;

  return v_squad_id;
end;
$$;

revoke all on function public.join_squad_by_code(text) from public, anon;
grant execute on function public.join_squad_by_code(text) to authenticated;

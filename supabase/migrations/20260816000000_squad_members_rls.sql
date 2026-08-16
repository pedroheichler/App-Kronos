-- CORREÇÃO DE SEGURANÇA: qualquer usuário autenticado conseguia se inserir em
-- `squad_members` informando um squad_id, entrando numa equipe sem o código de
-- convite. Bastava conhecer o id do squad (por um link antigo, por já ter sido
-- membro, ou por qualquer vazamento pontual) para voltar a ver os treinos e o
-- progresso de todo mundo.
--
-- Encontrado pelo teste de isolamento entre dois usuários (tests/isolation.test.mjs).
--
-- A entrada em equipe passa a ter só três caminhos legítimos:
--   1. você acabou de criar o squad (é o dono);
--   2. um admin do squad adicionou você;
--   3. você usou o código de convite — que roda em `join_squad_by_code`,
--      função SECURITY DEFINER e portanto fora do alcance do RLS.

alter table public.squad_members enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'squad_members'
  loop
    execute format('drop policy %I on public.squad_members', pol.policyname);
  end loop;
end $$;

-- Ver: os membros das equipes das quais você participa
create policy "ver membros do proprio squad" on public.squad_members
  for select
  using (
    user_id = auth.uid()
    or public.is_squad_member(squad_id)
  );

-- Entrar: só no squad que você criou, ou sendo adicionado por um admin.
-- O convite por código não passa por aqui (a função é SECURITY DEFINER).
create policy "entrar apenas em squad proprio ou por admin" on public.squad_members
  for insert
  with check (
    (
      user_id = auth.uid()
      and exists (
        select 1 from public.squads s
        where s.id = squad_id and s.created_by = auth.uid()
      )
    )
    or public.is_squad_admin(squad_id)
  );

-- Alterar papel: só admin do squad
create policy "admin altera papeis" on public.squad_members
  for update
  using (public.is_squad_admin(squad_id))
  with check (public.is_squad_admin(squad_id));

-- Sair: você remove a si mesmo; admin pode remover outros
create policy "sair do squad ou admin remover" on public.squad_members
  for delete
  using (
    user_id = auth.uid()
    or public.is_squad_admin(squad_id)
  );

-- Separa a REGRA de recorrência das TRANSAÇÕES geradas por ela.
--
-- Antes, o app olhava "existe uma transação recorrente neste mês?" para decidir
-- se devia criar. Isso tinha dois defeitos:
--   1. Apagar a transação do mês fazia ela voltar no próximo carregamento,
--      porque não havia como distinguir "apaguei de propósito" de "não gerou".
--   2. Abrir o app em dois lugares ao mesmo tempo gerava duplicatas.
--
-- Agora a regra guarda até quando já gerou, e a geração acontece numa função
-- transacional no servidor.

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  notes text,
  active boolean not null default true,
  -- Primeiro dia do último mês já gerado (null = nunca gerou)
  last_generated_month date,
  created_at timestamptz not null default now()
);

alter table public.recurring_rules enable row level security;

drop policy if exists "own recurring rules" on public.recurring_rules;
create policy "own recurring rules" on public.recurring_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists recurring_rules_user_idx
  on public.recurring_rules (user_id) where active;

-- Liga a transação à regra que a gerou
alter table public.transactions
  add column if not exists recurring_rule_id uuid
  references public.recurring_rules(id) on delete set null;

create index if not exists transactions_rule_idx
  on public.transactions (recurring_rule_id);

-- ── Converte os dados existentes ──
-- Cada combinação (título, categoria, tipo) marcada como recorrente vira uma
-- regra. O mês da instância mais recente é registrado como já gerado, para não
-- duplicar nada no primeiro uso.
do $$
declare
  rec record;
  v_rule_id uuid;
begin
  -- Só roda se ainda não houver regras (evita duplicar em re-execuções)
  if exists (select 1 from public.recurring_rules) then
    return;
  end if;

  for rec in
    select
      user_id,
      title,
      category,
      type,
      (array_agg(amount order by created_at desc))[1] as amount,
      (array_agg(notes  order by created_at desc))[1] as notes,
      date_trunc('month', max(created_at))::date       as last_month
    from public.transactions
    where is_recurring is true
    group by user_id, title, category, type
  loop
    insert into public.recurring_rules
      (user_id, title, amount, type, category, notes, last_generated_month)
    values
      (rec.user_id, rec.title, rec.amount, rec.type, rec.category, rec.notes, rec.last_month)
    returning id into v_rule_id;

    update public.transactions t
       set recurring_rule_id = v_rule_id
     where t.user_id = rec.user_id
       and t.title = rec.title
       and t.category = rec.category
       and t.type = rec.type
       and t.is_recurring is true;
  end loop;
end $$;

-- ── Geração das transações do mês ──
-- Roda tudo numa transação só: sem duplicata mesmo com dois dispositivos
-- abrindo o app ao mesmo tempo.
create or replace function public.generate_recurring_transactions()
returns setof public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now())::date;
  r record;
  v_new public.transactions;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  for r in
    select * from public.recurring_rules
    where user_id = auth.uid()
      and active
      and (last_generated_month is null or last_generated_month < v_month)
    for update
  loop
    insert into public.transactions
      (user_id, title, amount, type, category, notes, is_recurring, recurring_rule_id, created_at)
    values
      (r.user_id, r.title, r.amount, r.type, r.category, r.notes, true, r.id, v_month)
    returning * into v_new;

    update public.recurring_rules
       set last_generated_month = v_month
     where id = r.id;

    return next v_new;
  end loop;
end;
$$;

revoke all on function public.generate_recurring_transactions() from public, anon;
grant execute on function public.generate_recurring_transactions() to authenticated;

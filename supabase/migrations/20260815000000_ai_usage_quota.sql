-- Quota transacional da Edge Function de IA.
-- A tabela não é exposta ao cliente: apenas service_role pode consumir a RPC.

create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  reserved_tokens integer not null default 0 check (reserved_tokens >= 0),
  operation_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;

-- Sem policies: anon/authenticated não podem ler nem alterar a própria quota.
revoke all on table public.ai_usage_daily from public, anon, authenticated;
grant all on table public.ai_usage_daily to service_role;

create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_operation text,
  p_reserved_tokens integer,
  p_request_limit integer,
  p_token_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_user_id is null
     or p_operation not in ('workout-chat', 'food-analysis', 'weekly-report')
     or p_reserved_tokens <= 0
     or p_request_limit <= 0
     or p_token_limit <= 0 then
    return false;
  end if;

  insert into public.ai_usage_daily (user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  update public.ai_usage_daily
     set request_count = request_count + 1,
         reserved_tokens = reserved_tokens + p_reserved_tokens,
         operation_counts = jsonb_set(
           operation_counts,
           array[p_operation],
           to_jsonb(coalesce((operation_counts ->> p_operation)::integer, 0) + 1),
           true
         ),
         updated_at = now()
   where user_id = p_user_id
     and usage_date = current_date
     and request_count < p_request_limit
     and reserved_tokens + p_reserved_tokens <= p_token_limit;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer, integer, integer)
  to service_role;

create index if not exists ai_usage_daily_date_idx
  on public.ai_usage_daily (usage_date desc);

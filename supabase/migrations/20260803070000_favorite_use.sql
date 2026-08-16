-- Conta quantas vezes cada favorito foi usado, para os mais frequentes
-- aparecerem primeiro na lista.
create or replace function public.increment_favorite_use(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.favorite_meals
     set times_used = times_used + 1
   where id = p_id and user_id = auth.uid();
$$;

revoke all on function public.increment_favorite_use(uuid) from public, anon;
grant execute on function public.increment_favorite_use(uuid) to authenticated;

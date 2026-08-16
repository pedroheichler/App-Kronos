-- Buckets de imagens com limites e policies por caminho.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('squad-icons', 'squad-icons', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_squad_storage_path(p_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_folder text;
begin
  v_folder := (storage.foldername(p_name))[1];
  if v_folder is null or v_folder !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;

  return exists (
    select 1
      from public.squad_members sm
     where sm.squad_id = v_folder::uuid
       and sm.user_id = auth.uid()
       and sm.role = 'admin'
  );
exception when invalid_text_representation then
  return false;
end;
$$;

revoke all on function public.can_manage_squad_storage_path(text) from public, anon;
grant execute on function public.can_manage_squad_storage_path(text) to authenticated;

drop policy if exists "avatar upload proprio" on storage.objects;
drop policy if exists "avatar update proprio" on storage.objects;
drop policy if exists "avatar delete proprio" on storage.objects;
drop policy if exists "admin gerencia icone squad" on storage.objects;

create policy "avatar upload proprio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar update proprio" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar delete proprio" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admin gerencia icone squad" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'squad-icons'
    and public.can_manage_squad_storage_path(name)
  )
  with check (
    bucket_id = 'squad-icons'
    and public.can_manage_squad_storage_path(name)
  );

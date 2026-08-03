-- Permite treinar sozinho: o app cria um "espaço pessoal" automaticamente
-- para quem não está em nenhuma equipe. Entrar num squad passa a ser opcional.

alter table public.squads
  add column if not exists is_personal boolean not null default false;

-- Índice para achar rápido o espaço pessoal do usuário
create index if not exists squads_personal_idx
  on public.squads (created_by) where is_personal;

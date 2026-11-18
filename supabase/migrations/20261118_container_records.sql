-- =====================================================================
-- Import / Export: fichas de contenedor guardadas
-- Cada operación (una conversación de Outlook) se guarda por su id.
--   overrides: solo los campos editados a mano (se aplican sobre lo que viene del correo,
--              así los mensajes nuevos del hilo siguen actualizando el resto)
--   snapshot:  la ficha completa al guardar (se muestra aunque el correo ya no esté en el buzón)
-- Idempotente: se puede correr más de una vez.
-- =====================================================================

create table if not exists public.container_records (
  operation_id text primary key,                 -- conversationId de Outlook
  type         text not null check (type in ('impo', 'expo')),
  container    text,
  reference    text,
  client       text,
  overrides    jsonb not null default '{}'::jsonb,
  snapshot     jsonb not null,
  updated_by   text,                             -- email de quien guardó
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists container_records_container_idx on public.container_records(container);
create index if not exists container_records_updated_idx on public.container_records(updated_at desc);

alter table public.container_records enable row level security;

do $$
begin
  create policy "Auth users can manage container_records" on public.container_records
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- Realtime: lo que guarda un usuario aparece al instante a los demás
do $$
begin
  alter publication supabase_realtime add table public.container_records;
exception when duplicate_object then null;
end $$;

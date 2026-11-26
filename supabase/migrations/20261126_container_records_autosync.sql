-- =====================================================================
-- Import / Export: cada operación que llega por correo se respalda sola en container_records.
--   snapshot      = lo que dice el correo (se actualiza en cada carga)
--   overrides     = correcciones manuales (ej. FCL -> LCL); nunca las pisa la sincronización
--   synced_at     = última vez que se respaldó desde Outlook
--   updated_at/by = última corrección manual (updated_by null = solo respaldo automático)
-- Idempotente: se puede correr más de una vez.
-- =====================================================================
alter table public.container_records add column if not exists synced_at      timestamptz;
alter table public.container_records add column if not exists cargo_mode     text;  -- fcl | lcl (con la corrección aplicada)
alter table public.container_records add column if not exists source_mailbox text;  -- buzón que lo trajo

create index if not exists container_records_cargo_mode_idx on public.container_records(cargo_mode);

notify pgrst, 'reload schema';

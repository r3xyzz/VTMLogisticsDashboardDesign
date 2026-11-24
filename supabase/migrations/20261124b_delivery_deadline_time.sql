-- 20261124b_delivery_deadline_time.sql
-- Plazo de entrega para el chofer: hora límite (la fecha ya existe en delivery_date).
-- Idempotente.
alter table public.coordination_services add column if not exists delivery_time text; -- HH:MM, "entregar a más tardar"

-- Que la API reconozca la columna nueva sin esperar
notify pgrst, 'reload schema';

-- Coordinación: rutas de hasta 4 puntos (retiro → parada 1 → parada 2 → entrega)
-- Idempotente: se puede correr más de una vez.
alter table public.coordination_services add column if not exists stops text[] not null default '{}';

-- =====================================================================
-- Poder eliminar vehículos de Flota
-- =====================================================================
-- Mismo problema que con conductores (20261127c): tablas antiguas o creadas
-- a mano (trip_assignments, drivers.current_fleet_id, ...) tienen claves
-- foráneas a fleet sin regla de borrado y bloquean el DELETE.
--
-- Solución: toda clave foránea hacia fleet(id) sin regla (NO ACTION /
-- RESTRICT) en una columna que acepta vacío pasa a ON DELETE SET NULL: el
-- registro se conserva y queda sin vehículo. Las que ya tienen regla
-- (orders, incidents, yard_movements: set null; fleet_maintenance: cascade)
-- no se tocan. Columnas NOT NULL se dejan como están.
-- Idempotente: se puede ejecutar más de una vez.
-- =====================================================================

do $$
declare
  fk record;
begin
  for fk in
    select c.conname,
           c.conrelid::regclass as tbl,
           a.attname           as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.fleet'::regclass
      and array_length(c.conkey, 1) = 1
      and c.confdeltype in ('a', 'r')          -- NO ACTION / RESTRICT
      and not a.attnotnull
  loop
    execute format('alter table %s drop constraint %I', fk.tbl, fk.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.fleet(id) on delete set null',
                   fk.tbl, fk.conname, fk.col);
    raise notice '% .% -> on delete set null', fk.tbl, fk.col;
  end loop;
end
$$;

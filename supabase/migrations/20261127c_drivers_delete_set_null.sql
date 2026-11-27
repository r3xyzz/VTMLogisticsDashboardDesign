-- =====================================================================
-- Poder eliminar conductores
-- =====================================================================
-- Problema: "Key is still referenced from table trip_assignments" al
-- eliminar un conductor. trip_assignments (tabla antigua, ya no la usa la
-- app) y otras tablas creadas a mano tienen claves foráneas a drivers sin
-- regla de borrado, así que bloquean el DELETE.
--
-- Solución: toda clave foránea hacia drivers(id) sin regla (NO ACTION /
-- RESTRICT) pasa a ON DELETE SET NULL: el registro se conserva y queda sin
-- conductor. Excepciones:
--   - orders: una OT con chofer sigue bloqueando el borrado (historial de
--     viajes). Para esos conductores, usar "Desactivar".
--   - columnas NOT NULL: no pueden quedar vacías, se dejan como están.
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
      and c.confrelid = 'public.drivers'::regclass
      and array_length(c.conkey, 1) = 1
      and c.confdeltype in ('a', 'r')          -- NO ACTION / RESTRICT
      and c.conrelid <> 'public.orders'::regclass
      and not a.attnotnull
  loop
    execute format('alter table %s drop constraint %I', fk.tbl, fk.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.drivers(id) on delete set null',
                   fk.tbl, fk.conname, fk.col);
    raise notice '% .% -> on delete set null', fk.tbl, fk.col;
  end loop;
end
$$;

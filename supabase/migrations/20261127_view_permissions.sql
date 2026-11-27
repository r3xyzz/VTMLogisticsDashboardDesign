-- =====================================================================
-- Permisos por vista validados en la base de datos
-- =====================================================================
-- Problema: la app ocultaba las vistas según role_permissions, pero la base
-- solo exigía estar en authorized_users. Con el token (consola del navegador)
-- un usuario sin permiso de Facturación podía leer igual la tabla invoices.
--
-- Solución:
--   1. public.my_access(): rol y permisos del usuario conectado. La app lo usa
--      para decidir qué vistas mostrar (única fuente de verdad).
--   2. public.has_view_permission(vistas): true si el usuario tiene permiso
--      en alguna de esas vistas.
--   3. Política RESTRICTIVA en cada tabla: solo pasan los usuarios que tienen
--      alguna de las vistas que usan esa tabla.
--
-- Reglas de rol (las mismas que tenía la app):
--   driver                          -> solo Camioneros
--   admin sin fila en role_permissions -> todas las vistas
--   resto                           -> columnas can_view_* de su fila en role_permissions
--
-- Es idempotente: se puede ejecutar más de una vez.
-- Las tablas que no están en la lista del bloque 3 quedan como antes
-- (cualquier usuario de authorized_users).
-- IMPORTANTE: si una vista empieza a usar otra tabla, agrega la vista en la
-- lista de esa tabla (bloque 3) y vuelve a ejecutar este archivo.
-- Requiere 20261123_restrict_rls_to_authorized_users.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rol y permisos del usuario conectado
-- ---------------------------------------------------------------------
-- Devuelve {"role": "...", "permissions": {"can_view_dashboard": true, ...}}
-- o null si el usuario no está activo en authorized_users.
create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'role', u.role,
    'permissions', case
      when u.role = 'driver' then jsonb_build_object('can_view_camioneros', true)
      when u.role = 'admin' and rp.role is null then (
        select coalesce(jsonb_object_agg(c.column_name, true), '{}'::jsonb)
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'role_permissions'
          and c.column_name like 'can\_view\_%'
      )
      when rp.role is null then '{}'::jsonb
      else (
        select coalesce(jsonb_object_agg(p.key, p.value = 'true'::jsonb), '{}'::jsonb)
        from jsonb_each(to_jsonb(rp)) p
        where p.key like 'can\_view\_%'
      )
    end
  )
  from public.authorized_users u
  left join public.role_permissions rp on rp.role = u.role
  where lower(u.email) = lower(auth.jwt() ->> 'email')
    and u.is_active
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 2. ¿Tiene permiso en alguna de estas vistas? (ej. array['facturacion', 'dashboard'])
-- ---------------------------------------------------------------------
create or replace function public.has_view_permission(views text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from jsonb_each(public.my_access() -> 'permissions') p
    where p.value = 'true'::jsonb
      and p.key in (select 'can_view_' || v from unnest(views) v)
  );
$$;

revoke all on function public.my_access() from public, anon;
revoke all on function public.has_view_permission(text[]) from public, anon;
grant execute on function public.my_access() to authenticated;
grant execute on function public.has_view_permission(text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Tabla -> vistas que la usan (lectura o escritura, incluye las que
--    la traen dentro de otra consulta, ej. orders -> clients(name))
-- ---------------------------------------------------------------------
do $$
declare
  rule record;
begin
  for rule in
    select *
    from (values
      -- Facturación
      ('invoices',             array['facturacion', 'dashboard']),
      ('shipments',            array['facturacion']),
      ('document_repository',  array['facturacion']),
      -- Cálculo
      ('calculations',         array['calculations']),
      ('calculation_columns',  array['calculations']),
      ('calculation_items',    array['calculations']),
      ('calculation_values',   array['calculations']),
      -- Import / Export
      ('container_records',    array['importexport']),
      -- POD · Documentos
      ('client_notifications', array['documents']),
      -- Coordinación
      ('coordination_boards',  array['coordination']),
      ('coordination_services', array['coordination', 'cargo', 'camioneros', 'dashboard']),
      -- Jefatura de Patio
      ('fleet_maintenance',    array['patio']),
      ('yard_movements',       array['patio']),
      ('yard_helpers',         array['patio']),
      ('crane_requests',       array['patio']),
      ('driver_daily_hours',   array['patio']),
      ('incidents',            array['patio']),
      -- Tablas compartidas
      ('orders',               array['cargo', 'documents', 'providers', 'camioneros', 'coordination', 'patio', 'dashboard']),
      ('documents',            array['documents', 'camioneros', 'providers', 'cargo', 'dashboard']),
      ('clients',              array['clients', 'cargo', 'email', 'documents', 'camioneros', 'dashboard']),
      ('providers',            array['providers', 'cargo', 'documents', 'patio', 'camioneros', 'dashboard']),
      ('drivers',              array['drivers', 'fleet', 'cargo', 'patio', 'coordination', 'camioneros', 'dashboard']),
      ('fleet',                array['fleet', 'drivers', 'cargo', 'documents', 'patio', 'coordination', 'camioneros', 'dashboard'])
    ) as r(tbl, views)
  loop
    if to_regclass(format('public.%I', rule.tbl)) is null then
      continue; -- la tabla no existe en esta base
    end if;
    execute format('drop policy if exists "authz: view permission" on public.%I', rule.tbl);
    -- (select ...) hace que la función se evalúe una vez por consulta y no por cada fila
    execute format(
      'create policy "authz: view permission" on public.%I
         as restrictive for all to public
         using ((select public.has_view_permission(%L::text[])))
         with check ((select public.has_view_permission(%L::text[])))',
      rule.tbl, rule.views, rule.views);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Prueba rápida (en el SQL Editor corre como postgres, sin JWT, y da null):
--   select public.my_access();
-- Para probar de verdad, entra a la app con un usuario de cada rol.
-- ---------------------------------------------------------------------

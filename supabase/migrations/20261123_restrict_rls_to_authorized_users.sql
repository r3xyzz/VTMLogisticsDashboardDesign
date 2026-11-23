-- =====================================================================
-- Seguridad: limitar el acceso a la base SOLO a usuarios de authorized_users
-- =====================================================================
-- Problema: cualquier cuenta de Google puede iniciar sesión en Supabase y
-- obtener el rol "authenticated". Las políticas existentes eran
-- `to authenticated using (true)`, así que con el token (desde la consola
-- del navegador) se podía leer/escribir todo sin pasar por la app.
--
-- Solución (no destructiva):
--   1. Funciones public.is_authorized() / public.is_admin() que validan el
--      email del JWT contra authorized_users (is_active = true).
--   2. En cada tabla de public: RLS activado + política RESTRICTIVA que exige
--      is_authorized(). Las restrictivas se combinan con AND con cualquier
--      política existente, así que las viejas `using (true)` dejan de abrir
--      la puerta sin tener que borrarlas.
--   3. authorized_users / role_permissions: solo lectura de la propia fila;
--      escritura solo para admin.
--   4. Storage: los buckets de la app exigen is_authorized().
--   5. Vistas de public con security_invoker para que respeten RLS.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- IMPORTANTE: toda tabla nueva que se cree en public después de esto debe
-- volver a ejecutar el bloque 3 (o crear sus políticas igual).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Funciones de autorización
-- ---------------------------------------------------------------------
create or replace function public.is_authorized()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.authorized_users
    where lower(email) = lower(auth.jwt() ->> 'email')
      and is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.authorized_users
    where lower(email) = lower(auth.jwt() ->> 'email')
      and is_active
      and role = 'admin'
  );
$$;

revoke all on function public.is_authorized() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_authorized() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 2. authorized_users y role_permissions
-- ---------------------------------------------------------------------
alter table public.authorized_users enable row level security;
alter table public.role_permissions enable row level security;

-- authorized_users: cada uno lee su propia fila; admin lee y escribe todo.
drop policy if exists "authz: read own row or admin" on public.authorized_users;
create policy "authz: read own row or admin" on public.authorized_users
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_admin());

drop policy if exists "authz: admin manages" on public.authorized_users;
create policy "authz: admin manages" on public.authorized_users
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Restrictivas: anulan cualquier política vieja más permisiva.
drop policy if exists "authz: restrict select" on public.authorized_users;
create policy "authz: restrict select" on public.authorized_users
  as restrictive for select to public
  using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_admin());

drop policy if exists "authz: restrict insert" on public.authorized_users;
create policy "authz: restrict insert" on public.authorized_users
  as restrictive for insert to public
  with check (public.is_admin());

drop policy if exists "authz: restrict update" on public.authorized_users;
create policy "authz: restrict update" on public.authorized_users
  as restrictive for update to public
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authz: restrict delete" on public.authorized_users;
create policy "authz: restrict delete" on public.authorized_users
  as restrictive for delete to public
  using (public.is_admin());

-- role_permissions: lectura para autorizados; escritura solo admin.
drop policy if exists "authz: authorized read" on public.role_permissions;
create policy "authz: authorized read" on public.role_permissions
  for select to authenticated
  using (public.is_authorized());

drop policy if exists "authz: admin manages" on public.role_permissions;
create policy "authz: admin manages" on public.role_permissions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authz: restrict select" on public.role_permissions;
create policy "authz: restrict select" on public.role_permissions
  as restrictive for select to public
  using (public.is_authorized());

drop policy if exists "authz: restrict insert" on public.role_permissions;
create policy "authz: restrict insert" on public.role_permissions
  as restrictive for insert to public
  with check (public.is_admin());

drop policy if exists "authz: restrict update" on public.role_permissions;
create policy "authz: restrict update" on public.role_permissions
  as restrictive for update to public
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authz: restrict delete" on public.role_permissions;
create policy "authz: restrict delete" on public.role_permissions
  as restrictive for delete to public
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Resto de tablas de public
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('authorized_users', 'role_permissions')
  loop
    execute format('alter table public.%I enable row level security', t);

    -- Permisiva: garantiza que los autorizados sigan pudiendo operar aunque
    -- la tabla no tuviera políticas (p. ej. tablas con RLS antes apagado).
    execute format('drop policy if exists "authz: authorized manage" on public.%I', t);
    execute format(
      'create policy "authz: authorized manage" on public.%I
         for all to authenticated
         using (public.is_authorized()) with check (public.is_authorized())', t);

    -- Restrictiva: bloquea a anon y a cualquier Google no autorizado, aunque
    -- existan políticas viejas con using (true).
    execute format('drop policy if exists "authz: require authorized user" on public.%I', t);
    execute format(
      'create policy "authz: require authorized user" on public.%I
         as restrictive for all to public
         using (public.is_authorized()) with check (public.is_authorized())', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 4. Storage (buckets usados por la app)
-- ---------------------------------------------------------------------
drop policy if exists "authz: app buckets require authorized user" on storage.objects;
create policy "authz: app buckets require authorized user" on storage.objects
  as restrictive for all to public
  using (
    bucket_id not in ('documents', 'pod-documents', 'patio-files')
    or public.is_authorized()
  )
  with check (
    bucket_id not in ('documents', 'pod-documents', 'patio-files')
    or public.is_authorized()
  );

drop policy if exists "authz: app buckets authorized manage" on storage.objects;
create policy "authz: app buckets authorized manage" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('documents', 'pod-documents', 'patio-files')
    and public.is_authorized()
  )
  with check (
    bucket_id in ('documents', 'pod-documents', 'patio-files')
    and public.is_authorized()
  );

-- ---------------------------------------------------------------------
-- 5. Vistas: que respeten el RLS de quien consulta (Postgres 15+)
-- ---------------------------------------------------------------------
do $$
declare
  v text;
begin
  for v in
    select viewname from pg_views where schemaname = 'public'
  loop
    execute format('alter view public.%I set (security_invoker = true)', v);
  end loop;
end
$$;

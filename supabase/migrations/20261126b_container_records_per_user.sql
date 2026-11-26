-- =====================================================================
-- Import / Export: cada usuario ve SOLO sus propias operaciones (las de su buzón).
-- Antes: una sola fila por conversación y todos los usuarios leían todas las filas.
-- Ahora: una fila por (usuario, conversación) y una regla RLS que solo deja leer/escribir las propias.
-- El usuario es el email de la sesión de la app (login con Google), no el de Outlook.
-- Idempotente: se puede correr más de una vez.
-- =====================================================================

-- 1. Dueño de la fila: se llena solo con el email de quien inició sesión
alter table public.container_records add column if not exists owner_email text;
alter table public.container_records alter column owner_email set default lower(auth.jwt() ->> 'email');

-- Filas antiguas: se asignan a quien las guardó o respaldó (email de Outlook).
-- Si ese email no es el mismo con que esa persona entra a la app, no las verá: ver consulta al final.
update public.container_records
set owner_email = lower(coalesce(updated_by, source_mailbox))
where owner_email is null and coalesce(updated_by, source_mailbox) is not null;

-- 2. La misma conversación puede estar en dos buzones: la clave pasa a ser (usuario, conversación)
-- Orden importante: la tabla está en el realtime y sin clave primaria Postgres no deja hacer UPDATE
-- ("does not have a replica identity"); por eso se crea el id y se usa replica identity full mientras se cambia la clave.
alter table public.container_records add column if not exists id uuid default gen_random_uuid();
alter table public.container_records replica identity full;
update public.container_records set id = gen_random_uuid() where id is null;
alter table public.container_records alter column id set not null;
alter table public.container_records drop constraint if exists container_records_pkey;
alter table public.container_records add constraint container_records_pkey primary key (id);
alter table public.container_records replica identity default;
create unique index if not exists container_records_owner_operation_key on public.container_records(owner_email, operation_id);

-- 3. RLS: cada usuario solo lee y escribe sus filas
alter table public.container_records enable row level security;
drop policy if exists "Auth users can manage container_records" on public.container_records;
drop policy if exists "Users manage own container_records" on public.container_records;
create policy "Users manage own container_records" on public.container_records
  for all to authenticated
  using (owner_email = lower(auth.jwt() ->> 'email'))
  with check (owner_email = lower(auth.jwt() ->> 'email'));

notify pgrst, 'reload schema';

-- Para revisar filas antiguas que quedaron sin dueño o con un email distinto al de la app:
-- select owner_email, count(*) from public.container_records group by owner_email;
-- update public.container_records set owner_email = 'correo-de-la-app@dominio.cl' where owner_email = 'correo-outlook@vtmlogistics.com';

-- 20261124_cubicaje_pod_review_notifications.sql
-- Requerimientos de marcha blanca (cotizaciones, POD, fotos, correos de estado y coordinación).
-- Idempotente: se puede correr más de una vez.

-- ─── 1. Cotizaciones / OT: cubicaje y tipo de solicitud ──────────────────────
alter table public.orders add column if not exists request_kind  text;          -- tarifado (OT directa) | cotizacion (fuera de tarifado)
alter table public.orders add column if not exists declared_cbm  numeric;       -- cubicaje total informado (BL / cliente)
alter table public.orders add column if not exists measured_cbm  numeric;       -- suma de las medidas por bulto
alter table public.orders add column if not exists cargo_pieces  jsonb default '[]'::jsonb; -- [{qty,l,a,h}] en cm
alter table public.orders add column if not exists client_status text;          -- estado visible para el cliente

do $$ begin
  alter table public.orders add constraint orders_request_kind_chk check (request_kind is null or request_kind in ('tarifado', 'cotizacion'));
exception when duplicate_object then null; end $$;

-- ─── 2. POD: revisión interna de fotos y PDF final ───────────────────────────
-- review = {"pod_empty": true, "load_evidence": false, ...} (true = aprobada por coordinación)
alter table public.documents add column if not exists review        jsonb default '{}'::jsonb;
alter table public.documents add column if not exists reviewed_by   text;
alter table public.documents add column if not exists final_pdf_url text;
alter table public.documents add column if not exists final_sent_at timestamptz;

-- ─── 3. Coordinación: zona/comuna y datos para el chofer ─────────────────────
alter table public.coordination_services add column if not exists zone      text;    -- comuna o zona (Recoleta, Peñalolén, centro sur...)
alter table public.coordination_services add column if not exists weight_kg numeric;
alter table public.coordination_services add column if not exists volume_cbm numeric;
alter table public.coordination_services add column if not exists pallets   text;

-- ─── 4. Correos automáticos de estado al cliente (sin fotos) ─────────────────
create table if not exists public.client_notifications (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  kind       text not null,                 -- carga_saliendo | carga_entregada
  to_email   text,                          -- null = el cliente no tiene correo registrado
  subject    text not null,
  body       text not null,
  status     text not null default 'pending', -- pending | sent | error | manual
  error      text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  unique (order_id, kind)
);

alter table public.client_notifications enable row level security;
drop policy if exists "authz: authorized manage" on public.client_notifications;
create policy "authz: authorized manage" on public.client_notifications
  for all to authenticated using (public.is_authorized()) with check (public.is_authorized());
drop policy if exists "authz: require authorized user" on public.client_notifications;
create policy "authz: require authorized user" on public.client_notifications
  as restrictive for all to public using (public.is_authorized()) with check (public.is_authorized());

-- Cuando el chofer sube las fotos 1+2 (POD vacío + evidencia de carga) se encola el correo 1;
-- con las fotos 3+4 (POD firmado + evidencia de descarga) se encola el correo 2.
-- unique(order_id, kind) evita enviar dos veces el mismo aviso si se reemplaza una foto.
create or replace function public.queue_client_status_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_origin text;
  v_destination text;
  v_client text;
  v_emails text;
  v_to text;
begin
  select o.order_number, o.origin, o.destination, c.name, c.contact_email
    into v_number, v_origin, v_destination, v_client, v_emails
  from public.orders o
  left join public.clients c on c.id = o.client_id
  where o.id = new.order_id;
  if not found then
    return new;
  end if;

  select e into v_to
  from unnest(regexp_split_to_array(coalesce(v_emails, ''), '[,;[:space:]]+')) as e
  where e like '%@%'
  limit 1;

  if new.pod_empty_url is not null and new.load_evidence_url is not null then
    insert into public.client_notifications (order_id, kind, to_email, subject, body)
    values (
      new.order_id, 'carga_saliendo', v_to,
      format('VTM Logistics · %s · Su carga está saliendo', v_number),
      format(E'Estimado/a %s:\n\nLe informamos que su carga de la orden %s (%s → %s) ya fue retirada y se encuentra saliendo de bodega de despacho.\n\nEstado actual: Carga saliendo de bodega de despacho.\n\nLe avisaremos cuando la carga llegue a destino.\n\nSaludos,\nCoordinación VTM Logistics',
             coalesce(v_client, 'cliente'), v_number, coalesce(v_origin, '—'), coalesce(v_destination, '—'))
    )
    on conflict (order_id, kind) do nothing;

    update public.orders
       set client_status = 'Carga saliendo de bodega de despacho'
     where id = new.order_id
       and (client_status is null or client_status = 'Carga en bodega de despacho');
  end if;

  if new.pod_final_url is not null and new.delivery_evidence_url is not null then
    insert into public.client_notifications (order_id, kind, to_email, subject, body)
    values (
      new.order_id, 'carga_entregada', v_to,
      format('VTM Logistics · %s · Su carga fue entregada', v_number),
      format(E'Estimado/a %s:\n\nLe informamos que su carga de la orden %s (%s → %s) llegó a destino y fue entregada.\n\nEstado actual: Carga entregada.\n\nEn breve le enviaremos el comprobante (POD) con las evidencias revisadas.\n\nSaludos,\nCoordinación VTM Logistics',
             coalesce(v_client, 'cliente'), v_number, coalesce(v_origin, '—'), coalesce(v_destination, '—'))
    )
    on conflict (order_id, kind) do nothing;

    update public.orders set client_status = 'Carga entregada' where id = new.order_id;
  end if;

  return new;
end;
$$;

drop trigger if exists documents_queue_client_notifications on public.documents;
create trigger documents_queue_client_notifications
  after insert or update of pod_empty_url, load_evidence_url, pod_final_url, delivery_evidence_url
  on public.documents
  for each row execute function public.queue_client_status_notifications();

-- Tiempo real para que POD vea la cola de avisos sin recargar
do $$ begin
  alter publication supabase_realtime add table public.client_notifications;
exception when duplicate_object or undefined_object then null; end $$;

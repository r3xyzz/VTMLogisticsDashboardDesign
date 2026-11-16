-- =====================================================================
-- Módulo Jefatura de Patio (src/components/Patio.tsx)
-- Campos nuevos en fleet/drivers + tablas de patio + bucket de archivos.
-- Idempotente: se puede correr más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FLEET: ficha del vehículo
--    Ya existen: plate, brand, model, year, vehicle_type, capacity_kg, capacity_cbm,
--    status, current_location, technical_review (= vencimiento revisión técnica),
--    permit_circulation (= N° permiso), cargo_insurance (= póliza de carga),
--    vehicle_insurance (= N° seguro/SOAP), has_gps, gps_device_id,
--    last_maintenance, next_maintenance
-- ---------------------------------------------------------------------
alter table public.fleet add column if not exists internal_code            text;    -- "Camión 1", "Rampla 1"
alter table public.fleet add column if not exists engine_number            text;    -- N° motor (se registra una vez)
alter table public.fleet add column if not exists chassis_number           text;    -- N° chasis (se registra una vez)
alter table public.fleet add column if not exists photo_path               text;    -- ruta en bucket patio-files
alter table public.fleet add column if not exists current_km               integer; -- kilometraje actual
alter table public.fleet add column if not exists technical_review_done    date;    -- fecha en que se hizo la revisión
alter table public.fleet add column if not exists permit_expiry            date;    -- vencimiento permiso de circulación
alter table public.fleet add column if not exists gases_expiry             date;    -- vencimiento revisión de gases
alter table public.fleet add column if not exists vehicle_insurance_expiry date;    -- vencimiento seguro/SOAP
alter table public.fleet add column if not exists extinguisher_expiry      date;    -- vencimiento extintor

-- ---------------------------------------------------------------------
-- 2. DRIVERS: ficha del conductor
--    Ya existen: rut, full_name, phone, email, address, license_number,
--    license_type, license_expiry, hire_date, current_fleet_id, is_active,
--    background_check (antecedentes) y cv (hoja de vida) -> guardarán la ruta del archivo
-- ---------------------------------------------------------------------
alter table public.drivers add column if not exists emergency_contact_name  text;
alter table public.drivers add column if not exists emergency_contact_phone text;

-- Horas recorridas por día (una fila por conductor y día)
create table if not exists public.driver_daily_hours (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references public.drivers(id) on delete cascade,
  work_date  date not null default current_date,
  hours      numeric(4,1) not null check (hours >= 0 and hours <= 24),
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (driver_id, work_date)
);

-- ---------------------------------------------------------------------
-- 3. MANTENCIONES (historial con km). fleet.last/next_maintenance se mantienen como resumen.
-- ---------------------------------------------------------------------
create table if not exists public.fleet_maintenance (
  id           uuid primary key default gen_random_uuid(),
  fleet_id     uuid not null references public.fleet(id) on delete cascade,
  performed_at date not null default current_date,
  detail       text not null,
  current_km   integer,
  next_km      integer,             -- km objetivo de la próxima mantención
  cost         numeric,
  created_at   timestamptz default now()
);
create index if not exists fleet_maintenance_fleet_idx on public.fleet_maintenance(fleet_id, performed_at desc);

-- ---------------------------------------------------------------------
-- 4. PANAS / REPARACIONES y SINIESTROS: se reutiliza la tabla incidents (hoy vacía)
--    incident_type = 'repair' (pana/reparación) | 'claim' (siniestro)
--    description = detalle, resolution_notes = resultado, reported_at = fecha
-- ---------------------------------------------------------------------
alter table public.incidents add column if not exists fleet_id     uuid references public.fleet(id) on delete set null;
alter table public.incidents add column if not exists claim_number text;   -- N° siniestro (SIN-2026-018)
create index if not exists incidents_fleet_idx on public.incidents(fleet_id);

-- ---------------------------------------------------------------------
-- 5. MOVIMIENTOS DE PATIO (Ingreso rápido + Trazabilidad de traspasos)
--    Se guarda el chofer de llegada/salida al momento del movimiento,
--    porque la asignación vehículo-conductor cambia con el tiempo.
-- ---------------------------------------------------------------------
create table if not exists public.yard_movements (
  id                  uuid primary key default gen_random_uuid(),
  moved_at            timestamptz not null default now(),
  reference           text not null,                 -- COORD-10550
  order_id            uuid references public.orders(id) on delete set null,
  cargo               text,                          -- 18 pallets · Cliente
  service_type        text not null default 'Consolidado' check (service_type in ('Consolidado', 'Exclusivo')),
  arrival_fleet_id    uuid references public.fleet(id) on delete set null,
  arrival_driver_id   uuid references public.drivers(id) on delete set null,
  departure_fleet_id  uuid references public.fleet(id) on delete set null,
  departure_driver_id uuid references public.drivers(id) on delete set null,
  guide_photo_path    text,                          -- ruta en bucket patio-files
  physical_file       text,                          -- Archivador / folio
  status              text not null default 'Planificado' check (status in ('Planificado', 'En ejecución', 'Cerrado')),
  created_by          text,                          -- email de quien registra
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists yard_movements_moved_idx on public.yard_movements(moved_at desc);

-- ---------------------------------------------------------------------
-- 6. PIONETAS
-- ---------------------------------------------------------------------
create table if not exists public.yard_helpers (
  id            uuid primary key default gen_random_uuid(),
  work_date     date not null default current_date,
  worker_name   text not null,
  driver_id     uuid references public.drivers(id) on delete set null, -- si el pioneta es un conductor registrado
  category      text not null default 'Patio' check (category in ('Patio', 'Servicio / Depósito')),
  reason        text not null,
  reference     text,
  order_id      uuid references public.orders(id) on delete set null,
  payer         text not null default 'Empresa' check (payer in ('Cliente', 'Empresa')),
  amount        numeric,                                               -- monto para liquidación
  authorized_by text,
  created_by    text,
  created_at    timestamptz default now()
);
create index if not exists yard_helpers_date_idx on public.yard_helpers(work_date desc);

-- ---------------------------------------------------------------------
-- 7. GRÚA EXTERNA
-- ---------------------------------------------------------------------
create table if not exists public.crane_requests (
  id            uuid primary key default gen_random_uuid(),
  requested_for timestamptz,
  reference     text,
  reason        text not null,
  location      text,
  provider_id   uuid references public.providers(id) on delete set null, -- empresa de grúa
  cost          numeric,
  status        text not null default 'Solicitada' check (status in ('Solicitada', 'Confirmada', 'Completada')),
  created_by    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 8. PERMISO PROPIO PARA PATIO (para dar acceso a jefes de patio sin abrir Flota)
--    Se inicializa igual que can_view_fleet.
-- ---------------------------------------------------------------------
alter table public.role_permissions add column if not exists can_view_patio boolean default false;
update public.role_permissions set can_view_patio = coalesce(can_view_fleet, false) where can_view_patio is distinct from true;

-- ---------------------------------------------------------------------
-- 9. RLS: solo usuarios autenticados (mismo criterio que invoices/shipments)
-- ---------------------------------------------------------------------
alter table public.driver_daily_hours enable row level security;
alter table public.fleet_maintenance  enable row level security;
alter table public.yard_movements     enable row level security;
alter table public.yard_helpers       enable row level security;
alter table public.crane_requests     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['driver_daily_hours', 'fleet_maintenance', 'yard_movements', 'yard_helpers', 'crane_requests'] loop
    begin
      execute format('create policy "Auth users can manage %1$s" on public.%1$I for all to authenticated using (true) with check (true)', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 10. REALTIME: drivers (estaba desactivado) + tablas nuevas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['drivers', 'incidents', 'driver_daily_hours', 'fleet_maintenance', 'yard_movements', 'yard_helpers', 'crane_requests'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 11. ARCHIVOS: bucket PRIVADO (contiene antecedentes de conductores)
--     Carpetas: fleet/<id>/foto, drivers/<id>/antecedentes|cv, movements/<id>/guia
--     Se leen con URLs firmadas (createSignedUrl), no públicas.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('patio-files', 'patio-files', false)
on conflict (id) do nothing;

do $$
begin
  create policy "patio-files read"   on storage.objects for select to authenticated using (bucket_id = 'patio-files');
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy "patio-files insert" on storage.objects for insert to authenticated with check (bucket_id = 'patio-files');
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy "patio-files update" on storage.objects for update to authenticated using (bucket_id = 'patio-files');
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy "patio-files delete" on storage.objects for delete to authenticated using (bucket_id = 'patio-files');
exception when duplicate_object then null;
end $$;

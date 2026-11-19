-- =====================================================================
-- Coordinación: FCL (contenedores, Cristóbal) y LCL (carga suelta, César)
--   * coordination_services: tipo de carga, fecha real, campos operativos y "finalizado"
--   * coordination_boards: pizarras libres guardadas (FCL: varias por fecha; LCL: una sola)
-- Idempotente: se puede correr más de una vez.
-- =====================================================================

-- 1. Servicios ---------------------------------------------------------
alter table public.coordination_services add column if not exists cargo_mode           text default 'fcl';
alter table public.coordination_services add column if not exists service_date         date;    -- día programado (calendario FCL / historial)
alter table public.coordination_services add column if not exists shipping_line        text;    -- naviera (Maersk, MSC...)
alter table public.coordination_services add column if not exists container_number     text;
alter table public.coordination_services add column if not exists container_size       text;    -- 20, 40, 40HC
alter table public.coordination_services add column if not exists packages             text;    -- cantidad de bultos
alter table public.coordination_services add column if not exists delivery_date        date;
alter table public.coordination_services add column if not exists special_instructions text;    -- ej. encarpar
alter table public.coordination_services add column if not exists trailer_plate        text;    -- rampla
alter table public.coordination_services add column if not exists done                 boolean default false;
alter table public.coordination_services add column if not exists updated_at           timestamptz default now();

-- Servicios existentes: quedan como FCL
update public.coordination_services set cargo_mode = 'fcl' where cargo_mode is null;
update public.coordination_services set done = false where done is null;

do $$
begin
  alter table public.coordination_services
    add constraint coordination_services_cargo_mode_chk check (cargo_mode in ('fcl', 'lcl'));
exception when duplicate_object then null;
end $$;

create index if not exists coordination_services_mode_date_idx on public.coordination_services(cargo_mode, service_date);

-- 2. Pizarras guardadas -----------------------------------------------
create table if not exists public.coordination_boards (
  id          uuid primary key default gen_random_uuid(),
  cargo_mode  text not null check (cargo_mode in ('fcl', 'lcl')),
  board_date  date,                                -- FCL: día de la pizarra; LCL: null (pizarra única)
  name        text not null,
  data        jsonb not null default '{}'::jsonb,  -- trazos, notas y posición de las tarjetas
  updated_by  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists coordination_boards_mode_date_idx on public.coordination_boards(cargo_mode, board_date);

alter table public.coordination_boards enable row level security;
do $$
begin
  create policy "Auth users can manage coordination_boards" on public.coordination_boards
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- 3. Realtime: lo que edita uno lo ve el otro al instante ---------------
do $$
declare t text;
begin
  foreach t in array array['coordination_services', 'coordination_boards'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

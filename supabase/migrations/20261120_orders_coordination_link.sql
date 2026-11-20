-- =====================================================================
-- Nueva OT -> Coordinación
-- Una OT confirmada crea su servicio en Coordinación (FCL o LCL) enlazado por order_id.
-- Coordinación muestra el estado del viaje del camionero y lo da por finalizado al completarse.
-- Idempotente: se puede correr más de una vez.
-- =====================================================================

alter table public.orders add column if not exists cargo_mode     text;  -- fcl (contenedor) | lcl (carga suelta)
alter table public.orders add column if not exists operation_type text;  -- impo | expo

do $$
begin
  alter table public.orders add constraint orders_cargo_mode_chk check (cargo_mode is null or cargo_mode in ('fcl', 'lcl'));
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.orders add constraint orders_operation_type_chk check (operation_type is null or operation_type in ('impo', 'expo'));
exception when duplicate_object then null;
end $$;

alter table public.coordination_services add column if not exists order_id uuid references public.orders(id) on delete set null;
-- Una OT = un servicio en Coordinación
create unique index if not exists coordination_services_order_id_key on public.coordination_services(order_id) where order_id is not null;

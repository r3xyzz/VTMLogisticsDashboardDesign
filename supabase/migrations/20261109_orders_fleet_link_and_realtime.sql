-- Vincula cada OT con el vehículo real de la flota y activa Realtime
-- para que Camioneros y Documentos se actualicen sin recargar.

-- 1. Vehículo asignado a la OT
alter table public.orders
    add column if not exists fleet_id uuid references public.fleet(id) on delete set null;

create index if not exists orders_fleet_id_idx on public.orders (fleet_id);
create index if not exists orders_driver_id_idx on public.orders (driver_id);

-- 2. Realtime (ignora las tablas que ya estén en la publicación)
do $$
declare
    t text;
begin
    foreach t in array array['orders', 'documents', 'fleet'] loop
        begin
            execute format('alter publication supabase_realtime add table public.%I', t);
        exception when duplicate_object then
            null;
        end;
    end loop;
end $$;

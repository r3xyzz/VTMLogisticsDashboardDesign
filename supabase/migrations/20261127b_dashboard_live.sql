-- =====================================================================
-- Dashboard conectado: fecha real de entrega y tiempo real
-- =====================================================================
-- 1. orders.delivered_at: momento en que la OT pasa a "completed" (lo marca
--    Camioneros). El Dashboard lo usa para calcular Entregas a Tiempo (OTD)
--    contra el plazo de Coordinación (delivery_date + delivery_time) o, si no
--    hay plazo, contra el fin del día de servicio.
-- 2. Las OT ya completadas se rellenan con la última actualización de sus
--    documentos (o de la OT): es la mejor aproximación disponible.
-- 3. invoices entra a Supabase Realtime para que el Dashboard se actualice
--    apenas Facturación sincroniza o edita una factura.
-- Idempotente: se puede ejecutar más de una vez.
-- =====================================================================

alter table public.orders add column if not exists delivered_at timestamptz;

create or replace function public.orders_set_delivered_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' then
    if new.delivered_at is null then
      new.delivered_at := now();
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'completed' then
    new.delivered_at := null; -- se reabrió la OT
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_delivered_at on public.orders;
create trigger orders_set_delivered_at
  before insert or update of status on public.orders
  for each row execute function public.orders_set_delivered_at();

-- OT completadas antes de este cambio
update public.orders o
set delivered_at = coalesce(
  (select max(d.updated_at) from public.documents d where d.order_id = o.id),
  o.updated_at
)
where o.status = 'completed'
  and o.delivered_at is null;

-- Tiempo real para las tablas que muestra el Dashboard
do $$
declare
  t text;
begin
  foreach t in array array['invoices', 'orders', 'documents', 'coordination_services', 'fleet', 'drivers', 'incidents', 'crane_requests', 'client_notifications'] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object or undefined_object then null;
    end;
  end loop;
end
$$;

-- Que la API reconozca la columna nueva sin esperar
notify pgrst, 'reload schema';

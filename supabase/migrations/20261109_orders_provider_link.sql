-- Vincula cada OT subcontratada con su proveedor (transportista tercero).

-- 1. El formulario de Proveedores guarda "notes"; se agrega por si la columna no existe.
alter table public.providers
    add column if not exists notes text;

-- 2. Proveedor asignado a la OT (solo en modo subcontrato)
alter table public.orders
    add column if not exists provider_id uuid references public.providers(id) on delete set null;

create index if not exists orders_provider_id_idx on public.orders (provider_id);

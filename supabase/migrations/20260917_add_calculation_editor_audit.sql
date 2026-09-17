alter table public.calculations
    add column if not exists updated_by uuid references auth.users(id),
    add column if not exists updated_by_email text;
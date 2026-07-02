create table if not exists public.user_delivery_addresses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  address text not null,
  pincode text not null,
  city text not null,
  state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_delivery_addresses enable row level security;

drop policy if exists "Users can view own delivery address"
on public.user_delivery_addresses;

create policy "Users can view own delivery address"
on public.user_delivery_addresses
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own delivery address"
on public.user_delivery_addresses;

create policy "Users can insert own delivery address"
on public.user_delivery_addresses
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own delivery address"
on public.user_delivery_addresses;

create policy "Users can update own delivery address"
on public.user_delivery_addresses
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own delivery address"
on public.user_delivery_addresses;

create policy "Users can delete own delivery address"
on public.user_delivery_addresses
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_delivery_addresses_updated_at
on public.user_delivery_addresses;

create trigger set_user_delivery_addresses_updated_at
before update on public.user_delivery_addresses
for each row
execute function public.set_updated_at();

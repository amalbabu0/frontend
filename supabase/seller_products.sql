create table if not exists public.seller_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  price_paise integer not null check (price_paise >= 100),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seller_products_user_id
on public.seller_products(user_id);

create index if not exists idx_seller_products_seller_id
on public.seller_products(seller_id);

create index if not exists idx_seller_products_status
on public.seller_products(status);

alter table public.seller_products enable row level security;

drop policy if exists "Users can view own seller products"
on public.seller_products;

create policy "Users can view own seller products"
on public.seller_products
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own seller products"
on public.seller_products;

create policy "Users can insert own seller products"
on public.seller_products
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.sellers
    where sellers.id = seller_id
      and sellers.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own seller products"
on public.seller_products;

create policy "Users can update own seller products"
on public.seller_products
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.sellers
    where sellers.id = seller_id
      and sellers.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.sellers
    where sellers.id = seller_id
      and sellers.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own seller products"
on public.seller_products;

create policy "Users can delete own seller products"
on public.seller_products
for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.sellers
    where sellers.id = seller_id
      and sellers.user_id = auth.uid()
  )
);

drop policy if exists "Public can view live seller products"
on public.seller_products;

create policy "Public can view live seller products"
on public.seller_products
for select
using (status = 'active');

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

drop trigger if exists set_seller_products_updated_at
on public.seller_products;

create trigger set_seller_products_updated_at
before update on public.seller_products
for each row
execute function public.set_updated_at();

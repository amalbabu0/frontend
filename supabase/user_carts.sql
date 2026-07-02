create table if not exists public.user_carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_carts_items_is_array check (jsonb_typeof(items) = 'array')
);

alter table public.user_carts enable row level security;

drop policy if exists "Users can view own cart"
on public.user_carts;

create policy "Users can view own cart"
on public.user_carts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own cart"
on public.user_carts;

create policy "Users can insert own cart"
on public.user_carts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own cart"
on public.user_carts;

create policy "Users can update own cart"
on public.user_carts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own cart"
on public.user_carts;

create policy "Users can delete own cart"
on public.user_carts
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

drop trigger if exists set_user_carts_updated_at
on public.user_carts;

create trigger set_user_carts_updated_at
before update on public.user_carts
for each row
execute function public.set_updated_at();

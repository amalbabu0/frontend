create table if not exists public.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text not null,
  browser_name text not null default 'Browser',
  os_name text not null default 'Unknown OS',
  device_type text not null default 'Device',
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  signed_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id),
  constraint user_devices_device_id_not_empty check (length(trim(device_id)) > 0)
);

alter table public.user_devices enable row level security;

drop policy if exists "Users can view own devices"
on public.user_devices;

create policy "Users can view own devices"
on public.user_devices
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own devices"
on public.user_devices;

create policy "Users can insert own devices"
on public.user_devices
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own devices"
on public.user_devices;

create policy "Users can update own devices"
on public.user_devices
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own devices"
on public.user_devices;

create policy "Users can delete own devices"
on public.user_devices
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

drop trigger if exists set_user_devices_updated_at
on public.user_devices;

create trigger set_user_devices_updated_at
before update on public.user_devices
for each row
execute function public.set_updated_at();

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Wędrowiec' check (char_length(display_name) between 2 and 18),
  created_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 18),
  vocation text not null check (vocation in ('warden', 'ranger', 'arcanist', 'druid')),
  level integer not null default 1 check (level between 1 and 999),
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.world_status (
  id text primary key,
  online_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.world_status enable row level security;

create policy "profiles readable by owner"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles insertable by owner"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles editable by owner"
  on public.profiles for update using (auth.uid() = id);

create policy "characters readable by owner"
  on public.characters for select using (auth.uid() = user_id);
create policy "characters insertable by owner"
  on public.characters for insert with check (auth.uid() = user_id);
create policy "characters editable by owner"
  on public.characters for update using (auth.uid() = user_id);

create policy "world status is public"
  on public.world_status for select using (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Wędrowiec'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

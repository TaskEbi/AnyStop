-- Curio Cabinet: initial schema.
-- Every row belongs to one auth user (owner_id) and row-level security only lets
-- that user see or change it. Rows are soft-deleted (deleted_at) so deletions
-- sync to other devices; ids are generated on the client so saving works offline.

-- ─── helpers ────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── rooms ──────────────────────────────────────────────────────────────────

create table public.rooms (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  color       text not null default 'mustard'
              check (color in ('mustard', 'sage', 'blue', 'rose', 'lavender', 'apricot')),
  description text,
  sort_order  double precision not null default 0,
  is_example  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index rooms_owner_updated_idx on public.rooms (owner_id, updated_at);

-- ─── items ──────────────────────────────────────────────────────────────────

create table public.items (
  id             uuid primary key,
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind           text not null
                 check (kind in ('link', 'video', 'article', 'paper', 'photo', 'music', 'quote', 'note')),
  title          text not null default '',
  url            text,
  creator        text,
  body           text,
  note           text,
  room_id        uuid references public.rooms (id) on delete set null,
  tags           text[] not null default '{}',
  status         text not null default 'none'
                 check (status in ('none', 'up_next', 'in_progress', 'done')),
  favourite      boolean not null default false,
  image_path     text,
  preview        jsonb,
  accession_no   integer,
  collage_pos    jsonb,
  is_example     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_opened_at timestamptz,
  deleted_at     timestamptz,
  unique (owner_id, accession_no)
);

create index items_owner_updated_idx on public.items (owner_id, updated_at);
create index items_room_idx on public.items (room_id);
create index items_tags_idx on public.items using gin (tags);

-- Accession numbers (No. 0001, No. 0002…) are handed out by the database, so two
-- devices that saved while offline can never pick the same number.
create table public.accession_counters (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  last_no  integer not null default 0
);

create or replace function public.assign_accession_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_no integer;
begin
  -- An upsert of an existing row also fires BEFORE INSERT; don't burn a number on it.
  if exists (select 1 from public.items where id = new.id) then
    return new;
  end if;

  insert into public.accession_counters as c (owner_id, last_no)
  values (new.owner_id, 1)
  on conflict (owner_id) do update set last_no = c.last_no + 1
  returning last_no into next_no;

  new.accession_no := next_no;
  return new;
end;
$$;

revoke execute on function public.assign_accession_no() from public, anon, authenticated;

create trigger items_assign_accession_no
  before insert on public.items
  for each row execute function public.assign_accession_no();

-- ─── connections ("strings") ────────────────────────────────────────────────

create table public.connections (
  id         uuid primary key,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_a     uuid not null references public.items (id) on delete cascade,
  item_b     uuid not null references public.items (id) on delete cascade,
  label      text,
  is_example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- each pair is stored once, smaller id first
  check (item_a < item_b),
  unique (item_a, item_b)
);

create index connections_owner_updated_idx on public.connections (owner_id, updated_at);
create index connections_item_b_idx on public.connections (item_b);

-- ─── settings ───────────────────────────────────────────────────────────────

create table public.settings (
  owner_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  museum_name     text not null default 'Curio Cabinet',
  default_view    text not null default 'shelves' check (default_view in ('shelves', 'collage', 'map')),
  theme           text not null default 'system' check (theme in ('system', 'light', 'dark')),
  examples_seeded boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- ─── updated_at triggers ────────────────────────────────────────────────────

create trigger rooms_touch before insert or update on public.rooms
  for each row execute function public.touch_updated_at();
create trigger items_touch before insert or update on public.items
  for each row execute function public.touch_updated_at();
create trigger connections_touch before insert or update on public.connections
  for each row execute function public.touch_updated_at();
create trigger settings_touch before insert or update on public.settings
  for each row execute function public.touch_updated_at();

-- ─── row-level security: only the owner, only when signed in ────────────────

alter table public.rooms              enable row level security;
alter table public.items              enable row level security;
alter table public.connections        enable row level security;
alter table public.settings           enable row level security;
alter table public.accession_counters enable row level security; -- no policies: trigger-only

revoke all on public.accession_counters from anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'items', 'connections', 'settings'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy "owner can read" on public.%I for select to authenticated
         using (owner_id = (select auth.uid()))', t);
    execute format(
      'create policy "owner can insert" on public.%I for insert to authenticated
         with check (owner_id = (select auth.uid()))', t);
    execute format(
      'create policy "owner can update" on public.%I for update to authenticated
         using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format(
      'create policy "owner can delete" on public.%I for delete to authenticated
         using (owner_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- An item may only point at the owner's own room, and a string may only join the
-- owner's own items (stops guessing other people's ids into a foreign key).
create or replace function public.check_item_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.room_id is not null and not exists (
    select 1 from public.rooms r where r.id = new.room_id and r.owner_id = new.owner_id
  ) then
    raise exception 'room % not found', new.room_id;
  end if;
  return new;
end;
$$;

create trigger items_check_refs before insert or update of room_id on public.items
  for each row execute function public.check_item_refs();

create or replace function public.check_connection_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.items i
      where i.id in (new.item_a, new.item_b) and i.owner_id = new.owner_id) <> 2 then
    raise exception 'connection items not found';
  end if;
  return new;
end;
$$;

create trigger connections_check_refs before insert or update of item_a, item_b on public.connections
  for each row execute function public.check_connection_refs();

-- ─── realtime: push changes to the owner's other devices ────────────────────

alter publication supabase_realtime add table public.rooms, public.items, public.connections, public.settings;

-- ─── storage: private "photos" bucket, files under <user id>/… ──────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do nothing;

create policy "owner can read photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner can upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner can update photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner can delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

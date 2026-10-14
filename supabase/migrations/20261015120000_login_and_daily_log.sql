-- Sign-in comes back (username + password) and the Daily Log arrives.
--
-- Access: the cabinet stays one shared collection (owner_id = the shared owner), but only
-- signed-in members may reach it. "members" is an allowlist that holds exactly one row,
-- created by the setup-login Edge Function on first launch. Any other auth user (a stray
-- sign-up, an account from the old email login) gets nothing. The anon key alone can
-- no longer read or change anything except ask whether setup is still needed.

-- ─── members ────────────────────────────────────────────────────────────────

create table public.members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  created_at timestamptz not null default now()
);

-- One member only: a second row would collide on this constant.
create unique index members_only_one on public.members ((true));

alter table public.members enable row level security; -- no policies: Edge Function (service role) only
revoke all on public.members from anon, authenticated;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- The login screen asks this to decide between "sign in" and "choose a username and password".
create or replace function public.login_setup_needed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.members);
$$;

revoke execute on function public.login_setup_needed() from public;
grant execute on function public.login_setup_needed() to anon, authenticated;

-- ─── settings: the Daily Log's time zone ────────────────────────────────────

alter table public.settings
  add column if not exists log_timezone text not null default 'Asia/Singapore'
    check (char_length(log_timezone) between 1 and 64);

-- ─── Daily Log tables ───────────────────────────────────────────────────────
-- No foreign keys between them: entries are written offline and may reach the server
-- before (or without) their topic, and the client never drops a log over a reference.
-- The client validates topic/subcategory pairs; the shapes are checked here.

create table public.log_topics (
  id          uuid primary key,
  owner_id    uuid not null default '00000000-0000-0000-0000-000000000000',
  parent_id   uuid check (parent_id is distinct from id),
  name        text not null check (char_length(name) between 1 and 60),
  color       text not null default 'blue'
              check (color in (
                'mustard', 'sage', 'blue', 'rose', 'lavender', 'apricot',
                'teal', 'forest', 'olive', 'lemon', 'coral', 'cherry', 'magenta', 'plum', 'sky', 'navy', 'slate', 'charcoal'
              )),
  sort_order  double precision not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.log_entries (
  id             uuid primary key,
  owner_id       uuid not null default '00000000-0000-0000-0000-000000000000',
  date           date not null,
  topic_id       uuid not null,
  subcategory_id uuid,
  minutes        integer not null check (minutes between 1 and 1440),
  note           text check (char_length(note) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- A weekly goal revision: in force from week_start (a Monday) until a later one.
-- minutes null = goal removed from that week on. One revision per topic per week.
create table public.log_goals (
  id         uuid primary key,
  owner_id   uuid not null default '00000000-0000-0000-0000-000000000000',
  topic_id   uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  minutes    integer check (minutes between 1 and 10080),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (topic_id, week_start)
);

create index log_topics_updated_idx  on public.log_topics (updated_at);
create index log_entries_updated_idx on public.log_entries (updated_at);
create index log_entries_date_idx    on public.log_entries (date);
create index log_goals_updated_idx   on public.log_goals (updated_at);

create trigger log_topics_touch before insert or update on public.log_topics
  for each row execute function public.touch_updated_at();
create trigger log_entries_touch before insert or update on public.log_entries
  for each row execute function public.touch_updated_at();
create trigger log_goals_touch before insert or update on public.log_goals
  for each row execute function public.touch_updated_at();

alter table public.log_topics  enable row level security;
alter table public.log_entries enable row level security;
alter table public.log_goals   enable row level security;

alter publication supabase_realtime add table public.log_topics, public.log_entries, public.log_goals;

-- ─── row-level security: members only ───────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'items', 'connections', 'settings'] loop
    execute format('drop policy if exists "anyone can read" on public.%I', t);
    execute format('drop policy if exists "anyone can insert" on public.%I', t);
    execute format('drop policy if exists "anyone can update" on public.%I', t);
    execute format('drop policy if exists "anyone can delete" on public.%I', t);
  end loop;

  foreach t in array array['rooms', 'items', 'connections', 'settings', 'log_topics', 'log_entries', 'log_goals'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "members can read" on public.%I for select to authenticated using ((select public.is_member()))', t);
    execute format(
      'create policy "members can insert" on public.%I for insert to authenticated
         with check ((select public.is_member()) and owner_id = ''00000000-0000-0000-0000-000000000000'')', t);
    execute format(
      'create policy "members can update" on public.%I for update to authenticated
         using ((select public.is_member())) with check (owner_id = ''00000000-0000-0000-0000-000000000000'')', t);
    execute format(
      'create policy "members can delete" on public.%I for delete to authenticated using ((select public.is_member()))', t);
  end loop;
end;
$$;

-- ─── storage: photos for members only ───────────────────────────────────────

drop policy if exists "anyone can read photos" on storage.objects;
drop policy if exists "anyone can upload photos" on storage.objects;
drop policy if exists "anyone can update photos" on storage.objects;
drop policy if exists "anyone can delete photos" on storage.objects;

create policy "members can read photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (select public.is_member()));
create policy "members can upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (select public.is_member()));
create policy "members can update photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (select public.is_member()));
create policy "members can delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select public.is_member()));

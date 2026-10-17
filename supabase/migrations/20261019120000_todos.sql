-- To-do list: simple things I want to do, with a priority and an optional due date.
--
-- Same shape as the Daily Log tables: the client keeps a local copy and upserts rows by id,
-- deletes are soft (deleted_at), and finishing one stamps done_at. due is a calendar day,
-- never derived from a timestamp.

create table public.todos (
  id         uuid primary key,
  owner_id   uuid not null default '00000000-0000-0000-0000-000000000000',
  title      text not null check (char_length(btrim(title)) between 1 and 200),
  priority   text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  due        date,
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index todos_updated_idx on public.todos (updated_at);

create trigger todos_touch before insert or update on public.todos
  for each row execute function public.touch_updated_at();

alter table public.todos enable row level security;

alter publication supabase_realtime add table public.todos;

-- Members only, like every other table (see 20261015120000_login_and_daily_log).
revoke all on public.todos from anon;
grant select, insert, update, delete on public.todos to authenticated;

create policy "members can read" on public.todos for select to authenticated
  using ((select public.is_member()));
create policy "members can insert" on public.todos for insert to authenticated
  with check ((select public.is_member()) and owner_id = '00000000-0000-0000-0000-000000000000');
create policy "members can update" on public.todos for update to authenticated
  using ((select public.is_member())) with check (owner_id = '00000000-0000-0000-0000-000000000000');
create policy "members can delete" on public.todos for delete to authenticated
  using ((select public.is_member()));

-- Daily Log: sleep and screen time, one number per metric per day.
--
-- The client names each row after its metric + date, so two devices setting the same day
-- write the same row and the later write wins. Clearing a value soft-deletes the row.
-- Sleep is counted on the morning you wake (the night before `date`).

create table public.log_metrics (
  id         uuid primary key,
  owner_id   uuid not null default '00000000-0000-0000-0000-000000000000',
  date       date not null,
  metric     text not null check (metric in ('sleep', 'screen')),
  minutes    integer not null check (minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (metric, date)
);

create index log_metrics_updated_idx on public.log_metrics (updated_at);

create trigger log_metrics_touch before insert or update on public.log_metrics
  for each row execute function public.touch_updated_at();

alter table public.log_metrics enable row level security;

alter publication supabase_realtime add table public.log_metrics;

-- Members only, like every other table (see 20261015120000_login_and_daily_log).
revoke all on public.log_metrics from anon;
grant select, insert, update, delete on public.log_metrics to authenticated;

create policy "members can read" on public.log_metrics for select to authenticated
  using ((select public.is_member()));
create policy "members can insert" on public.log_metrics for insert to authenticated
  with check ((select public.is_member()) and owner_id = '00000000-0000-0000-0000-000000000000');
create policy "members can update" on public.log_metrics for update to authenticated
  using ((select public.is_member())) with check (owner_id = '00000000-0000-0000-0000-000000000000');
create policy "members can delete" on public.log_metrics for delete to authenticated
  using ((select public.is_member()));

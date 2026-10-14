-- Daily Log: a sleep score out of 100 alongside sleep and screen time.
-- It is another metric row (metric = 'sleep_score'); its number lives in `minutes`,
-- which for this metric holds the score, so it is capped at 100.

do $$
declare
  c text;
begin
  -- Drop the old metric list, whatever Postgres named it.
  for c in
    select conname from pg_constraint
    where conrelid = 'public.log_metrics'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%''screen''%'
  loop
    execute format('alter table public.log_metrics drop constraint %I', c);
  end loop;
end;
$$;

alter table public.log_metrics
  add constraint log_metrics_metric_check check (metric in ('sleep', 'screen', 'sleep_score')),
  add constraint log_metrics_score_check check (metric <> 'sleep_score' or minutes <= 100);

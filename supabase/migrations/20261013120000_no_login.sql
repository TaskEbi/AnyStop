-- No more sign-in: the cabinet is one shared collection that anyone with the
-- site (and so its publishable key) can read and change. owner_id stays as a
-- column but every row now belongs to the one shared cabinet.

-- ─── one shared owner instead of auth users ─────────────────────────────────

alter table public.rooms              drop constraint rooms_owner_id_fkey;
alter table public.items              drop constraint items_owner_id_fkey;
alter table public.connections        drop constraint connections_owner_id_fkey;
alter table public.settings           drop constraint settings_owner_id_fkey;
alter table public.accession_counters drop constraint accession_counters_owner_id_fkey;

alter table public.rooms       alter column owner_id set default '00000000-0000-0000-0000-000000000000';
alter table public.items       alter column owner_id set default '00000000-0000-0000-0000-000000000000';
alter table public.connections alter column owner_id set default '00000000-0000-0000-0000-000000000000';
alter table public.settings    alter column owner_id set default '00000000-0000-0000-0000-000000000000';

-- Merge every account's exhibits into the shared cabinet. With a single account
-- the accession numbers stay as they were; with several they're renumbered by
-- date so they stay unique.
do $$
begin
  if (select count(distinct owner_id) from public.items where accession_no is not null) > 1 then
    update public.items set accession_no = null;
    update public.items i set accession_no = n.no
      from (select id, row_number() over (order by created_at, id) as no from public.items) n
      where i.id = n.id;
  end if;
end;
$$;

update public.rooms       set owner_id = '00000000-0000-0000-0000-000000000000';
update public.items       set owner_id = '00000000-0000-0000-0000-000000000000';
update public.connections set owner_id = '00000000-0000-0000-0000-000000000000';

-- Keep the most recently changed settings row.
delete from public.settings
  where owner_id <> (select owner_id from public.settings order by updated_at desc limit 1);
update public.settings set owner_id = '00000000-0000-0000-0000-000000000000';

delete from public.accession_counters;
insert into public.accession_counters (owner_id, last_no)
  select '00000000-0000-0000-0000-000000000000', coalesce(max(accession_no), 0) from public.items;

-- ─── row-level security: open to everyone ───────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'items', 'connections', 'settings'] loop
    execute format('drop policy "owner can read" on public.%I', t);
    execute format('drop policy "owner can insert" on public.%I', t);
    execute format('drop policy "owner can update" on public.%I', t);
    execute format('drop policy "owner can delete" on public.%I', t);
    execute format('grant select, insert, update, delete on public.%I to anon', t);
    execute format(
      'create policy "anyone can read" on public.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "anyone can insert" on public.%I for insert to anon, authenticated
         with check (owner_id = ''00000000-0000-0000-0000-000000000000'')', t);
    execute format(
      'create policy "anyone can update" on public.%I for update to anon, authenticated
         using (true) with check (owner_id = ''00000000-0000-0000-0000-000000000000'')', t);
    execute format(
      'create policy "anyone can delete" on public.%I for delete to anon, authenticated using (true)', t);
  end loop;
end;
$$;

-- ─── storage: the photos bucket stays private, but anyone may use it ────────

drop policy "owner can read photos" on storage.objects;
drop policy "owner can upload photos" on storage.objects;
drop policy "owner can update photos" on storage.objects;
drop policy "owner can delete photos" on storage.objects;

create policy "anyone can read photos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'photos');
create policy "anyone can upload photos" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'photos');
create policy "anyone can update photos" on storage.objects for update to anon, authenticated
  using (bucket_id = 'photos');
create policy "anyone can delete photos" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'photos');

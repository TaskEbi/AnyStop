-- Colour schemes for the cabinet, and the Mind Map 3D as a possible default view.

alter table public.settings
  add column palette text not null default 'kraft'
    check (palette in ('kraft', 'reading-room', 'blueprint', 'pressed-rose', 'white-cube', 'observatory'));

alter table public.settings drop constraint settings_default_view_check;
alter table public.settings
  add constraint settings_default_view_check check (default_view in ('shelves', 'collage', 'map', 'mind'));

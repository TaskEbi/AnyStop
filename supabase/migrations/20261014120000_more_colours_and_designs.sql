-- Twelve more room colours, six more colour schemes, and design themes that restyle the layout.

alter table public.rooms drop constraint if exists rooms_color_check;
alter table public.rooms
  add constraint rooms_color_check check (color in (
    'mustard', 'sage', 'blue', 'rose', 'lavender', 'apricot',
    'teal', 'forest', 'olive', 'lemon', 'coral', 'cherry', 'magenta', 'plum', 'sky', 'navy', 'slate', 'charcoal'
  ));

alter table public.settings drop constraint if exists settings_palette_check;
alter table public.settings
  add constraint settings_palette_check check (palette in (
    'kraft', 'reading-room', 'blueprint', 'pressed-rose', 'white-cube', 'observatory',
    'sea-glass', 'terracotta', 'citrus', 'graphite', 'candy', 'sunset'
  ));

alter table public.settings
  add column if not exists design text not null default 'cabinet'
    check (design in ('cabinet', 'gallery', 'zine', 'archive', 'soft'));

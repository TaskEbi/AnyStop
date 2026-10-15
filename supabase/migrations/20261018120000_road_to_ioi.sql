-- Road to IOI: the page's settings (my why, the Daily Log topic that counts as training, the five stages and
-- the DragonCode link) live in one json column on the settings row, so they sync like the rest of the settings.
-- The DragonCode link key in it is a read-only key for that site; settings are already readable only by the member.

alter table public.settings add column if not exists road jsonb not null default '{}'::jsonb;

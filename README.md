# Curio Cabinet

A private internet museum: save links, videos, articles, papers, photos, music, quotes and notes, then browse them on scrapbook shelves, a collage corkboard or a string map. Built in phases from the spec in `SPEC.md`. **Phases 1–5 are done.** Phase 6 (Claude-suggested connections) is optional and not started.

React 19 + Vite + TypeScript PWA, with Supabase for sync, storage and link previews. There is no login.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev:lan      # also reachable from your phone on the same Wi-Fi
npm test             # unit tests
npm run build        # type-check + production build (with service worker)
npx vite preview     # serve the production build at http://localhost:4173
```

With no `.env.local` the app runs in **local-only mode**: everything stays in this browser (IndexedDB) and nothing syncs. In dev, link previews still work through a local stand-in for the Edge Function (`/api/preview`).

## Connect Supabase (sync between laptop and phone)

1. Create a free project at supabase.com.
2. Copy `.env.example` to `.env.local` and fill in the **Project URL** and **anon / publishable key** (Project Settings → API). Never put the service-role key in this app.
3. Push the schema and deploy the preview function (no Docker needed):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run db:push          # applies every file in supabase/migrations
   npx supabase functions deploy preview --use-api
   ```

### Deploy (Vercel)

`vercel.json` holds the SPA rewrites, so `/share` (the phone share target and the bookmarklet) reaches the app. Import the repo in Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, and deploy.

## Privacy

**The cabinet is open.** There is no sign-in: every device that opens the app shares one cabinet, and the publishable key in the app's JavaScript can read, change and delete every exhibit and photo. Anyone who finds the deployed URL can do the same, so keep it to yourself. Photos live in the `photos` bucket and are shown through short-lived signed URLs. The preview function refuses private and internal addresses.

## How it works

- **Local-first sync.** Every change is applied in memory, written to IndexedDB and added to an outbox, so saving never waits for the network. The sync loop works in this order:
  1. Upload any photos that are still only on this device.
  2. Push the outbox: rooms first, then items, then strings.
  3. Pull everything that changed since the last sync.

  Supabase Realtime tells your other devices to pull straight away. Deletes are soft (`deleted_at`) so they reach devices that were offline.
- **Accession numbers** (No. 0001…) are handed out by the database. Two offline devices can therefore never pick the same number.
- **Previews.** `supabase/functions/_shared/preview.ts` combines several sources:
  - oEmbed for YouTube, Vimeo, Spotify, SoundCloud and TikTok
  - Crossref for DOIs
  - The Wikipedia summary API
  - Open Graph and citation meta tags for everything else

  Items save immediately with a guessed title and fill in when the preview arrives.
- **String Map.** `d3-force` (Barnes–Hut) drawn on canvas. Node positions are kept between visits so the layout doesn't jump.
- **Mind Map 3D.** Rooms are planets on a wide ring and each room's exhibits form a cloud around it, drawn on canvas with real perspective. By day it looks like a star chart on paper; at night it's a sky with glowing stars. Colours come from the theme tokens. Selecting a star shows a placard where you can **follow its strings** from one exhibit to the next, and **Tour** follows the strings on its own. Hidden stars swing round to face you, and the camera remembers its position between views. 60 fps with 1,000 exhibits, using pre-rendered sprites and no React work per frame.
- **Colour schemes.** Kraft, Reading room, Blueprint, Pressed rose, White cube and Observatory, each with a daylight and a night version (`src/styles/palettes.css`). The scheme syncs as `settings.palette`.
- **Collage.** DOM cards on a transformed layer with viewport culling. Far zoom switches to lightweight blocks. Positions sync through `collage_pos`.

## Using it

| | |
|---|---|
| Save | Paste into **Acquire** and press Enter · paste anywhere (Ctrl/Cmd+V) · drag a link or image onto the window · **+** or `N` for the full form |
| Phone | Install the app (Android: share sheet → Curio Cabinet; iPhone: Add to Home Screen, then paste links) |
| Desktop | Back office (☰ menu) → drag the bookmarklet to your bookmarks bar |
| Strings | Drawer → **Connect to…**, or **Tie a string** in Collage / String Map (click A, click B, add a label) |
| Wander | **Surprise me** or `R`: favours Up next and things you haven't opened lately |
| Safety net | Back office → Export (zip with photos) / Import |
| Jump to | `Ctrl`/`⌘` `K`: any exhibit, room, tag, view, lighting or colour scheme |
| Drawer | `←` `→` (or `J` `K`) step through the exhibits on show · deleting or cutting a string can be undone from the toast |
| Duplicates | Acquiring a link you already have shows the existing exhibit instead of a second copy |
| 3D map | Drag to turn · Shift-drag or two fingers to pan · scroll or pinch to zoom · double-click to open · arrows, `+` `−` and `0` when it has focus |
| Keys | `N` add · `/` search · `R` wander · `1` `2` `3` `4` views · `Esc` close |

## Performance (headless Chromium, 1,000 fake items + 300 strings)

| | |
|---|---|
| Shelves | First render 0.44 s, ~50 fps scrolling, search 0.15 s |
| String Map | Opens in 0.13 s, 60 fps while settling and panning |
| Collage | Opens in 0.27 s, 60 fps panning, 65–500 cards in the DOM thanks to culling |
| Mind Map 3D | Opens in 0.05 s, 60 fps orbiting and dragging (light and dark) |

To repeat it in dev, run `curioDev.fake(1000)` in the console, then `curioDev.clearFake()`.

## Layout

```
supabase/migrations/        schema, RLS, triggers, storage policies
supabase/functions/         preview Edge Function + shared preview core
src/lib/                    kind detection, camera (pan/zoom), photos, media/embeds
src/data/                   types, local store + outbox, sync, filters, actions, seed, backup, wander
src/ui/                     Sheet, Tape, Stamp, Icon, InlineConfirm, Toasts
src/features/               capture, filters, header, shelves (+8 card styles), drawer,
                            rooms, backoffice, map (String Map), mind (Mind Map 3D), collage,
                            canvas (shared), command (Ctrl/⌘ K palette)
src/app/                    App shell, session wiring, shortcuts, capture, share, theme
src/sw.ts                   service worker: offline shell, image cache, share target
```

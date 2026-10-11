# Build prompt: Curio Cabinet (my personal internet museum)

## What I want

Build me a private web app called **Curio Cabinet**. It's my own internet museum: one place to quickly save links, YouTube videos, articles, research papers, photos, music, quotes and notes about anything I'm interested in, and then browse them in a nice-looking space organised around my interests.

It's for me only. Nobody else adds to it or sees it. I want to use it on my laptop and my phone, so my collection needs to sync between them.

The three things that matter most:
1. **Saving has to be fast.** Paste a link and it's saved in a few seconds, with the details filled in for me.
2. **Two ways to look at everything.** A normal, tidy view for finding things, and a creative "collage" view that's fun to wander around.
3. **Connections between things.** I can tie any two saved items together with a labelled "string" and see the whole collection as a huge mind map.

## How to work

- Before writing code, give me a short plan: the stack, the data model, the folder structure and the build phases below. Wait for my OK.
- Build in the phases at the end of this file. Each phase should end with a working app I can run, and a short note on how to test it.
- Use TypeScript. Keep components small. Don't add libraries you don't need.
- Ask me before any choice that's hard to undo (database, auth provider, hosting).

## Suggested stack (change it if you have a good reason, but tell me why)

- **Frontend:** React + Vite + TypeScript, installable as a PWA so it works like an app on my phone.
- **Backend / sync:** Supabase (Postgres, auth, file storage). Single user, login by magic link or passkey. Row-level security so only my account can read or write anything.
- **Link previews:** one small serverless function (Supabase Edge Function or Vercel function) that fetches a URL server-side and returns its Open Graph / oEmbed metadata. The browser can't do this itself because of CORS.
- **Mind map:** `d3-force` for the layout with my own rendering, or React Flow if it's simpler. It must stay smooth with 500+ nodes.
- **Collage canvas:** custom pan/zoom with pointer events (mouse, trackpad, touch pinch). No heavy whiteboard library unless it saves a lot of work.
- **Hosting:** Vercel or Netlify, free tier.

## Data model

**Item** (one saved thing)
- `id`, `kind`: link | video | article | paper | photo | music | quote | note
- `title`, `url`, `creator` (author, artist, channel, speaker)
- `body`: the quote text or note text, for quotes and notes
- `note`: my personal note, "why I kept this"
- `room_id` (nullable = Unsorted), `tags` (string array)
- `status`: none | up_next | in_progress | done
- `favourite` (boolean)
- `image_path`: an uploaded photo or cover in storage
- `preview`: cached metadata from the preview function (site name, description, thumbnail URL, embed info, favicon)
- `accession_no`: a running number (No. 0001, No. 0002…), like a museum catalogue
- `collage_pos`: `{x, y}`, nullable (saved position in the collage)
- `created_at`, `updated_at`, `last_opened_at`

**Room** (a big interest, like a museum wing): `id`, `name`, `color` (from a fixed palette of about 6), `description`, `sort_order`

**Connection** (a "string" between two items): `id`, `item_a`, `item_b`, `label` (optional, e.g. "made by", "same idea", "inspired"). Each pair is stored once, whichever end you start from.

**Settings:** museum name (editable, default "Curio Cabinet"), default view, etc.

## Features

### 1. Fast capture
- A **quick-add bar** at the top. Paste anything and press Enter.
- **Paste anywhere.** Pressing Cmd/Ctrl+V on the page when no text field is focused opens the add sheet pre-filled with the pasted URL, text or image.
- **Drag and drop** a URL or an image file onto the window to add it.
- **Auto-detect the kind from the URL:**
  - YouTube, Vimeo, TikTok → video
  - Spotify, Apple Music, SoundCloud, Bandcamp → music
  - arXiv, DOI, PubMed, Semantic Scholar, `.pdf` → paper (pull out the arXiv ID or DOI)
  - Wikipedia, Medium, Substack, news sites → article
  - Image URLs → photo
  - Anything else → link
  - Plain text that isn't a URL: a quote if it's in quotation marks, otherwise a note
- **Auto preview:** call the preview function and fill in the title, description, thumbnail, site name and favicon. Cache the result on the item. If the fetch fails, fall back to a title guessed from the URL (e.g. `wiki/Pale_Blue_Dot` → "Pale Blue Dot") and never block saving.
- The add sheet has: kind picker, URL, title, creator, quote/note text (only for those kinds), "why I kept this" note, room (with "+ new room" inline), tags (autocomplete from existing tags), status, favourite, and a photo/cover upload.
- **Share to the app from my phone:** a PWA Web Share Target, so "Share → Curio Cabinet" from any app opens the add sheet.
- **A bookmarklet** for desktop that saves the current page in one click.
- Keyboard shortcuts: `N` add, `/` search, `R` random wander, `Esc` close, `1`/`2`/`3` switch views.

### 2. Organising: rooms + tags
- **Rooms** for big interests (Space, Jazz, Design…). Create, rename, recolour, reorder, delete. Deleting a room moves its items to Unsorted after a confirm step built into the page.
- **Tags** for themes that cut across rooms.
- **Filters** in a sidebar: room, status (Up next / In progress / Done), favourites, kind, tag. Filters combine. Show counts.
- **Search** across title, creator, quote/note text, my notes, tags, domain and room name.
- Sorting: newest, oldest, A–Z, recently opened.

### 3. View one: Shelves (the normal view)
- A masonry grid of cards with filters in the sidebar. This is the fast, scannable view.
- Each kind gets its own card style, all in the scrapbook look:
  - **Link:** paper ticket stub with a perforated edge and the domain as a little stamp
  - **Video:** film-strip frame (dark, with sprocket holes) showing the thumbnail and a play mark
  - **Article:** newspaper clipping with a zig-zag torn edge
  - **Paper:** ruled index card with the arXiv ID or DOI typed in a corner
  - **Photo:** Polaroid with a handwritten caption
  - **Music:** vinyl record half out of its sleeve, with the cover art as the record label
  - **Quote:** torn paper scrap, the quote in large italic type, "— Author" below
  - **Note:** yellow sticky note
- Washi tape strips on cards, coloured by room. A very slight random tilt (±1°) on each card.
- Status shows as a **rubber stamp** on the card ("TO WATCH", "TO READ", "TO LISTEN", "IN PROGRESS", "DONE"), with wording that fits the kind. Favourites get a small star.
- Each card shows its accession number ("No. 0042") and room in typewriter type.

### 4. View two: Collage (the creative view)
- An infinite corkboard/desk canvas you can **pan and zoom** (drag, scroll wheel, trackpad pinch, touch pinch).
- Items are laid out in clusters by room. Each room sits on its own coloured paper "mat" with a big handwritten label on a tape strip. Cards are tilted more here (±4°) so it feels like a real scrapbook spread.
- **Drag cards anywhere.** Positions save and sync. Mats grow to fit their cards. "Tidy up" resets to the automatic layout.
- **Strings:** connections are drawn as red yarn between cards, sagging slightly like real string, with pins at each end and a small paper tag showing the label. A toggle shows or hides strings.
- A floating room legend. Clicking a room flies the camera to that cluster.
- Zoom in / zoom out / fit-all buttons.

### 5. View three: String Map (the mind map)
- A force-directed graph of the whole collection:
  - **Room nodes:** large paper discs with handwritten names
  - **Item nodes:** small coloured pins with the kind icon and a short title
  - **Faint lines** from each item to its room
  - **Red threads** for my connections, with their labels
  - **Optional tag nodes** (toggle) that link every item sharing a tag, so hidden clusters show up
- Click a node to focus it: its neighbours light up, everything else dims, and the detail drawer opens.
- Drag nodes around. The layout settles smoothly and doesn't jump when data changes.
- Pan, zoom, fit, and a search box that flies to a node.
- It must stay smooth with 500+ items. Use Barnes–Hut or a similar approximation, and render with canvas or WebGL if SVG/DOM gets slow.

### 6. Connections
- **"Tie a string" mode** in Collage and String Map: click item A, click item B, type an optional label, done.
- In the detail drawer, **"Connect to…"** searches my collection and ties the result. Labels can be edited inline, and connections can be removed.
- The detail drawer lists every connection for that item, and clicking one jumps to it.
- **Suggested connections (optional, later phase):** a "Find related" button that sends the item plus a compact list of my other items to the Claude API and gets back up to 5 suggested links with reasons, each with a one-click "Tie" button. The API key stays on the server.

### 7. Detail drawer
- Opens from the right when you click any item (a full-screen sheet on phone).
- Shows the large card visual, title, creator, a link to open the original in a new tab, the domain, the accession number, the "Acquired" date, room, tags, and the status and favourite controls (these save instantly).
- **Embeds:** YouTube/Vimeo players, Spotify/SoundCloud players and PDF previews play right inside the drawer.
- Editable "why I kept this" note that autosaves.
- Connections section (see above).
- Edit and Delete, with the delete confirm built into the page (no browser `confirm()`).

### 8. Random wander
- A **"Surprise me"** button (and the `R` key) that picks a random item, weighted toward things marked Up next and things I haven't opened in a long time.
- In Shelves it opens the drawer. In Collage and String Map the camera flies to the item first.
- Optional: an "On this day" note showing what I saved on this date in past years.

### 9. Safety net
- **Export** the whole collection (items, rooms, connections, settings, plus a zip of photos) and **import** it back.
- Works offline: cache data locally (IndexedDB) and sync when back online. Saving should feel instant.

## Design direction: cozy scrapbook

- It should feel like a warm, hand-made scrapbook or a curiosity cabinet, not a generic SaaS dashboard.
- **Background:** kraft paper / desk with a subtle paper-grain texture.
- **Cards:** off-white paper with soft, real-looking shadows, washi tape in patterned colours (stripes, dots), slight tilts.
- **Type:** three roles.
  - A handwritten face for room names, labels and headings (e.g. Kalam, or something with similar warmth)
  - A readable book serif for body text (e.g. Literata)
  - A typewriter face for museum-style metadata like accession numbers, dates and domains (e.g. Courier Prime)
- **Palette:** kraft, paper white, warm ink brown-black, red thread as the accent, plus about 6 muted tape colours (mustard, sage, dusty blue, rose, lavender, apricot) used for rooms.
- **Museum details as content:** accession numbers, "Acquired 11 Oct 2026" dates, room "wings", placard-style labels.
- **Dark mode** ("the cabinet at night"): dark wood/desk, dim paper, the red thread a bit brighter. Follows the system setting, with a manual toggle.
- **Motion:** gentle and limited. Cards settle in on load, the camera glides in canvas views, a small wiggle when a card is pinned. Respect `prefers-reduced-motion`.
- **Mobile:** works properly at phone width. The sidebar becomes a filter sheet. Collage and String Map support touch pan and pinch.
- **Accessibility:** keyboard-navigable cards, visible focus states, good contrast in both themes.

## Build phases

1. **Foundation:** project setup, auth (just me), database schema + row-level security, rooms/items CRUD, the add sheet with URL kind-detection, and the Shelves view with filters and search. Uses the scrapbook design from day one.
2. **Previews & capture:** the preview function, thumbnails, embeds in the detail drawer, photo upload, paste-anywhere, drag-and-drop, PWA share target, bookmarklet.
3. **Connections + String Map:** the connections table, the "Connect to…" drawer UI, the force-directed mind map with focus, drag, tag nodes and fit.
4. **Collage:** the pan/zoom canvas, room mats, draggable cards with saved positions, red-string threads, tidy up.
5. **Polish:** random wander + "On this day", export/import, offline cache, dark mode pass, mobile pass, performance check with 1,000 fake items (then delete them).
6. **Optional:** Claude-suggested connections, Claude auto-tagging on save.

## Done means
- I can paste a YouTube link on my phone and see it on my laptop a few seconds later with its thumbnail and title.
- I can switch between Shelves, Collage and String Map and the same filters apply.
- I can tie two items together from any view and see the string in both canvas views.
- Nobody but me can read my data, even if they find the URL.
- Seed the app with ~12 clearly marked example items (e.g. *Powers of Ten*, *Attention Is All You Need*, *Pale Blue Dot*, *Kind of Blue*, Dieter Rams' ten principles) in 4 rooms with a few connections, so I can see every view working. Add a "Clear examples" button.

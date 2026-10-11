# Curio Cabinet

A private internet museum: save links, videos, articles, papers, photos, music, quotes and notes, then browse them on scrapbook shelves. Built in phases from the spec in `SPEC.md`. **Phase 1 (foundation) is done.**

React 19 + Vite + TypeScript, with Supabase for login, sync and storage.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev:lan      # also reachable from your phone on the same Wi-Fi
npm test             # unit tests (kind detection, URL → title)
npm run build        # type-check + production build
```

With no `.env.local` the app runs in **local-only mode**: everything is kept in this browser's IndexedDB and nothing syncs. The header badge says "Local only".

## Connect Supabase (sync between laptop and phone)

1. Create a free project at supabase.com.
2. Copy `.env.example` to `.env.local` and fill in the **Project URL** and **anon / publishable key** (Project Settings → API). Never put the service-role key in this app.
3. Push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run db:push
   ```
4. In the Supabase dashboard:
   - **Authentication → Emails → Magic Link template**: add `{{ .Token }}` so the email contains a 6-digit code. Example body: `<p>Your code: <strong>{{ .Token }}</strong></p><p>Or <a href="{{ .ConfirmationURL }}">open the cabinet</a>.</p>`
   - **Authentication → URL Configuration**: set Site URL to `http://localhost:5173` for now. The deployed URL gets added in phase 2.
5. Sign in once with your email, then go to **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. Your account then stays the only one.

### Privacy

Every row has an `owner_id`. Row-level security only lets a signed-in user read or write their own rows, and the anonymous key alone can't read anything. Photos go in a private bucket under `<your user id>/…`.

## How sync works

- Every change is applied in memory immediately, written to IndexedDB, and added to an **outbox**. Saving never waits for the network.
- The sync loop pushes the outbox (rooms, then items, then strings), then pulls anything changed on the server since the last sync.
- Supabase Realtime tells the other device to pull straight away. The loop also runs when the app regains focus, when you come back online, and every 60 s.
- Deletes are soft (`deleted_at`), so they reach devices that were offline.
- Accession numbers (No. 0001…) are assigned by the database. Two offline devices therefore never hand out the same number. A new item shows "No. —" until it has synced.

## Layout

```
supabase/migrations/   schema, row-level security, triggers, storage policies
src/lib/               detectKind, titleFromUrl, formatting, tiny store helper
src/data/              types, local store + outbox, sync, filters, actions, seed examples
src/ui/                Sheet (dialog), Tape, Stamp, Icon, InlineConfirm, Toasts
src/features/          auth, capture (quick add, add sheet), filters, header, shelves (+ 8 card styles), drawer, rooms
src/app/               App shell, session wiring, shortcuts, theme
```

## Keyboard

`N` add · `/` search · `Esc` close · `1` Shelves. `R`, `2` and `3` arrive with their phases.

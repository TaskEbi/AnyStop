# Daily Log — implementation handoff

Status: feature specification, ready for implementation planning. No feature code has been changed.

## Purpose and confirmed choices

Add a personal activity tracker inside Curio Cabinet that feels like its own small app. The primary task is recording how much time was spent on schoolwork, violin, sports, and other activities each day.

The user confirmed:
- Time is entered manually after an activity; no timer is needed.
- Daily and weekly totals and weekly goal progress are priorities.
- Topics support optional subcategories.

Everything below is a proposed implementation default unless identified as confirmed. Prefer a small, complete version with quick entry over additional productivity features.

## Outstanding decision: access and privacy

The existing app has no login and shares its cloud cabinet with anyone who can access the deployed app. The user has been asked whether Daily Log should use that arrangement or require sign-in; no answer has been supplied yet.

Do not describe existing cloud storage as private. Local UI, calculations, and storage work can proceed independently. Resolve the access model before deploying cloud storage for personal logs. If sign-in is requested, scope authentication and ownership/RLS explicitly; a hidden navigation link or client-only password does not protect records. Do not change access to existing cabinet data incidentally.

## Navigation and appearance

- Add a prominent Cabinet / Daily Log switch on desktop and mobile.
- Daily Log has Today, History, and Overview navigation; topic management is accessible from this section.
- Keep the cabinet's current view and filters when switching away and back.
- Use existing colour palettes, light/dark mode, typography, and reusable controls, with a layout optimized for logging.
- Share the app shell, offline availability, and sync status. Daily Log is a separate feature, not another exhibit type or cabinet view.
- Cabinet-specific filters, acquisition controls, paste/drop capture, and keyboard shortcuts must not activate while using Daily Log. The command palette can offer navigation to both sections.

## 1. Topics and subcategories

- Create, rename, reorder, archive, and restore topics. Each topic has a name and a palette colour.
- Offer Schoolwork, Violin, and Sports as optional starter topics, without fake log entries or goals.
- A topic can have one level of subcategories: Schoolwork → Maths, English; Sports → Running, Swimming. No deeper nesting in v1.
- Topic selection is required; subcategory selection is optional. A topic-only entry is valid even when subcategories exist.
- Prevent blank names and case-insensitive duplicate names among active siblings. Trim surrounding spaces.
- Archive rather than permanently delete topics/subcategories. Existing entries and totals remain available; archived choices cannot be used for new entries. Archiving a topic hides its children from new-entry selectors too.
- Preserve historical relationships: renaming updates displayed labels; moving a subcategory between topics is out of scope.
- Editing an old entry may retain its archived selection, but choosing a replacement requires an active topic/subcategory.

## 2. Today: fast manual entry

Place the entry form near the top, followed by the selected day's totals and entries.

Fields:
- Date: defaults to today; allow earlier dates. No future entries in v1.
- Topic: required; show recent topics first for convenience.
- Subcategory: optional and filtered to the selected topic. Reset it if the topic changes.
- Duration: labelled hours and minutes fields, with integer values. Hours may be zero; minutes range from 0–59; combined duration must be 1–1,440 minutes.
- Duration shortcuts: 15 min, 30 min, 45 min, 1 hr. Clicking a shortcut replaces the duration rather than adding to it.
- Note: optional short text, maximum 1,000 characters. Keep it visually secondary.

Behaviour:
- Save immediately to the local store; cloud availability must not block entry.
- Prevent repeated clicks from submitting the same form twice. Intentionally recording multiple sessions is allowed.
- After saving, retain date and topic/subcategory, clear duration and note, and focus duration for another entry. Show a concise saved confirmation.
- Display formatted durations as “1 hr 30 min”, calculating with integer minutes throughout.
- Allow multiple entries for the same topic/subcategory/day. Example: Violin 30 min + Violin 45 min = Violin 1 hr 15 min.
- Display the day's total, totals by topic, and individual entries with edit/delete actions. Show most recently created entries first within a day.
- Deletion offers undo using existing app conventions. Editing or deleting updates all summaries and goal progress immediately.
- Treat logs as additive records; there are no start/end times or overlap detection. If a day's combined total exceeds 24 hours, show a non-blocking prompt to check entries.
- Today has previous-day/next-day controls and a date picker; disable navigation beyond today. A clear Today control returns to the current date.

## 3. History

- Default to the current week, grouped by day with newest dates first.
- Offer previous/next week and a custom inclusive date range.
- Filter by topic and, when a topic is selected, its subcategory. Include archived topics when they have records.
- Show the filtered period total and each day's subtotal.
- Allow editing, deleting, and adding a backdated entry directly from history.
- Empty states distinguish no entries from no matching entries and provide a relevant add/reset action.

## 4. Overview and weekly goals

- Default to the current Monday–Sunday week, with previous/next week navigation and a This week shortcut. Do not offer future weeks in v1.
- Show total logged time, a seven-day bar chart, and per-topic totals with expandable subcategory breakdowns.
- Include zero-entry days in charts. Make numeric values available as text; colour cannot be the only way to identify a topic.
- Topic totals include direct topic entries plus all their subcategory entries, exactly once. Show direct entries as “No subcategory” in breakdowns.
- Set an optional weekly duration goal per top-level topic. Subcategory goals and a combined overall goal are out of scope for v1.
- Goal cards show actual / target, percentage, and remaining time. At or above target show “Goal reached” and any extra time; never show negative remaining time.
- Cap the visual progress bar at 100%, but show the true numeric percentage above 100%.
- No goal means no target or percentage; it is not a failed goal. Reject zero/negative targets; provide an explicit Remove goal action.
- Goals repeat each week until changed or removed. A change applies to the currently active week and later weeks; previous weeks retain their historical targets. No backdated goal editing in v1.
- Archive a topic without losing past goal history. Hide its current goal card by default; if it has entries in the viewed week, show its totals with an archived label.
- Avoid streaks, reminders, scores, or guilt-based labels in v1.

## Dates and week semantics

- Use a persistent Daily Log timezone, initially Asia/Singapore for this user. Resolve it centrally, not independently per chart or device.
- Store entry dates as YYYY-MM-DD calendar dates. UTC timestamps track record creation/updates only; converting UTC must never shift a logged date.
- Week boundaries, today's date, and future-date validation use the Daily Log timezone. Weeks start Monday.
- A later timezone setting change must not rewrite historical entry dates.
- Refresh today's date when the app regains focus or crosses midnight. Preserve a deliberately selected historical date or an unsaved form.

## Suggested data model

Use separate records rather than overloading exhibits, rooms, or tags. Adapt naming to repository conventions.

- ActivityTopic: id, parent_id (null for top-level topic), name, colour (top-level), sort_order, archived_at, created_at, updated_at, deleted_at. Enforce at most one parent level.
- ActivityEntry: id, date, topic_id, subcategory_id (nullable), duration_minutes, note (nullable), created_at, updated_at, deleted_at. A subcategory must belong to the selected topic.
- ActivityGoalRevision: id, topic_id, effective_week_start, target_minutes (nullable means goal removed), created_at, updated_at, deleted_at. Resolve a week's goal using the latest revision effective on or before that Monday. One logical revision per topic/effective week; define deterministic reconciliation for concurrent edits.
- Daily Log settings: timezone. Keep navigation/filter preferences separate from activity records.

All totals and percentages are derived from non-deleted entries. Do not persist running totals. Archived categories are included in calculations. Do not sum topic totals and their subcategory breakdowns together.

## Repository integration

Observed stack: React + TypeScript + Vite PWA; IndexedDB local storage; Supabase outbox sync; existing ZIP export/import.

- Put feature UI in src/features/daily-log/ and isolate aggregation/date helpers for testing.
- Integrate section selection with src/app/App.tsx, src/app/Museum.tsx, and the existing Header. Preserve cabinet state and a single session/sync lifecycle.
- Review src/app/useShortcuts.ts and useCapture so cabinet actions do not intercept logging interactions.
- Extend src/data/types.ts, store.ts, actions.ts, idb.ts, and sync.ts (or factor equivalent shared infrastructure). The current IndexedDB version is 2: add a non-destructive migration, preserving existing stores and queued changes.
- Include the new record types in outbox retry, pull, realtime handling, and soft-delete propagation. Push parent topics before subcategories and entries/goals.
- Follow the existing record conflict policy; handle invalid references and archive/delete races without crashes or silently dropping logs.
- Add Supabase migrations and appropriate access policies once the access decision is resolved. Document any deployment steps; do not automatically deploy as part of this handoff.
- Extend src/data/backup.ts with a versioned format that includes topics, entries, goals, and timezone. Continue accepting old cabinet backups; missing Daily Log fields must not clear existing logs. Validate new fields and restore relationships. Repeated imports must not duplicate records.
- Keep phone layouts usable with touch controls and numeric duration keyboards. Provide labels, focus handling, keyboard operation, and readable chart summaries.

## Acceptance criteria and meaningful checks

1. Log Schoolwork → Maths for 1 hr 30 min, Schoolwork without a subcategory for 30 min, and Violin for 45 min on the same day. Day total is 2 hr 45 min; Schoolwork is 2 hr; its breakdown is Maths 1 hr 30 min and No subcategory 30 min.
2. A 3-hour Schoolwork weekly goal with those entries shows 2 / 3 hr, approximately 67%, and 1 hr remaining. Adding another 2 hours shows approximately 133%, Goal reached, and 1 hr extra.
3. Editing, deleting, and undoing an entry updates Today, History, Overview, and goal cards consistently.
4. Backdating to Sunday does not count toward the following Monday's week. Test month/year boundaries and Singapore dates near UTC midnight.
5. Changing this week's goal does not change the previous week's target; removing it affects this week and subsequent weeks only.
6. Renaming or archiving a topic/subcategory preserves historical records and totals; invalid parent/subcategory combinations are rejected.
7. Zero, negative, fractional, malformed, and excessive per-entry durations cannot be saved. Future dates are rejected. Double-clicking Save creates only one record.
8. Offline entry survives reload and syncs on reconnect without duplication. Edits and deletions propagate to a second device under the agreed access model.
9. Export/import round-trips all log data; older cabinet backups still load; upgrading IndexedDB preserves existing cabinet data.
10. Switching sections preserves cabinet state. Cabinet paste/drop capture and shortcuts do not interfere with logging. Check mobile layout and keyboard-only entry.

Run focused tests for aggregation, date/week boundaries, goal revisions, validation, and backup compatibility, followed by the existing test suite and production build. Manually verify the primary phone/desktop entry flow and offline persistence. Report any cloud validation that could not be performed.

## Scope boundaries and suggested order

V1 excludes timers, daily goals, subcategory goals, task management, calendar scheduling, streaks, reminders, AI insights, social features, cabinet-exhibit links, and rich journal editing.

Suggested sequence:
1. Data model, date/aggregation helpers, local persistence migration, and section navigation.
2. Topic management, manual entry, Today, and History.
3. Overview, weekly goals, and historical goal revisions.
4. Backup compatibility, agreed cloud access/sync, accessibility, and regression checks.

Deliver a working feature with implementation notes and verification results. Treat the unanswered access question as an explicit product decision, not permission to assume either shared cloud access or a new authentication system.

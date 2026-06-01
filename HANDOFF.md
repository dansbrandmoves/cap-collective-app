# Coordie — Continuation Handoff

**Last session ended:** 2026-06-01 UTC
**Last pushed commit:** `2f56bc6` — "park native in-app scheduling until Google re-verification"
**Live at:** https://www.coordie.com (Vercel auto-deploys on push) — **THIS IS A LAUNCHED APP.**
  Don't ship anything that degrades real users (e.g. unverified OAuth scopes, broken builds).
**Google OAuth:** ✅ verified for `calendar.readonly` only. Owner + guest both request read-only.
**Commit convention:** prefix every commit subject with `coordie:` (parallel work across projects).
**Becoming:** Arro Calendar / Arro Scheduler — part of the Arro family (erro.ai).

---

## 🚦 Start here in a new thread
1. `git pull origin master`
2. Read memory index: `…/memory/MEMORY.md` — especially `project_coordie_guest_sync.md`,
   `project_coordie_diagnostics_and_roster.md`, `project_unified_calendar_direction.md`.
3. Skim `CLAUDE.md` at project root.
4. **Run `npm test`** (9 logic tests over the availability engine) before/after changes.
5. **Eyes:** when anything misbehaves, open **/admin/diagnostics** (admin only) and read the
   execution trace BEFORE guessing or doing SQL archaeology. Every guest/owner/cron flow logs there.

---

## ⏳ ONE thing waiting on the user (verify, do first)
**Confirm the unified guest sync actually fires end-to-end.** All built + deployed, but as of
session end NO guest had connected on a browser running the new bundle, so `guest_calendar_tokens`
was still empty and there were zero `guest_sync` records. The likely cause: earlier reconnects ran
the OLD cached JS (the unified-sync code only became *deployable* after the Vercel build fix at
`ed18ab0` — prior pushes `b2c117b` failed to build). To verify:
1. Confirm latest Vercel deploy is **green** (several mid-session builds failed; `ed18ab0`+ are fine).
2. **Hard-refresh** the guest page (Cmd/Ctrl+Shift+R) — normal refresh serves stale JS.
3. Reconnect daniel.furfaro. New code = a **popup** (not inline). Diagnostics should show
   `guest_connect_calendar → "server sync running"`, then a **`guest_sync`** record, then another
   every ~15 min from the cron.
```sql
select count(*) tokens, count(*) filter (where google_refresh_token is not null) with_refresh
  from guest_calendar_tokens;
select event, detail->>'actor', detail->>'status', detail->>'summary', created_at
  from diagnostics order by created_at desc limit 10;
```
Expect ≥1 token WITH a refresh token, and `guest_sync` events with status `ok`.
(Late in session the user said this "looks like it fixed it" after reconnecting on the new
build — confirm the cron keeps it fresh: change an event, wait ≤15 min, watch for a new `guest_sync`.)

---

## 🅿️ PARKED: native in-app scheduling (revisit pre-launch-of-that-feature)
Built the full "schedule a real meeting in-app" flow, then **deliberately parked it** because this is
a live app and `calendar.events` is an unverified sensitive scope (would warn real users). Current
state (`2f56bc6`): owner + guest OAuth are **read-only**; the Day Inspector has the nice scheduling
form (title, Time window | All day toggle, best-slot prefill, attendee picker) but **"Schedule
meeting" opens a prefilled Google Calendar tab** (no write scope). The native path is preserved:
- `create_event` action is deployed in `google-calendar-auth` (unreachable for now).
- `createCalendarEvent()` helper exists in `googleCalendar.js`.
- To RE-ENABLE: flip `startGoogleAuth` to `OWNER_SCOPES` (readonly+events) and make
  `handleCreate()` in AvailabilityCalendar.jsx call `createCalendarEvent(...)` instead of
  `openGCalTemplate(...)`. THEN submit Google re-verification (scope justification + demo video +
  privacy-policy Calendar-data disclosure — the privacy page may need a wording update first).
User decided: stay on Google-Calendar-tab scheduling for now, polish everything else, revisit when
ready to launch native scheduling.

---

## ✅ Shipped 2026-05-31 / 06-01 session (this one)
**Native scheduling built then parked** (`02d1913` built it, `2f56bc6` parked it — see PARKED above).

**Unified guest calendar sync — guests now sync server-side like owners** (`8c4c95c`):
- New tables `guest_calendar_tokens` (+ `timezone`, refresh token, service-role-only RLS) and
  `guest_calendar_sync_state`. Mirrors the owner `profiles.google_refresh_token` + `calendar_sync_state`.
- `google-calendar-auth` edge fn gained `guest_exchange` (popup **code-client** auth code → refresh
  token, stored per room+guest) and `guest_disconnect` actions.
- New `sync-guest-calendars` edge fn: refresh token → fetch primary events → derive free days **in the
  guest's stored timezone** (Deno is UTC, so tz matters) → rewrite `shared_availability`; logs `guest_sync`.
- `cron_sync_guest_calendars` on the 15-min schedule (parallels `cron_sync_calendars`).
- Client: guest connect switched from implicit token (no refresh) to popup code client (offline →
  refresh token); `connectGuestCalendar` now just triggers the server sync. Migrations:
  `20260531_guest_calendar_sync_schema.sql`, `20260531_guest_sync_cron.sql`.
- **Gotcha:** guest sync only works for connections made on the post-`ed18ab0` build (older
  connections have no refresh token; cron can't sync them — guest must reconnect once).

**Owner is a first-class participant in joint availability** (`aa066cd`, `27ad5fd`): "You" is the
first roster chip, your connected-calendar free/busy counts in the day free/N tally, Best Days, and
the inspector. Fixed the old "[owner + 1 guest] never shows an overlap" gap.

**Account hub** (`b850c85`): `/account` with tabs **Calendars · Availability · Billing**, entered via
the sidebar **avatar** ("Account & settings"). Old `/calendars`, `/availability`, `/billing` redirect
into tabs. Sub-pages take an `embedded` prop (headerless). Sidebar nav trimmed to Projects + Booking
(+ admin). Loud "Upgrade to Pro" CTA gone — upgrade now surfaces contextually via `UpgradeModal`.

**Settings trimmed** (`b850c85`): cut Prefix Rules, Status Labels, availability-mode toggle (blocks is
default), Guest Calendar Access toggle (always on). Defaults still work under the hood; only UI removed.

**Roster → project left panel** (`b2c117b`): People roster moved out of the calendar column into the
left panel (who on the left, when full-width on the right). New `useProjectPeople` hook is the single
source of truth for roster + include/exclude selection, shared by panel and calendar.

**Collapsible + drag-resizable side panels** (`b2c117b`, `ed18ab0`): `useResizablePanel` hook +
`ResizeHandle.jsx`. Main nav and project panel each collapse to a rail + drag-resize independently;
widths persist in localStorage. Desktop only; mobile keeps the drawer.

**Admin Diagnostics** (`bf9fe18`): n8n-style execution log at `/admin/diagnostics`. `src/utils/diag.js`
(logEvent/startRun). This is the debugging backbone — use it first.

**Smaller:** guest-identity fix so invite_only guests always get the name prompt (`98cee05`);
`shared_availability`/`date_requests` added to realtime so the owner view updates live (`f11b102`);
removed private notes from the project panel; light-mode heading contrast fix (`604263b`).

---

## ✅ Shipped previous session (2026-05-30)
**Live calendar sync (S1) — server-owned, near-live, verified server-side:**
- `sync-calendar` edge function: incremental `events.list` per governing calendar with stored
  `syncToken`, writes only changed rows to `owner_calendar_events` (upsert/delete by
  `google_event_id`; daily re-baseline of the −1mo/+3mo window; empty delta = no write; dedupe
  by event id). Triggers: client on-app-load + manual; 15-min `pg_cron` fallback; (push = S2).
- Delivery via Supabase **realtime** on `owner_calendar_events` → owner + guests update live, no
  browser polling. Client retired the old full-fetch + Settings-scoped 30-min interval.
- Cron self-authorizes via a DB-stored `app_config.cron_secret` (no service-role key / Vault).
- **diagnostics table**: client→server event log (anon-insert) so guest-side flows are debuggable
  without the browser console. This is the tool that found the RLS bug.

**Arro theme + UX (all owner-side, user should eyeball):**
- Accent token violet → **Arro teal `#5e9c8c`** app-wide (`tailwind.config.js`).
- Dark mode less-dark slate (`#1e2429…`), **landing page forced light**.
- Availability month view: **one calm teal meter per day** (was a neon stripe-per-slot barcode).
- Day inspector is now a **real split column** (calendar shrinks beside it; no dimming overlay; Esc closes; mobile = bottom sheet). Applied in group calendar + project overview.
- Killed the room **Notes tab**. Decluttered/reorganized the **left nav** (primary top, project sub-list, config/account pinned bottom). "Who's included" people filter on Best Days.

**Earlier in session:** guest connect-calendar-first flow; date-request form → "tap your free
days"; Room→Group / Production→Project naming; one-click copy link; project-level **Best Days**
aggregate calendar; **group/project delete fix** (cascade FKs); legal TOS/Privacy updates.

---

## 🔜 Open / next (priority order)
1. **S2 — Google push notifications** (true seconds-live). Layers on the S1 engine. Plan is in
   `…/.claude/plans/let-s-double-down-on-steady-wall.md`. **Needs user config:** a
   `coordie.com/api/gcal-webhook` Vercel route (I provide code) + **domain verification** in
   Google Cloud Console. No new OAuth scope. Then build `calendar_watches` + `calendar-webhook`
   edge fn + `events.watch` register + renewal cron.
2. **The "one effortless dashboard"** (researched — see `project_unified_calendar_direction.md`):
   roster strip (everyone in the group, visible to members) → best-window answer line →
   **LIST / CALENDAR / GRID** toggle over one dataset → push inspector. Build incrementally.
   Sidebars should be **collapsible + drag-resizable**.
3. **A2/A3 — calendar convergence:** fold `ProjectOverview` grid into shared `MonthlyView`;
   migrate `RoomCalendarPanel` + guest `RoomView` to the `role` prop (A1 added the prop, derived
   internally) and delete the legacy booleans.
4. **Bookings → a project "meeting" mode** (not a silo): `rooms.mode` + `bookings.room_id`,
   guest pick-a-time via the unified calendar, retire `/booking-pages` last. (Revises the old
   "don't merge bookings" decision.)

---

## ⚠️ Gotchas (hard-won)
- **Dropbox holds `index.lock`** → commit via the temp-index workaround in CLAUDE.md
  (`GIT_INDEX_FILE=.git/index_tmp git read-tree HEAD` first — critical).
- **Don't use PowerShell here-strings (`@'...'@`) in the Bash tool** — the `@` leaks into the
  commit subject. Use a `printf`/`-F file` message.
- **Supabase RLS targets the `anon` role, not `public`** — guest (anonymous) inserts need
  policies `to anon, authenticated` + explicit grants, or they silently fail (this was the
  guest-sync bug). `date_requests` may still have a `public`-targeted insert policy — check it
  if guest date requests don't persist.
- **Owner-authenticated UI can't be verified by the agent** (no sign-in). Verify via: `npm test`,
  Supabase SQL/MCP, the `diagnostics` table, the guest-facing surfaces (logged-out preview),
  and the user click-testing. `preview_screenshot` times out in this env — use `preview_snapshot`.
- **Edge functions** are deployed via MCP and mirrored in `supabase/functions/` for VC; migrations
  applied via MCP and mirrored in `supabase/migrations/`.
- Supabase project: `xwuekcysigkujhyucugi`. GitHub: `dansbrandmoves/cap-collective-app`.

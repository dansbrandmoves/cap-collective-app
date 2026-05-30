# Coordie — Continuation Handoff

**Last session ended:** 2026-05-30
**Last pushed commit:** `7b35b8f` — "fix guest calendar writes — anon RLS on shared_availability"
**Live at:** https://www.coordie.com (Vercel auto-deploys on push)
**Google OAuth:** ✅ verified for `calendar.readonly` (no unverified-app warning).
**Commit convention:** prefix every commit subject with `coordie:` (parallel work across projects).
**Becoming:** Arro Calendar / Arro Scheduler — part of the Arro family (erro.ai).

---

## 🚦 Start here in a new thread
1. `git pull origin master`
2. Read memory index: `…/memory/MEMORY.md` — especially `project_unified_calendar_direction.md`, `project_ux_principles.md`, `project_arro_theme.md`.
3. Skim `CLAUDE.md` at project root.
4. **Run `npm test`** (9 logic tests over the availability engine) before/after changes.

---

## ⏳ ONE thing waiting on the user (do first)
**Verify guest calendar sync.** The RLS bug that silently blocked guest writes is fixed
(`7b35b8f`). Christian needs to have the test guest (daniel.furfaro@gmail.com) **reconnect
their Google Calendar** in the group. Then verify via SQL:
```sql
select guest_name, count(*) free_days, bool_or(date='2026-07-02') as has_jul2
from shared_availability group by guest_name;
select event, detail, created_at from diagnostics order by created_at desc limit 10;
```
Expect free-days written, July 2 **excluded** (guest busy 8am–7pm), and a `guest_connect_done`
diagnostic. If empty, read the diagnostic skip reason.

---

## ✅ Shipped this session (2026-05-30)
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

# Cap Collective App — Claude Orientation

---

## SESSION START — READ THIS BLOCK FIRST

### Critical IDs (never guess these)
| Key | Value |
|-----|-------|
| Supabase `project_id` | `xwuekcysigkujhyucugi` |
| GitHub `owner` | `dansbrandmoves` |
| GitHub `repo` | `cap-collective-app` |
| Production branch | `master` |
| Feature branches | `claude/<description>` |
| Vercel live URL | `https://www.coordie.com` |

### MCP Tools — schema must be loaded before first call
All Supabase and specialty MCP tools are **deferred** — calling them without loading the schema first will throw `InputValidationError`. Always `ToolSearch` before the first call in any session:

```
ToolSearch({ query: "select:mcp__0d08157b-3774-4d9a-ab3b-15694ab833bd__execute_sql,mcp__0d08157b-3774-4d9a-ab3b-15694ab833bd__apply_migration" })
```

Load only the tools you need for the task — don't bulk-load everything.

### Git — ALWAYS use temp index (Dropbox holds index.lock)
Plain `git add` fails. Use this exact pattern every time:

```bash
GIT_INDEX_FILE=.git/index_tmp git read-tree HEAD   # CRITICAL — do this first or you wipe the tree
GIT_INDEX_FILE=.git/index_tmp git add <specific files>
GIT_INDEX_FILE=.git/index_tmp git commit -m "..."
rm -f .git/index_tmp
git push -u origin <branch>
```

---

## What This Is

A production coordination app built for Christian (Cap Collective). React + Vite prototype deployed to Vercel.

**Client:** Christian, Cap Collective
**Asana Task:** Delivery Track — `1213855114828051`
**GitHub:** dansbrandmoves/cap-collective-app

---

## The Core Mental Model

Everything lives inside a **Production**. Inside a Production, people are organized into **Groups**. Each Group gets a **Room**.

```
Production
  └── Group (owner-named, e.g. "Clients", "Vendors", "Crew")
        └── Room
              ├── Shared Notes
              ├── Chat
              └── Availability View
```

- **Christian sees everything** — all Rooms, all threads, private notes layer
- **Group members see only their Room** — clean, scoped, feels custom-built for them
- Groups are never hardcoded as "client" or "vendor" — Christian names them

---

## Stack

- **Framework:** React + Vite (v5)
- **Styling:** Tailwind CSS v3 (pinned — do NOT upgrade to v4, config format changed)
- **State:** React Context (AppContext) — Supabase for collaborative data, localStorage for owner-only settings
- **Database:** Supabase (`xwuekcysigkujhyucugi`) — productions, groups, messages, shared_notes, group_members
- **Auth:** localStorage `isOwner` flag — no real auth in prototype
- **Deployment:** Vercel — `vercel.json` rewrite rule already in place
- **Notes:** Simple `<textarea>` — no rich text editor

---

## Current Build State (as of April 1, 2026)

### Fully working
- Dashboard — production cards, unread badges, date countdown, create production modal
- Production View — group list, group overview panel, private notes, access mode toggle, member management
- Room — Notes tab (auto-saves to Supabase), Chat tab (threaded, owner/guest bubbles, real sender names), Availability tab (full calendar)
- Availability Rules page — slot editor (create/edit/delete), full calendar preview, production overrides
- Calendar Settings page — real Google Calendar OAuth (client-side), role assignment modal, manual sync, disconnect
- Owner/Guest mode toggle (bottom of sidebar) — switches the full app between views
- **Token-based Room links** — `/room/:token` — Christian copies a short token link to paste into his own emails
- **Open Link mode** — one shared link per group; guests are prompted for their name on first visit (stored in localStorage)
- **Invite Only mode** — Christian adds people by name+email, each gets a unique `/room/:invite_token` link to copy
- **Three calendar views** — Monthly (color-coded slot bars per day), Weekly (slot rows × 7 days), Daily (slot cards with driving event detail + private notes for owner)
- **Slot system** — owner can create/edit/delete named time slots (name, time range, color, default state)
- **Derivation logic** — `*` veto > `^` soft hold > governing calendar > available. All-day end-date correction applied.
- **Google Calendar OAuth** — client-side via Google Identity Services. Token stored in localStorage. Fetches calendar list + events from governing calendars on sync. `VITE_GOOGLE_CLIENT_ID` is configured with real key in `.env`.
- **Real-time chat/notes** — Supabase channel subscriptions in RoomView, scoped per `group_id`
- **Mobile responsive** — fully done across all screens (see Mobile Layout section below)

### Intentionally stubbed (not broken)
- No email sending — Christian writes his own emails and pastes room links manually
- Availability rule *creation* UI not built (rules exist in seed data, viewable but not editable)

### Not built yet
- Real auth (owner login with PIN or password)

---

## Architecture Decisions (don't second-guess without reason)

- **Supabase for collaborative data, localStorage for owner settings:** Productions, groups, messages, shared_notes, and group_members live in Supabase so room links work cross-device for guests. Slots, connectedCalendars, prefixRules, isOwner stay in localStorage — owner-only, no sharing needed.
- **`seedSupabase()` on first load:** If Supabase tables are empty, seeds all SEED_DATA automatically. Runs once, idempotent.
- **`isOwner: false` defaults on first load:** guests visiting room links get the correct guest view. Christian toggles himself to owner via the sidebar button on his device, which persists in localStorage. Do NOT change this default back to `true` — it caused guests to send messages under Christian's name.
- **Tailwind v3 not v4:** v4 uses CSS-based config (no `tailwind.config.js`), has rough Vite edges. Pinned to v3 deliberately.
- **Owner notes not rendered at all for guests** — not just hidden with CSS. Gated on `isOwner` in the component, not a style toggle.
- **`googleCalendarId` as the stable key for calendar events:** Internal `id` values on `connectedCalendars` can collide (especially after localStorage rehydration). All event matching uses `googleCalendarId` (e.g. `primary`, `holds`) which is stable and unique. This applies in `fetchAllGoverningEvents`, `deriveSlotState`'s `calendarMap`, and seed data's `calendarEvents[].calendarId`. Do not revert to internal `id` matching.
- **Token-based room routing:** Rooms are accessed via `/room/:token`. Tokens are nanoid(8) strings. Each group has an `open_token` (shared link) and each group_member has an `invite_token` (personal link). `resolveToken(token)` checks both tables in parallel and returns `{ productionId, groupId, mode, memberName }`.
- **No email infrastructure:** Christian writes his own emails. The app only generates links for him to copy and paste.
- **Google Calendar OAuth is client-side only** — no backend needed. Uses Google Identity Services token model. Access tokens expire in ~1hr; user re-auths when needed. Fine for prototype.

---

## Design System (don't drift from this)

**Palette:**
- Background: `zinc-950` / custom `surface-950` (`#0c0c0e`)
- Card surfaces: `surface-900` (`#141416`), `surface-800` (`#1c1c20`)
- Accent: amber — `#f59e0b` (Tailwind `amber-400`) — used for unread badges, active tabs, owner chat bubbles, CTA buttons
- Text: `zinc-100` primary, `zinc-400` secondary, `zinc-600` tertiary/labels
- Private notes area: `surface-950` background + `accent/30` border to visually separate from everything else

**Feel:** production house, not SaaS. Dark, intentional, premium. The Room should feel like Christian built it for you specifically.

**Font:** Inter via Google Fonts (loaded in `index.html`)

---

## File Structure

```
src/
  App.jsx                    — router + AppProvider wrapper
  main.jsx                   — entry point
  index.css                  — Tailwind directives + base styles + scrollbar
  contexts/
    AppContext.jsx            — all state, Supabase sync, localStorage sync, helper functions
  data/
    seed.js                  — SEED_DATA: slots, connectedCalendars, calendarEvents, productions, groupMembers
  utils/
    availability.js          — derivation logic (veto/hold/governing), getMonthGrid, getWeekDays, dateToStr
    googleCalendar.js        — GIS OAuth, fetchCalendarList, fetchCalendarEvents, fetchAllGoverningEvents
    supabase.js              — Supabase client (createClient from env vars)
  components/
    layout/
      AppShell.jsx           — wraps owner routes (sidebar + outlet)
      Sidebar.jsx            — nav, production list, unread badges, owner/guest toggle
    ui/
      Badge.jsx              — variants: default, accent, green, yellow, red, purple, ghost
      Button.jsx             — variants: primary, secondary, ghost, danger
      Modal.jsx              — escape-to-close, backdrop click-to-close
    availability/
      AvailabilityCalendar.jsx — wrapper: legend + view switcher + navigation + renders one of three views
      MonthlyView.jsx        — full month grid, slot color bars per day, click → Daily
      WeeklyView.jsx         — 7-day × slot rows table, click → Daily
      DailyView.jsx          — slot cards with state, driving event, prefix explanation, owner private note
      SlotEditor.jsx         — create/edit/delete named time slots (name, time, color, default state)
  pages/
    Dashboard.jsx            — production grid + create production modal
    ProductionView.jsx       — group list + group overview panel + private notes + access mode/member management
    RoomView.jsx             — token resolution, NamePrompt (open_link guests), Notes/Chat/Availability tabs, real-time subscription
    AvailabilityRules.jsx    — SlotEditor + calendar preview + production overrides
    CalendarSettings.jsx     — Google OAuth, role assignment modal, sync, disconnect
```

---

## Supabase Schema

**Project:** `xwuekcysigkujhyucugi`

```sql
productions       — id, name, description, start_date, end_date, owner_notes, created_at
groups            — id, production_id, name, access_mode ('open_link'|'invite_only'), open_token
shared_notes      — id, group_id, content, updated_at
messages          — id, group_id, sender_id, sender_name, text, timestamp, read
group_members     — id, group_id, name, email, invite_token, created_at
```

- All tables have RLS enabled with anon read/write policies (prototype — tighten before production)
- `messages` and `shared_notes` are in the Supabase realtime publication
- `buildProductions(prods, grps, notes, msgs)` assembles the nested state structure from flat rows

---

## Environment Variables

```
VITE_GOOGLE_CLIENT_ID=<google oauth client id>
VITE_SUPABASE_URL=https://xwuekcysigkujhyucugi.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase anon key>
```

- Set in `.env` for local dev (gitignored) — real keys already configured
- All three must also be added to Vercel dashboard → Project Settings → Environment Variables
- Google Cloud Console project: `cap-collective-app` (Project ID: `cap-collective-app`)
- OAuth Client ID type: Web application
- Authorized JS origins: `http://localhost:5173` + Vercel URL (Vercel URL not yet added — needed before OAuth works in production)

---

## Running Locally

```
npm run dev
```

Keep the terminal open. Visit `http://localhost:5173`. The dev server does NOT run in the background — it needs an open terminal.

**First-run note:** If Supabase tables are empty, the app auto-seeds on load. If a user has stale localStorage without `openToken` on groups, they need to clear `cap-collective-app` from localStorage to trigger a re-seed.

---

## Screens

1. **Dashboard** (Christian only) — all active Productions, health signals, unread count
2. **Production View** (Christian only) — Groups as tabs, private notes layer, access mode toggle, member management
3. **Room** (Christian + Group members) — shared notes, chat, availability view; accessed via `/room/:token`
4. **Availability Rules** (Christian only) — slot editor, calendar preview, production overrides
5. **Calendar Settings** (Christian only) — Google OAuth, calendar roles, sync

---

## Design Principles

1. Christian never feels lost — every screen has one clear next action
2. Clients feel the craft — Rooms should feel intentional and premium
3. Private is private — owner notes are never one misclick from being visible
4. Scheduling is a view, not a form — availability is something Christian controls
5. Groups are flexible — never hardcode "client" or "vendor" in the UI

---

## Data Model

```
User (owner)
  └── Production[]                          ← Supabase: productions
        ├── name, description, date range
        ├── ownerNotes (private — never shown to guests)
        ├── availability_rules[]
        └── groups[]                        ← Supabase: groups
              ├── id, productionId, name
              ├── accessMode ('open_link' | 'invite_only')
              ├── openToken (nanoid 8-char — shared link token)
              └── room
                    ├── sharedNotes         ← Supabase: shared_notes
                    ├── messages[]          ← Supabase: messages
                    │     { id, senderId, senderName, text, timestamp, read }
                    └── (availability derived from calendarEvents + slots in AppContext)

GroupMembers[]                              ← Supabase: group_members
  ├── id, groupId, name, email, inviteToken (nanoid 8-char)

Slots[] — global, owner-defined             ← localStorage
  ├── id, name, startTime, endTime, color, defaultState

ConnectedCalendars[] — global               ← localStorage
  ├── id, googleCalendarId, name, color, role (governs | informational | ignored)

CalendarEvents[] — fetched from Google or loaded from seed   ← localStorage
  ├── id, calendarId (= googleCalendarId), title (may have * or ^ prefix), start, end, isAllDay
```

---

## Mobile Layout

Mobile responsiveness is fully implemented. Approach used throughout:

- **Sidebar** (`AppShell.jsx` + `Sidebar.jsx`) — slide-over drawer on mobile (`fixed`, `translate-x-full` → `translate-x-0`). Hamburger button in a sticky top bar (`md:hidden`). Backdrop overlay closes it. On desktop: `md:sticky`, normal flow.
- **Dashboard** — `px-4 sm:px-8 py-6 sm:py-10`
- **ProductionView** — two-panel layout (group list + detail) collapses to single-panel on mobile. `mobileShowDetail` state drives which panel is visible. Tapping a group shows detail + "← Back" button. `hidden md:flex` / `flex` swap on the two panels.
- **RoomView** — padding reduced with `sm:` breakpoints, chat bubbles `max-w-[75%]`, back link shows "Back" on mobile
- **AvailabilityCalendar** — controls stack `flex-col` on mobile, row on `sm:flex-row`
- **MonthlyView** — single-letter day headers on mobile (`sm:hidden` / `hidden sm:inline`), cell min-height `48px` → `72px`
- **WeeklyView** — columns compress (`min-w-[40px] sm:min-w-[80px]`), slot label column narrows, state text labels hidden on mobile (dots only), day headers single-letter on mobile
- **DailyView** — already stacked cards, no changes needed

**Pattern used everywhere:** `sm:` breakpoints (not `md:`) for padding/text. `md:` for layout changes (sidebar, two-column → single-column). Mobile-first: base = mobile, `sm:`/`md:` = larger.

---

## Next Iteration Priorities

1. **Owner PIN login** — simple PIN screen so Christian can safely share the Vercel URL publicly
2. **Add Vercel URL to Google Cloud Console** — Authorized JS origins so OAuth works in production
3. **Verify Supabase env vars in Vercel** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in Vercel dashboard → Production (the Supabase integration adds non-VITE-prefixed versions which Vite can't read)
4. **Availability rule creation UI** — let Christian add/edit rules from the Availability Rules page

---

## Calendar Event Derivation Rules

Priority order (highest wins):
- `*` prefix on title → **blocked** (red) — veto, nothing overrides
- `^` prefix on title → **hold** (indigo) — soft hold, tentative
- Regular event on `governs` calendar → **booked** (amber)
- No governing event → **available** (green)
- Events on `ignored` or `informational` calendars → no effect on slot state
- All-day events: Google returns exclusive end date — app subtracts 1 day before evaluating overlap

**Critical:** `calendarEvents[].calendarId` stores the `googleCalendarId` value (e.g. `primary`, `holds`), NOT the internal `id`. The `calendarMap` in `deriveSlotState` keys on `googleCalendarId`. This is intentional — internal IDs can collide.

---

## Git & Deployment Lessons (hard-won)

### The index.lock problem
This repo is in a Dropbox folder and Claude Code runs background `git status` checks continuously. Both hold `index.lock`, making normal `git add / commit` fail with "Unable to create index.lock: File exists."

**Workaround that works:** use a temporary index file to bypass the lock entirely:
```bash
GIT_INDEX_FILE=.git/index_tmp git read-tree HEAD   # initialize from current HEAD — CRITICAL first step
GIT_INDEX_FILE=.git/index_tmp git add <files>      # stage changes on top of full tree
GIT_INDEX_FILE=.git/index_tmp git commit -m "..."  # commit from temp index
rm -f .git/index_tmp
git push
```

**The critical step is `git read-tree HEAD` first.** Without it, the temp index starts empty and the commit only contains the explicitly staged files — deleting everything else from the repo. This happened twice and required force-push recovery.

**If you forget `git read-tree` and push a broken commit:** recover with:
```bash
GIT_INDEX_FILE=.git/index_fix git read-tree <last-good-sha>
GIT_INDEX_FILE=.git/index_fix git add <changed files>
GIT_INDEX_FILE=.git/index_fix git commit -m "fix: restore full tree + changes"
rm -f .git/index_fix
git push --force
```

### Vercel env vars
- The Supabase Vercel integration injects `SUPABASE_URL` / `SUPABASE_ANON_KEY` — **not** `VITE_` prefixed
- Vite only exposes `VITE_*` vars to the browser bundle — non-prefixed vars are invisible to client code
- Must manually add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel → Project Settings → Environment Variables → Production
- `VITE_GOOGLE_CLIENT_ID` also needs to be set for Production (not just Development)
- After adding env vars, redeploy — env changes don't auto-trigger a new build

### isOwner default
- `isOwner` must default to `false` for fresh browsers — defaulting to `true` caused guests to be treated as the owner, sending messages under Christian's name
- Christian's device retains `isOwner: true` via localStorage persistence after first toggle

---

## Open Questions (not yet answered by Christian)

- What does he call the unit of work — "Production," "Project," or "Shoot"?
- Does he want clients to request specific dates, or just see availability?
- How many active productions does he typically run at once?

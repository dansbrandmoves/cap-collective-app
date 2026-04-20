# Coordie — Continuation Handoff

**Last session ended:** 2026-04-20
**Last pushed commit:** `dd3844f` — "ProductionView: clear sharing, room-name header, project settings"
**Live at:** https://www.coordie.com (Vercel auto-deploys on push)

---

## 🚦 Start here in a new thread

1. `git pull origin master`
2. Read the vision doc: `C:\Users\danie\.claude\projects\C--Users-danie-Dropbox-Creative-Cloud-Files-Client-Fulfillment-MM-vibe-coding-cap-collective-app\memory\project_coordie_vision.md`
3. Skim `CLAUDE.md` at project root

---

## ✅ Shipped this session

| SHA | Summary |
|---|---|
| `37eca1c` | Fix mobile send button (stale prop) + room-unavailable flash on slow networks (timeout 6s→12s, distinguish empty-state from gone) |
| `831f34e` | **Groups → Rooms rename** throughout: DB migration (`groups`→`rooms`, `group_members`→`room_members`, `group_id`→`room_id` in messages/shared_notes/date_requests/shared_availability), AppContext rename (`createRoom`/`updateRoomName`/`deleteRoom`/`addRoomMember`/`getMembersForRoom`/`FREE_ROOM_LIMIT`/`canAddRoom`), all consumer files updated |
| `dd3844f` | **ProductionView redesign**: main-area title is now the room name (not "Availability"), prominent "Share room" button replaces gear icon, new ShareModal (access mode, link copy, invite, Inbox summary, "Preview as guest"), Project Settings modal now includes availability config (subsumed), room rename uses modal (fixed clipped Cancel), auto-select first room on load, auto-create default room when project is created |

---

## 🧠 Current mental model

- **Production → Rooms** (renamed from "Groups"). DB table is `rooms`. Each production auto-creates one default room on create.
- **ProductionView layout**:
  - **Sidebar**: project header (name + Edit/Delete) → Rooms list + "+ New Room" → Private Notes at the bottom. Rooms have hover-revealed Rename/Delete. Mobile: slide-over drawer via ☰ "Rooms" button.
  - **Main area**: always shows the selected room's calendar. Header = room name + optional `N pending` chip + **Share room** button. No gear.
- **Share modal**: the one clear place for sharing. Access mode, link copy, invite members, pending count → Inbox, and **Preview as guest** (opens `/room/:token` in a new tab so the owner sees exactly what guests see).
- **Project Settings modal** (one modal, scrollable with sticky footer): name/description/dates + availability config (mode, business hours per day, guest slot selection, "Reset to global").
- **Guest room view (`/room/:token`)** is untouched by this redesign — still shows Notes/Availability tabs with the guest-facing calendar.

---

## 📋 Backlog (priority order)

1. **Homepage marketing copy still says "groups"** in a couple places ("Rooms for every group", "groups for each set of collaborators") — small copy update in `src/pages/HomePage.jsx`.
2. **Google sign-in warning** — if the scary Google screen shows up on *sign-in* (not calendar connect), check **Supabase Dashboard → Authentication → Providers → Google → Additional scopes** and remove `calendar.readonly` if present. Basic profile scopes don't trigger warnings; the calendar scope does. Sign-in doesn't need it — the calendar-connect flow has its own consent.
3. **Verify slot-request flow E2E in a real room** — toggle `guestSlotSelection` in Project Settings, guest selects date → slots → Send. Confirm owner inbox shows slot chips and DayInspectorPanel renders the "By time slot" heatmap.
4. **Inbox UI for `slot_map`** — Inbox list currently shows dates only. Should surface selected slots per date when `slot_map` exists.
5. **RESEND_API_KEY check** in Supabase → Edge Function Secrets (edge functions silently no-op if missing).
6. **Google OAuth verification** (~2 hrs of Daniel's time): verify `coordie.com` via Search Console, fill OAuth consent screen (sensitive `calendar.readonly`), record 60s demo of guest-calendar-connect, submit; 2–4 wk wait.
7. **Guest view privacy pass** — overlap counts show for guests but names should NOT. Check MonthlyView/WeeklyView tooltip `title` attrs.
8. **Real-time subscription on `shared_availability`** in RoomView — only `date_requests` live-updates currently.
9. **Phase 2 room overlap: multi-person filter** — chip-row at top of AvailabilityTab: `Show overlap with: [Me] [Sarah] [Tom]`. Note: `shared_availability` table is read but no longer written (Share-with-team dropped). Phase 2 needs a different live data source — see "Why snapshot share was dropped" below.
10. **Timezone actually used** — stored in context, but slot times and email timestamps don't use it yet.

---

## 🧭 Why snapshot "Share with team" was dropped

Snapshots to `shared_availability` went stale the moment a guest's calendar changed, producing false positives ("Sarah's free Wed!" → actually she's not anymore). In coordination, false positives are worse than absence. Proper fix requires offline/refresh-token consent, which hits the same Google verification gate.

**Future options:** (1) auto-refresh on revisit, (2) background refresh + cron, (3) calendar push webhooks. If Phase 2 ships, consider opt-in-per-visit rather than persisted; the share moment is also a natural **conversion moment** to prompt Coordie account signup.

---

## 🧠 Mental model: personal-calendar overlay vs date-request

Two intentionally separate concepts:

1. **Personal-calendar overlay** (passive, sessionStorage): guest connects Google Calendar, sees their busy/free highlighted. Helps them *see* what works. Lives in `sessionStorage['coordie-gcal']`.
2. **Date-request flow** (active, Supabase): guest manually picks dates/slots and sends a request. Writes to `date_requests` + `shared_availability`. Triggers email to owner.

Booking = overlay only. Rooms = both.

---

## 🔧 Working rules for this repo

### Committing (Dropbox + temp-index workaround)

Plain `git add` fails because Dropbox holds `.git/index`. Use a temp index every time:

```bash
GIT_INDEX_FILE=.git/index_tmp git read-tree HEAD   # CRITICAL — start from HEAD or you'll wipe the tree
GIT_INDEX_FILE=.git/index_tmp git add <files>      # stage specific files, NEVER `git add -A`
GIT_INDEX_FILE=.git/index_tmp git commit -m "..."
rm -f .git/index_tmp
git push origin master
```

### Preview server

- `preview_start` with name `cap-collective` (port 5173, config in `.claude/launch.json`)
- Vite dep cache pinned to `os.tmpdir()/vite-cap-collective` to avoid Dropbox EBUSY (see `vite.config.js`)
- App uses real Supabase auth — can't navigate owner routes in preview without credentials. Homepage renders fine.
- **Parser gotcha:** Babel here doesn't parse optional-catch-binding — use `catch (e) { }`.

### Design tokens

- Motion: `ease-ios` = `cubic-bezier(0.32, 0.72, 0, 1)`
- Shadows: `shadow-lift`, `shadow-sheet`
- Tap targets: `min-h-touch` / `min-w-touch` = 44px
- Accent: purple `#8b5cf6`
- Never use `border-surface-700` (too harsh) — use `border-white/[0.06]` or `border-white/10`
- Cards: `bg-surface-900 border border-white/[0.06] rounded-2xl p-5 sm:p-6 hover:border-white/10 hover:shadow-lift transition-all duration-200 ease-ios`
- Page wrapper: `px-5 sm:px-8 lg:px-14 py-8 sm:py-12`
- H1: `text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15]`
- Loading: `<PageLoader />` — never "Loading..." text

### Toggle switches

- Track off: `bg-surface-600` (NOT `bg-[#f0f0f0]`)
- Track on: `bg-accent`
- Knob: `bg-white shadow-sm`

### Settings persistence architecture

- **`profiles.settings` JSONB** stores all owner settings cross-device: `guestCalendarEnabled`, `timezone`, `theme`, `slotStateCustomizations`, `prefixRules`
- `AppContext.fetchPlan()` reads `settings` on login — Supabase wins over localStorage on conflict
- Sync `useEffect` (guarded by `profileLoaded`) writes back on change
- Rooms read `guestCalendarEnabled` from owner's profile, not context

### Email (edge functions)

- Outer white bg + `@media (prefers-color-scheme: dark)` overrides
- Include `<meta name="format-detection" content="telephone=no,date=no,...">` to stop auto-linkifying
- Purple CTA (`#8b5cf6`)
- Deploy via MCP `mcp__0d08157b-...__deploy_edge_function`
- **Note:** `notify-date-request` still expects `groupName`/`groupId` fields — `createDateRequest` in AppContext sends them as `groupName: roomName, groupId: roomId` for backward compat. If you redeploy the edge function, rename there too.

---

## 🗂 Key files

| File | What's there |
|---|---|
| `src/pages/HomePage.jsx` | Marketing at `/`. Phase-driven booking flow demo (no cursor). |
| `src/App.jsx` | Routes: `/` = HomePage(visitor)/Dashboard(auth), `/signin`, `/project/:id`, `/room/:token`, `/inbox`, `/booking/:slug`. |
| `src/pages/ProductionView.jsx` | **Redesigned this session.** Sidebar = rooms + project mgmt; main = selected room's calendar + Share button. Contains: `ProductionView`, `RoomCalendarPanel`, `ShareModal`, `RenameRoomModal`, `EditProjectModal` (subsumes availability settings), `EmptyState`. |
| `src/pages/RoomView.jsx` | Guest room view (`/room/:token`). Notes + Availability tabs. Untouched in redesign. |
| `src/pages/BookingPageView.jsx` | Booking page. Guest calendar overlay, slot picker. |
| `src/components/ui/GoogleOAuthGuide.jsx` | Shared animated OAuth walkthrough modal. |
| `src/components/availability/AvailabilityCalendar.jsx` | Monthly/Weekly/Daily + DayInspectorPanel. Props renamed `groupId`→`roomId`. |
| `src/contexts/AppContext.jsx` | All state + Supabase sync. Room CRUD, date requests, notifications, plan limits. |
| `src/pages/CalendarSettings.jsx` | Settings: Google OAuth, business hours, timezone, theme, branding, `guestCalendarEnabled`. |
| `supabase/functions/notify-booking/index.ts` | v11 deployed — container-less email. |
| `supabase/functions/notify-date-request/index.ts` | v14 deployed — renders slot chips per date when `slot_map` present. Still uses legacy `groupName`/`groupId` field names internally. |

---

## 🏗 Infrastructure

- **Vercel**: auto-deploys on push to `master`
- **Supabase project ID**: `xwuekcysigkujhyucugi`
- **Tables (post-rename)**: `productions`, `rooms`, `room_members`, `shared_notes`, `messages`, `date_requests`, `shared_availability`, `profiles`, `booking_pages`, `bookings`, `owner_calendar_events`
- **Google OAuth**: works but unverified; scary warning screen until Google approves `calendar.readonly`
- **Resend**: requires `RESEND_API_KEY` in Edge Function Secrets
- **`profiles` columns**: `id, plan, logo_url, logo_is_dark, connected_calendars, google_refresh_token, settings` (jsonb)

---

## 💡 How Daniel works

- Ships fast, iterates on real feedback
- Values honesty about tradeoffs + vision alignment
- "When you see a good move, look for a better one"
- Prefers tight strategic responses for exploratory questions (2–4 sentences + recommendation + tradeoff)
- Framing: "effortless, useful, and gorgeous"
- Responds well to momentum — keep the energy up
- Prefers data model to match UX ("groups → rooms" was driven by this, not cosmetic)

---

## 🎯 Next chat is Stripe

Daniel is starting a fresh chat to work on **Stripe integration** next. Context for that session:

- `BillingPage.jsx` already has Pro plan UI + `handleUpgrade` stub
- `profiles.plan` column: `'free' | 'pro'`
- Free limits: `FREE_PROJECT_LIMIT = 1`, `FREE_ROOM_LIMIT = 2`, `FREE_BOOKING_PAGE_LIMIT = 1`
- Upgrade gating via `UpgradeModal` triggered by `canAddProject`/`canAddRoom`/`canAddBookingPage` checks
- Need: Stripe Checkout for subscription, webhook to flip `profiles.plan`, billing portal for cancel/update card
- Keys live in Supabase Edge Function Secrets (not hardcoded)

---

**When ready: pull, check backlog item #1 (homepage copy) or start Stripe work per above.**

# Coordie — Continuation Handoff

**Last session ended:** 2026-04-19 (late evening)
**Last commit on `master` (pushed):** `f3359f5` — "Rooms: guest calendar overlap across Monthly/Weekly/Daily views"
**Live at:** https://www.coordie.com (Vercel auto-deploys on push)

---

## 🚦 First actions in this new thread

1. **Pull latest:**
   ```bash
   git pull origin master
   ```
2. **Read the vision doc before anything else:**
   - `C:\Users\danie\.claude\projects\C--Users-danie-Dropbox-Creative-Cloud-Files-Client-Fulfillment-MM-vibe-coding-cap-collective-app\memory\project_coordie_vision.md`
3. **Skim `CLAUDE.md` at project root** — architecture, conventions, Dropbox git-index workaround.

---

## ✅ Shipped this session

| SHA | Summary |
|---|---|
| `5e71830` | Email: render slot chips per date when slot_map present in notify-date-request (v13 deployed) |
| `ee6cfa7` | Google OAuth guide: animated step-by-step modal before calendar connect + guestCalendarEnabled defaults to true |
| `2d18357` | OAuth guide: full start-to-finish animation — cursor clicks Advanced, section expands, cursor clicks "Go to coordie.com" |
| `beae9b0` | Extract GoogleOAuthGuide to shared component; wire into booking page |
| `f85d8b2` | Room: always show GuestCalendarPanel for guests — remove localStorage gate |
| `c649576` | Settings: sync all owner settings to Supabase profiles.settings |
| `7512d59` | Booking: slot-level overlap — dim guest-busy slots, dot free days; OAuth guide highlights "Go to coordie.com" with yellow bg |
| `5911a6c` | Guest calendar: replace bare X with labeled "Disconnect" in both views |
| `82bf0df` | Guest calendar: persist connection in sessionStorage across remounts |
| `4fea274` | Booking: add visual dot before "busy" label for easier scanning |
| `f3359f5` | Rooms: guest calendar overlap across Monthly/Weekly/Daily views |

---

## 📋 Backlog (priority order)

1. **Phase 2 of room overlap: multi-person filter** — when others have shared availability, add a chip-row at top of AvailabilityTab: `Show overlap with: [Me] [Sarah] [Tom]`. Lets guests isolate two-person overlap. Right now the personal calendar overlay (busy/free) is independent of the per-day "N people free" badges.
2. **Verify slot-request flow E2E in a real room** — toggle `guestSlotSelection`, guest selects date → slots → Send. Confirm owner inbox shows slot chips and DayInspectorPanel renders the "By time slot" heatmap.
3. **Inbox UI for slot_map** — Inbox list currently shows dates only. Should surface selected slots per date when `slot_map` exists.
4. **RESEND_API_KEY check** — edge functions silently no-op if key isn't set. Confirm still configured in Supabase → Edge Function Secrets.
5. **Google OAuth verification** (parallel track, ~2 hrs of Daniel's time):
   - Verify `coordie.com` via Google Search Console
   - Fill OAuth consent screen (sensitive `calendar.readonly` scope only)
   - Record a 60s demo of the guest-calendar-connect flow
   - Submit; 2–4 wk wait
6. **Guest view privacy pass** — overlap counts show for guests but names should NOT. Double-check MonthlyView/WeeklyView tooltip `title` attributes are owner-gated.
7. **Real-time subscription on `shared_availability`** in RoomView — currently only `date_requests` live-updates.
8. **DayInspectorPanel polish** for 10+ guests — may need scroll or "show more" collapse.
9. **Timezone actually used** — stored in context, but booking page slot times and email timestamps don't yet use it. Wire up when ready.

---

## 🧠 Mental model: the personal-calendar overlay

Two separate concepts, intentionally:

1. **Personal-calendar overlay** (passive, sessionStorage-only) — guest connects their Google Calendar, sees their busy/free state highlighted in the views (booking + room). Helps them *see* what works. Stored in `sessionStorage['coordie-gcal']` so it survives view switches and tab navigation but doesn't persist forever. Disconnect button always available.

2. **Date-request flow** (active, persisted to Supabase) — guest manually picks dates/slots and sends a request. Writes to `date_requests` and `shared_availability` tables. Triggers email to owner. This is the explicit coordination action.

**Booking** uses overlay only — booking is one-and-done, no team coordination needed. **Rooms** use both — overlay helps each participant see their own fit; date-request flow lets them communicate intent. The room overlay also subtly informs Phase 2 (multi-person filtering) — see backlog #1.

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

- `preview_start` with name `cap-collective` (config in `.claude/launch.json`, port 5173)
- Vite dep cache is pinned to `os.tmpdir()/vite-cap-collective` via `vite.config.js` to avoid Dropbox EBUSY.
- App uses real Supabase auth — can't navigate owner routes in preview without credentials.
- **Parser gotcha:** Babel in this project doesn't parse optional-catch-binding (`catch { }`) — use `catch (e) { }`.

### Design tokens

- Motion: `ease-ios` = `cubic-bezier(0.32, 0.72, 0, 1)`
- Shadows: `shadow-lift`, `shadow-sheet`
- Tap targets: `min-h-touch` / `min-w-touch` = 44px
- Accent: purple `#8b5cf6`
- Ambient background: `.ambient-glow` CSS utility

### Component conventions

- Cards: `bg-surface-900 border border-white/[0.06] rounded-2xl p-5 sm:p-6 hover:border-white/10 hover:shadow-lift transition-all duration-200 ease-ios`
- Never use `border-surface-700` — too harsh. Use `border-white/[0.06]` or `border-white/10`.
- Page wrapper: `px-5 sm:px-8 lg:px-14 py-8 sm:py-12`
- H1: `text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15]`
- Loading: `<PageLoader />` — never "Loading..." text or "Co" box

### Toggle switches

- Track off: `bg-surface-600` (not `bg-[#f0f0f0]` — that's near-white in dark mode)
- Track on: `bg-accent`
- Knob: `bg-white shadow-sm` (shadow makes it pop against any background in light mode)

### Availability overlap display pattern

- **Weekly view, owner, desktop**: per-slot count badge (`3`) in cell corner
- **Weekly view, owner, mobile**: subtle purple dot in cell corner; day count badge always in column header
- **Weekly view, guest, slot-selection**: direct cell click toggles slot (no slide-over); selected = accent ring
- **Daily view, owner**: avatar chips (`S` `T` +2) per slot card showing who's free for that slot
- **Daily view, guest, slot-selection**: slot cards are toggleable buttons; selected = accent border + checkmark
- **DayInspectorPanel**: owner taps column header → right drawer with full per-slot heatmap + GCal scheduling

### Email (edge functions)

- Outer white bg + `@media (prefers-color-scheme: dark)` overrides
- Always include `<meta name="format-detection" content="telephone=no,date=no,...">` to stop iOS/Gmail auto-linkifying
- Purple CTA (`#8b5cf6`)
- Deploy via MCP `mcp__0d08157b-...__deploy_edge_function`

### Google OAuth guide (`src/components/ui/GoogleOAuthGuide.jsx`)

- Shared component used in both `RoomView.jsx` and `BookingPageView.jsx`
- Animated 7-second walkthrough: cursor flies to "Advanced" → clicks → section expands → cursor moves to "Go to coordie.com (unsafe)" → clicks → CTA lights up
- CSS keyframes in `index.css`: `animate-cursor-fly-click`, `animate-cursor-fly-click-down`, `animate-click-flash`, `animate-pulse-ring`, `animate-progress-fill`
- Intercepts the "Connect Calendar" button click; fires `requestAccessToken()` on confirm

### Settings persistence architecture

- **`profiles.settings` JSONB** — stores all owner settings cross-device: `guestCalendarEnabled`, `timezone`, `theme`, `slotStateCustomizations`, `prefixRules`
- `AppContext.fetchPlan()` reads `settings` on login and restores state — Supabase wins over localStorage on conflict
- A sync `useEffect` (guarded by `profileLoaded`) writes all five fields back to Supabase whenever they change
- **Rooms** read `guestCalendarEnabled` from the owner's profile (`production.ownerId` → `profiles.settings`) — not from context
- **Booking pages** read same from `page.owner_id` → `profiles.settings`
- This means the toggle in Settings actually reaches real guests on other devices

---

## 🗂 Key files

| File | What's there |
|---|---|
| `src/pages/RoomView.jsx` | Guest room. AvailabilityTab owns `guestEvents` (sessionStorage). GuestCalendarPanel = compact chip + Share + Disconnect (no free-days list). Threads `guestEvents` into AvailabilityCalendar. |
| `src/pages/BookingPageView.jsx` | Booking page. Owns `guestEvents` (sessionStorage). TimeSlotPicker dims guest-busy slots (`• busy` chip). MonthCalendar gets green dots on free days. |
| `src/components/ui/GoogleOAuthGuide.jsx` | Shared animated OAuth guide modal — reused in Room + Booking. |
| `src/components/availability/AvailabilityCalendar.jsx` | DayInspectorPanel; threads `guestEvents` to all three views. |
| `src/components/availability/WeeklyView.jsx` | Slot×day grid; owner overlap badges; **guest-busy cells dimmed `opacity-30`**. |
| `src/components/availability/DailyView.jsx` | Slot cards; owner avatar chips; **guest-busy cards dimmed + `you're busy` chip**. |
| `src/components/availability/MonthlyView.jsx` | Day-cell overlap badges; **green dot next to date if guest has free time that day**. |
| `src/contexts/AppContext.jsx` | `fetchPlan()` restores settings from `profiles.settings`. Sync effect writes back on change. `guestCalendarEnabled` defaults to `true`. |
| `src/pages/CalendarSettings.jsx` | Settings page: Google OAuth, business hours, timezone selector, theme, branding, guestCalendarEnabled toggle. |
| `src/App.jsx` | Auth gate (`AuthGate`); `LoadingScreen` uses `<PageLoader />`. |
| `tailwind.config.js` + `src/index.css` | Design tokens + light mode overrides + OAuth guide keyframes |
| `supabase/functions/notify-date-request/index.ts` | Email v13 — renders slot chips per date when slot_map present |
| `supabase/functions/notify-shared-availability/index.ts` | v1 live — owner email when guest shares calendar |

---

## 🏗 Infrastructure

- Vercel: auto-deploys on push to `master`
- Supabase project ID: `xwuekcysigkujhyucugi`
- Google OAuth: works but unverified. UI copy explains the warning screen. Animated guide bridges the gap until verified.
- Resend: requires `RESEND_API_KEY` in Supabase Edge Function Secrets.
- **Supabase `profiles` table columns**: `id`, `plan`, `logo_url`, `logo_is_dark`, `connected_calendars`, `google_refresh_token`, `settings` (jsonb, added 2026-04-19)

---

## 💡 How Daniel works

- Ships fast, iterates on real feedback
- Wants the app to feel like the booking page's aesthetic everywhere
- Values honesty about tradeoffs and vision-alignment
- "When you see a good move, look for a better one" — don't ship the first acceptable solution
- Appreciates tight strategic responses for exploratory questions (2–4 sentences + recommendation + tradeoff)
- Framing phrase: "effortless, useful, and gorgeous"
- Responds well to momentum — keep the energy up

---

**When you're ready to continue, start by pulling, then check the backlog.**

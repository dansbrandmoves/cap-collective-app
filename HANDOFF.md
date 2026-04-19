# Coordie — Continuation Handoff

**Last session ended:** 2026-04-19 (afternoon)
**Last commit on `master` (pushed):** `4b88da4` — "Slot-level date requests: picker Send button + owner slot heatmap"
**Live at:** https://www.coordie.com (Vercel auto-deploys on push)

---

## 🚦 First actions in this new thread

1. **Pull latest:**
   ```bash
   git pull origin master
   ```
2. **Read the vision doc before anything else** — it's the north star every decision must pass through:
   - `C:\Users\danie\.claude\projects\C--Users-danie-Dropbox-Creative-Cloud-Files-Client-Fulfillment-MM-vibe-coding-cap-collective-app\memory\project_coordie_vision.md`
3. **Skim `CLAUDE.md` at project root** — architecture, conventions, and the Dropbox git-index workaround you'll need.

---

## ✅ Shipped this session

| SHA | Summary |
|---|---|
| `fcddc32` | Guests now see owner's real availability in rooms (fetch from Supabase). |
| `9cdf01a` | Emails: white bg + dark-mode media query; room date requests notify owner; weekly-view overlap badges. |
| `000c096` | Daily view visible to guests only when room uses slot-level selection. |
| `6418114` | New `notify-shared-availability` edge function; fires when a guest shares their calendar. |
| `4b88da4` | Slot-level date requests: Send button inside slot picker; `slot_map` JSONB plumbing; DayInspectorPanel slot heatmap. |

**Edge functions live:**
- `notify-booking` v10 (white bg + dark mode)
- `notify-date-request` v12 (admin email lookup via `ownerId`)
- `notify-shared-availability` v1

**Migrations applied:**
- `date_requests.slot_map JSONB` — nullable; null means "available all day" (back-compat).

---

## 📋 Backlog (priority order)

1. **Verify the new slot-request flow end-to-end in a real room.** Toggle a room to `guestSlotSelection`, as a guest select a date → slots → Send. Confirm the owner's inbox shows slot chips and DayInspectorPanel renders the "By time slot" heatmap with counts.
2. **Inbox UI for slot_map** — the Inbox list currently just shows dates. It should surface selected slots per date when `slot_map` exists. (Not scoped this session.)
3. **`notify-date-request` email — show slot_map** — email body only shows dates. If `slot_map` is present, it should render slot chips per date.
4. **RESEND_API_KEY check** — Daniel reported bookings send no email at some point. Edge functions silently no-op if the key isn't set. Confirm it's still configured in Supabase → Edge Function Secrets.
5. **Google OAuth verification** (parallel track, ~2 hrs of Daniel's time):
   - Verify `coordie.com` via Google Search Console
   - Fill OAuth consent screen (sensitive `calendar.readonly` scope only)
   - Record a 60s demo of the guest-calendar-connect flow
   - Submit; 2–4 wk wait
6. **Guest view privacy pass** — overlap counts show for guests but names should NOT. MonthlyView/WeeklyView tooltip `title` attributes were made owner-conditional in `9cdf01a`; double-check nothing else leaks names.
7. **Real-time subscription on `shared_availability`** in RoomView — currently only `date_requests` live-updates.
8. **DayInspectorPanel polish** for 10+ guests — may need scroll divider or a "show more" collapse.
9. **Inbox page** still reachable at `/inbox`. Kept functional but demoted from main nav; consider removing on a future pass.

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

If you forget `git read-tree HEAD`, the commit wipes every file not explicitly added. Recovery pattern is in `CLAUDE.md`.

### Preview server

- `preview_start` with name `cap-collective` (config in `.claude/launch.json`, port 5173)
- Vite dep cache is pinned to `os.tmpdir()/vite-cap-collective` via `vite.config.js` to avoid Dropbox EBUSY. Don't revert.
- If the preview renders empty on first load, it's the EBUSY dep rebuild — move `node_modules/.vite` aside and restart.
- **Parser gotcha:** Babel in this project doesn't parse optional-catch-binding (`catch { }`) — use `catch (e) { }`.

### Design tokens

- Motion: `ease-ios` = `cubic-bezier(0.32, 0.72, 0, 1)`
- Shadows: `shadow-lift`, `shadow-sheet`
- Tap targets: `min-h-touch` / `min-w-touch` = 44px
- Accent: purple `#8b5cf6` (NOT amber — CLAUDE.md is outdated on this)
- Ambient background: `.ambient-glow` CSS utility

### Component conventions

- Cards: `bg-surface-900 border border-white/[0.06] rounded-2xl p-5 sm:p-6 hover:border-white/10 hover:shadow-lift transition-all duration-200 ease-ios`
- Never use `border-surface-700` — too harsh. Use `border-white/[0.06]` or `border-white/10`.
- Page wrapper: `px-5 sm:px-8 lg:px-14 py-8 sm:py-12`
- H1: `text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15]`
- Loading: `<PageLoader />` — never "Loading..." text

### Email (edge functions)

- Outer white bg (NOT grey) + `@media (prefers-color-scheme: dark)` overrides
- Always include `<meta name="format-detection" content="telephone=no,date=no,...">` to stop iOS/Gmail auto-linkifying dates
- Purple CTA (`#8b5cf6`)
- Brand header: `coordie` wordmark + purple dot + status label
- Deploy via MCP `mcp__0d08157b-...__deploy_edge_function`

---

## 🗂 Key files

| File | What's there |
|---|---|
| `src/pages/BookingPageView.jsx` | Public booking page |
| `src/pages/RoomView.jsx` | Guest-facing room. Fetches owner calendar data; fires `notify-shared-availability` when a guest shares. Threads `ownerId` through to AvailabilityTab + GuestCalendarPanel. |
| `src/components/availability/AvailabilityCalendar.jsx` | DayInspectorPanel (owner tap-a-day) **with slot heatmap**; slot picker side panel with Send Request footer; threads `selectedSlotMap` into DateRequestModal. |
| `src/components/availability/DateRequestModal.jsx` | Guest submit form — forwards `slotMap` in onSubmit payload. |
| `src/components/availability/MonthlyView.jsx` | Day-cell overlap count badges; tooltip owner-gated. |
| `src/components/availability/WeeklyView.jsx` | Overlap badges in day headers (same pattern as MonthlyView). |
| `src/contexts/AppContext.jsx` | `createDateRequest` accepts `slotMap` and `ownerId`; inserts `slot_map` JSONB; invokes `notify-date-request` with `ownerId` for admin email lookup. |
| `src/components/ui/NotificationsDropdown.jsx` | Bell with unified message/booking entries |
| `src/components/layout/Sidebar.jsx` | Projects → Booking → Availability → Settings |
| `supabase/functions/notify-booking/index.ts` | Email template (v10 live) |
| `supabase/functions/notify-date-request/index.ts` | Email (v12 live) — admin email lookup via `ownerId` |
| `supabase/functions/notify-shared-availability/index.ts` | NEW — v1 live; sends owner a branded email when a guest shares their calendar. |
| `tailwind.config.js` + `src/index.css` | Design tokens |
| `vite.config.js` | Dropbox cacheDir workaround |

---

## 🏗 Infrastructure

- Vercel: auto-deploys on push to `master`
- Supabase project ID: `xwuekcysigkujhyucugi`
- Google OAuth: works but unverified. UI copy explains the warning screen.
- Resend: requires `RESEND_API_KEY` in Supabase Edge Function Secrets. Without it, functions return `success: true` but send nothing.

---

## 💡 How Daniel works

- Ships fast, iterates on real feedback
- Wants the app to feel like the booking page's aesthetic everywhere
- Values honesty about tradeoffs and vision-alignment
- "When you see a good move, look for a better one" — don't ship the first acceptable solution
- Occasional explicit trust signals ("I trust you") — use the latitude responsibly
- Appreciates tight strategic responses for exploratory questions (2–4 sentences + recommendation + tradeoff)
- Framing phrase he uses when handing over scope: "effortless, useful, and gorgeous"

---

**When you're ready to continue, start by pulling, then check the backlog.**

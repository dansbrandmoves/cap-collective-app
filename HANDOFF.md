# Coordie — Continuation Handoff

**Last session ended:** 2026-04-19
**Last commit on `master` (pushed):** `0f2cfb6` — "Calendar: always pad to 6 rows (42 cells)"
**Live at:** https://www.coordie.com (Vercel auto-deploys on push)

---

## 🚦 First actions in this new thread

1. **Pull latest — work has been pushed since the last context you see:**
   ```bash
   git pull origin master
   ```
2. **Read the vision doc before anything else** — it's the north star every decision must pass through:
   - `C:\Users\danie\.claude\projects\C--Users-danie-Dropbox-Creative-Cloud-Files-Client-Fulfillment-MM-vibe-coding-cap-collective-app\memory\project_coordie_vision.md`
3. **Skim `CLAUDE.md` at project root** — architecture, conventions, and the Dropbox git-index workaround you'll need.

---

## 🐛 The first thing to fix

**On the booking page desktop view, clicking "Change time" in the confirm step breaks the layout.** This was reported right before the previous session ended — I was about to reproduce it but the thread hit context limits.

**Repro:**
1. Open `/book/30-minutes-DnzQ` at 1920×1000 viewport (or any desktop)
2. Click an available date (e.g. the 23rd)
3. Click a time slot (e.g. 12:00 PM)
4. Confirm form appears on the right
5. Click **"Change time"** in the confirm header
6. Observe what breaks

**Where to look:** `src/pages/BookingPageView.jsx` — the desktop render block around the `<AnimatePresence mode="wait">` inside the slot column. The handler is literally just `() => setSelectedSlot(null)` which should transition `step` from `'confirm'` → `'time'` (since `step = selectedSlot ? 'confirm' : selectedDate ? 'time' : 'date'`).

**Suspects:**
- Motion `key` collision across `<motion.div>` children causing stuck exit animation
- AnimatePresence `mode="wait"` blocking on stale state
- Slot column's fixed width clashing with a re-render
- ConfirmForm form state leaking into the remounted step

Verify in preview (`preview_start` with name `cap-collective`, preset 1920×1000, navigate, click, observe). Don't trust theories — reproduce first.

---

## 🎯 The vision (tl;dr — full doc in memory)

Coordie is the **thin, fast, invisible layer between your calendar and everyone else.** Not PM, not CRM, not AI.

- Rooms surface **overlap** automatically; owner confirms a day; done
- **Lists-of-requests is what Coordie defeats** — they feel like email back-and-forth, the exact loop we kill
- The calendar is the primary surface; Inbox is demoted to a fallback
- Bookings notify loudly (email + bell); shares notify gently
- Small business founders on Google Calendar, one person or small team

When in doubt: **remove the feature. Coordie wins by being invisible, not by having more.**

---

## 📦 What shipped today (most recent first)

| SHA | Summary |
|---|---|
| `0f2cfb6` | Calendar always 42 cells (6 rows) — no height jump between months |
| `7ff3edd` | Booking page: stable calendar + killed double scroll |
| `e4b6a79` | Desktop booking: calendar is the hero (560px), `items-start` kills vertical bounce |
| `a8a828c` | Capped inner container so slots don't drift to viewport edge |
| `04577ed` | Mobile purple accent line flush-left |
| `b5a852c` | Per-guest attendee toggles on Schedule-in-GCal (default-on for everyone with email) |
| `b0f8ef4` | Tap-a-day scheduling panel + bell-with-bookings + nav reorder + OAuth trust line + PageLoader |
| `dd7d731` | Aesthetic sweep — RoomView + ProductionView + date-request email |
| `4a94bed` | Admin page headings unified (tracking-tight, zinc-50, bigger) |
| `63ac09e` | Booking email redesign (purple CTA, format-detection, dark-mode adaptive) |
| `ff38d96` | Full-bleed booking page + mobile polish pass (the original flagship) |

---

## 📋 Backlog (priority order)

1. **Change-time bug** (above) — highest priority, user-blocking
2. **RESEND_API_KEY check** — user reported bookings send no email. `notify-booking` silently no-ops if the key isn't set in Supabase → Edge Function Secrets. Confirm it's configured.
3. **Google OAuth verification** — parallel track, ~2 hrs of user time:
   - Verify `coordie.com` domain via Google Search Console
   - Fill out OAuth consent screen (sensitive `calendar.readonly` scope only — no security assessment needed)
   - Record 60-second demo video of the guest-calendar-connect flow
   - Submit; wait 2–4 weeks
4. **Guest view of room calendar** — verify the overlap count badges show for guests but names do NOT (vision: "no details shared"). Check MonthlyView tooltip (`title` attr currently includes names) — may need to gate on `isOwner`.
5. **Mobile tap-a-day panel** — the DayInspectorPanel only renders when `isOwner && !!groupId`. Confirm it works from a room on mobile, check bottom-sheet feel.
6. **DayInspectorPanel polish** for 10+ guests — may need scroll divider or collapse
7. **Real-time subscription on `shared_availability` in RoomView** — currently only `date_requests` live-updates. Shared availability appearing should refresh the calendar.
8. **Inbox page** still reachable at `/inbox` (via bell footer "View shared availability"). Kept it functional but demoted; consider if it should be removed entirely on a future pass.

---

## 🔧 Working rules for this repo

### Committing (Dropbox + temp-index workaround)

The `.git/index` lock gets stuck because Dropbox holds files. Don't use plain `git add`. Use a temp index every time:

```bash
GIT_INDEX_FILE=.git/index_tmp git read-tree HEAD   # CRITICAL — start from HEAD or you'll wipe the tree
GIT_INDEX_FILE=.git/index_tmp git add <files>      # stage specific files, NEVER `git add -A`
GIT_INDEX_FILE=.git/index_tmp git commit -m "..."
rm -f .git/index_tmp
git push origin master
```

If you forget `git read-tree HEAD` first, the commit will wipe every file not explicitly added. Recovery pattern is in `CLAUDE.md`.

### Preview server

- `preview_start` with name `cap-collective` (config in `.claude/launch.json`, port 5173)
- Vite dep cache is pinned to `os.tmpdir()/vite-cap-collective` via `vite.config.js` to avoid Dropbox EBUSY on dep re-optimization. Don't revert that.
- If the preview renders empty on first load with a console-quiet screen, it's the EBUSY dep rebuild — move `node_modules/.vite` aside and restart.

### Design tokens

- Motion: `ease-ios` = `cubic-bezier(0.32, 0.72, 0, 1)` (Tailwind utility)
- Shadows: `shadow-lift`, `shadow-sheet` (dark-mode-aware rings, not drop shadows)
- Tap targets: `min-h-touch` / `min-w-touch` = 44px
- Accent: purple `#8b5cf6` (not amber — CLAUDE.md is outdated on this)
- Ambient background: `.ambient-glow` CSS utility (subtle purple radial gradient)

### Component conventions

- Cards: `bg-surface-900 border border-white/[0.06] rounded-2xl p-5 sm:p-6 hover:border-white/10 hover:shadow-lift transition-all duration-200 ease-ios`
- Never use `border-surface-700` — too harsh. Use `border-white/[0.06]` or `border-white/10`.
- Page wrapper: `px-5 sm:px-8 lg:px-14 py-8 sm:py-12`
- H1: `text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15]`
- Subtitle: `text-[15px] text-zinc-400 mt-2 leading-relaxed`
- Loading: `<PageLoader />` (logo pulse) from `src/components/ui/PageLoader.jsx` — never "Loading..." text

### Email (edge functions)

- Light template with `@media (prefers-color-scheme: dark)` overrides
- Always include `<meta name="format-detection" content="telephone=no,date=no,...">` to stop iOS/Gmail auto-linkifying dates
- Purple CTA (`#8b5cf6`), not amber
- Brand header: `coordie` wordmark + purple dot + status label
- Deploy via MCP `mcp__0d08157b-...__deploy_edge_function`

---

## 🗂 Key files

| File | What's there |
|---|---|
| `src/pages/BookingPageView.jsx` | Public booking page (change-time bug is here) |
| `src/components/availability/AvailabilityCalendar.jsx` | DayInspectorPanel inlined at bottom — tap-a-day panel with Schedule-in-GCal |
| `src/components/availability/MonthlyView.jsx` | Day-cell overlap count badges, tint intensity |
| `src/pages/RoomView.jsx` | Guest-facing room. Live-subscribed to date_requests. |
| `src/pages/ProductionView.jsx` | Owner project detail — sidebar nav pattern |
| `src/pages/Inbox.jsx` | Demoted but still works. "Open room" + "Archive" actions. |
| `src/contexts/AppContext.jsx` | `recentNotifications` merges messages + bookings; realtime subs |
| `src/components/ui/NotificationsDropdown.jsx` | Bell with unified message/booking entries |
| `src/components/layout/Sidebar.jsx` | Projects → Booking → Availability → Settings (Inbox removed) |
| `src/components/ui/PageLoader.jsx` | Shared logo-pulse loading state |
| `supabase/functions/notify-booking/index.ts` | Email template (version 9 live) |
| `supabase/functions/notify-date-request/index.ts` | Sibling email (version 11 live) |
| `tailwind.config.js` + `src/index.css` | Design tokens |
| `vite.config.js` | Dropbox cacheDir workaround |

---

## 🏗 Infrastructure

- Vercel: auto-deploys on push to `master`
- Supabase project ID: `xwuekcysigkujhyucugi`
- Google OAuth: works but unverified. UI copy explains the warning (`RoomView.jsx`, `BookingPageView.jsx` guest-calendar panels).
- Resend email: requires `RESEND_API_KEY` in Supabase Edge Function Secrets. If not set, `notify-booking` returns `success: true` with a note but sends nothing.

---

## 💡 How Daniel works

- Ships fast, iterates on real feedback
- Wants the app to feel like the booking page's aesthetic everywhere
- Values honesty about tradeoffs and vision-alignment
- Says things like "when you see a good move, look for a better one" — don't ship the first acceptable solution
- Occasional explicit trust signals ("I trust you") — use the latitude responsibly
- Appreciates tight strategic responses for exploratory questions (2–4 sentences + recommendation + tradeoff)

---

**When you're ready to continue, start by pulling, then tackle the change-time bug.**

# Coordie — Continuation Handoff

**Last session ended:** 2026-04-19
**Last commit on `master` (pushed):** `5e38df5` — "Fix: preserve last slot via ref so ConfirmForm doesn't crash during exit animation"
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

## ✅ Fixed this session

| SHA | Summary |
|---|---|
| `5e38df5` | **Change-time bug** — `AnimatePresence mode="wait"` kept `ConfirmForm` alive for exit animation while `selectedSlot` was already nulled → crash. Fixed with `lastSlotRef` that only updates when slot is non-null. |
| (pending push) | **Room availability for guests** — guests saw all slots green because `calendarEvents`/`connectedCalendars` are localStorage-only. Now fetches owner's data from Supabase (`owner_calendar_events` + `profiles.connected_calendars`) and passes it to `AvailabilityCalendar` when `!isOwner`. |

---

## 📋 Backlog (priority order)

1. **RESEND_API_KEY check** — user reported bookings send no email. `notify-booking` silently no-ops if the key isn't set in Supabase → Edge Function Secrets. Confirm it's configured.
2. **Google OAuth verification** — parallel track, ~2 hrs of user time:
   - Verify `coordie.com` domain via Google Search Console
   - Fill out OAuth consent screen (sensitive `calendar.readonly` scope only — no security assessment needed)
   - Record 60-second demo video of the guest-calendar-connect flow
   - Submit; wait 2–4 weeks
3. **Guest view of room calendar** — verify overlap count badges show for guests but names do NOT (vision: "no details shared"). Check MonthlyView tooltip (`title` attr currently includes names) — may need to gate on `isOwner`.
4. **Mobile tap-a-day panel** — DayInspectorPanel only renders when `isOwner && !!groupId`. Confirm it works from a room on mobile.
5. **DayInspectorPanel polish** for 10+ guests — may need scroll divider or collapse
6. **Real-time subscription on `shared_availability` in RoomView** — currently only `date_requests` live-updates.
7. **Inbox page** still reachable at `/inbox`. Kept functional but demoted; consider removing on a future pass.

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
| `src/pages/BookingPageView.jsx` | Public booking page — change-time bug FIXED |
| `src/pages/RoomView.jsx` | Guest-facing room. Now fetches owner calendar data from Supabase for guests. |
| `src/components/availability/AvailabilityCalendar.jsx` | DayInspectorPanel inlined at bottom — tap-a-day panel with Schedule-in-GCal |
| `src/components/availability/MonthlyView.jsx` | Day-cell overlap count badges, tint intensity |
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

**When you're ready to continue, start by pulling, then check the backlog.**

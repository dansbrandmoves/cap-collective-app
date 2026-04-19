# Coordie — Continuation Handoff

**Last session ended:** 2026-04-19 (evening)
**Last commit on `master` (pushed):** `c540597` — "Daily view: direct slot toggle for guests + owner per-slot guest chips"
**Branch with pending work:** `claude/handoff-files-preserve-work-HXVRU` — email redesign, NOT yet merged to master
**Live at:** https://www.coordie.com (Vercel auto-deploys on push to `master`)

---

## ⚠️ Pending before next session starts

1. **Merge branch → master** (or cherry-pick): `claude/handoff-files-preserve-work-HXVRU` has the email redesign commits (`4a73af8`, `58f4d8d`)
2. **Deploy 2 edge functions from desktop** (Supabase MCP tool):
   - `notify-booking`
   - `notify-date-request`

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

## ✅ Shipped this session (web — pending merge + deploy)

| SHA | Summary |
|---|---|
| `4a73af8` | Emails: remove grey panels → purple tint event card + purple left-border quotes; adapts to light/dark |

---

## ✅ Shipped previous session (desktop — on master)

| SHA | Summary |
|---|---|
| `1290ebb` | Weekly view: per-slot heatmap for owner (desktop count badges) + direct guest cell toggle (no slide-over on desktop) |
| `57d05ab` | Toggle fixes dark/light mode (`bg-[#f0f0f0]` → `bg-surface-600` + `shadow-sm` knobs); LoadingScreen → Coordie logo |
| `607cb5c` | Timezone selector in Settings (defaults Eastern Time; curated list of ~25 IANA zones) |
| `f27b59c` | Daily view: per-slot guest avatar chips inline in each slot card; removed disconnected bottom lists |
| `2f19ddb` | Weekly mobile: subtle purple dot per cell instead of count badge; normalized column header height |
| `4524d33` | Mobile dot + desktop count badge split; fixed-height badge row so date number never gets smooshed |
| `b471aa4` | Weekly: day header count always shows regardless of slot_map presence (bug fix) |
| `c540597` | Daily view: direct slot toggle for guests + owner per-slot guest chips (parity with weekly) |

---

## 📋 Backlog (priority order)

1. **Verify slot-request flow E2E in a real room** — toggle `guestSlotSelection`, guest selects date → slots → Send. Confirm owner inbox shows slot chips and DayInspectorPanel renders the "By time slot" heatmap.
2. **Inbox UI for slot_map** — Inbox list currently shows dates only. Should surface selected slots per date when `slot_map` exists.
3. **`notify-date-request` email — show slot_map** — email body only shows dates. If `slot_map` present, render slot chips per date.
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

## 🔧 Working rules for this repo

### Committing (Dropbox + temp-index workaround)

Plain `git add` fails because Dropbox holds `.git/index`. Use a temp index every time:

```bash
GIT_INDEX_FILE=.git/index_tmp git read-tree HEAD   # CRITICAL — start from HEAD or you'll wipe the tree
GIT_INDEX_FILE=.git/index_tmp git add <files>      # stage specific files, NEVER `git add -A`
GIT_INDEX_FILE=.git/index_tmp git commit -m "..."
rm -f .git/index_tmp
git push -u origin <branch>
```

**After every commit — reset the main index** (prevents stop-hook false positives):

```bash
GIT_INDEX_FILE=.git/index_tmp git read-tree HEAD && cp .git/index_tmp .git/index && rm -f .git/index_tmp
```

The stop hook (`~/.claude/stop-hook-git-check.sh`) checks the main index. The temp-index commit workflow bypasses it, leaving the main index stale. The reset above syncs it to HEAD so the hook sees a clean state.

### Keeping HANDOFF current

Update `HANDOFF.md` at the end of every session (or whenever a meaningful chunk of work lands):

1. Add shipped commits to the "Shipped this session" table
2. Update "Pending before next session" with anything that needs to happen before work resumes (merges, deploys, etc.)
3. Remove backlog items that are done
4. Commit and push HANDOFF as the very last commit of the session, then run the index reset above

### Preview server

- `preview_start` with name `cap-collective` (config in `.claude/launch.json`, port 5173)
- Vite dep cache is pinned to `os.tmpdir()/vite-cap-collective` via `vite.config.js` to avoid Dropbox EBUSY.
- App now uses real Supabase auth — can't navigate owner routes in preview without credentials.
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

---

## 🗂 Key files

| File | What's there |
|---|---|
| `src/pages/RoomView.jsx` | Guest-facing room. Fetches owner calendar data; fires `notify-shared-availability` when guest shares. |
| `src/components/availability/AvailabilityCalendar.jsx` | DayInspectorPanel (owner tap-a-day); slot picker slide-over (mobile/monthly); threads selection state to all three views. |
| `src/components/availability/WeeklyView.jsx` | Slot grid: owner per-slot count badges (desktop) / dots (mobile); guest direct cell toggle. |
| `src/components/availability/DailyView.jsx` | Slot cards: owner avatar chips per slot; guest toggleable cards with checkmark. |
| `src/components/availability/MonthlyView.jsx` | Day-cell overlap count badges; tooltip owner-gated. |
| `src/contexts/AppContext.jsx` | `createDateRequest` accepts `slotMap` + `ownerId`; `timezone` stored (default ET); all settings persisted to localStorage. |
| `src/pages/CalendarSettings.jsx` | Settings page: Google OAuth, business hours, timezone selector, theme, branding. |
| `src/App.jsx` | Auth gate (`AuthGate`); `LoadingScreen` uses `<PageLoader />`. |
| `tailwind.config.js` + `src/index.css` | Design tokens + light mode overrides |
| `supabase/functions/notify-date-request/index.ts` | Email v12 — admin email lookup via `ownerId` |
| `supabase/functions/notify-shared-availability/index.ts` | v1 live — owner email when guest shares calendar |

---

## 🏗 Infrastructure

- Vercel: auto-deploys on push to `master`
- Supabase project ID: `xwuekcysigkujhyucugi`
- Google OAuth: works but unverified. UI copy explains the warning screen.
- Resend: requires `RESEND_API_KEY` in Supabase Edge Function Secrets.

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

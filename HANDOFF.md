# Coordie — Continuation Handoff

**Last session ended:** 2026-04-20 (big day)
**Last pushed commit:** `48cd6fe` — "Weekly view calmed; DayInspectorPanel can invite non-responders"
**Live at:** https://www.coordie.com (Vercel auto-deploys on push)
**Google OAuth verification:** submitted, awaiting review (2–4 weeks typical)

---

## 🚦 Start here in a new thread

1. `git pull origin master`
2. Read vision: `C:\Users\danie\.claude\projects\C--Users-danie-Dropbox-Creative-Cloud-Files-Client-Fulfillment-MM-vibe-coding-cap-collective-app\memory\project_coordie_vision.md`
3. Skim `CLAUDE.md` at project root

---

## ✅ Shipped this session

| SHA | Summary |
|---|---|
| `831f34e` | **Groups → Rooms rename**: DB migration (`groups`→`rooms`, `group_members`→`room_members`, `group_id`→`room_id`), AppContext + all consumer files updated |
| `dd3844f` | **ProductionView redesign**: room-name header, prominent "Share room" button, gear icon removed, availability settings subsumed into Project Settings modal, rename-via-modal, auto-select + auto-create first room |
| `da34a88` | **Google Calendar resilience**: edge function only wipes refresh_token on `invalid_grant` (permanent); transient errors (5xx/network/invalid_client) keep the token so next call retries. Settings UI shows amber "Connection expired — reconnect" when calendars exist but refresh token is missing |
| `0fe96d2` | **Admin dashboard** at `/admin`: role-gated, user list with stats + search, inline Free/Pro and User/Admin toggles. `profiles.role` column (daniel@brandmoves.co bootstrapped as admin). Security-definer RPCs (`admin_list_users`, `admin_update_user`) handle authorization server-side |
| `20b0195` | **Stripe subscriptions (webhook-less)**: four edge functions — `create-checkout-session`, `verify-checkout-session`, `create-portal-session`, `sync-subscription-status`. Checkout verifies on return via `?session_id`; billing page re-syncs from Stripe on every mount (catches cancels without webhooks). "Manage in Stripe" opens Customer Portal. All deployed with `verify_jwt: false` + in-code `getUser()` check |
| `770e008` | **Calmer calendar**: number badges → dots on MonthlyView day cells, custom hover cards (desktop) with requester names, "N pending" chip is now a button → opens `PendingRequestsModal` with per-requester visibility filter and inline Approve/Decline/Archive (no trip to Inbox). Hoisted requester filter state so dots update live |
| `761560a` | DayInspectorPanel restored on day click in RoomCalendarPanel (was regressing to Daily view) — "help me decide" flow back |
| `48cd6fe` | Weekly view parity: day headers + slot cells converted to dots with hover cards. DayInspectorPanel's meeting creation now has **"Also invite" section** listing room members who haven't responded — useful when this is the most convenient day regardless. GCal event description differentiates "Confirmed free" vs "Also invited" |

---

## 🧠 Current mental model

- **Production → Rooms** (renamed from Groups). Each production auto-creates one default room on create.
- **ProductionView**: sidebar = project mgmt (rooms list + "+ New Room" + Edit/Delete + Private Notes). Main area = selected room's calendar with room-name header, pending count chip (→ modal), and "Share room" button (→ share modal w/ Preview-as-guest link).
- **Share modal** is the single place for access mode, link copy, invites, pending count → Inbox, preview link.
- **Project Settings modal** (renamed from Edit Project): basic info + availability config (mode/hours/slot selection) — replaces the old gear icon.
- **Pending requests modal** (from the chip): grouped by requester with per-person show/hide toggle (filters calendar dots live) + Approve/Decline/Archive inline.
- **DayInspectorPanel** (click any day with requests): free-people list + "Also invite" non-responders + By-time-slot heatmap + "Schedule in Google Calendar" action.
- **Roles vs Plans**: `profiles.role` (`user | admin`) is separate from `profiles.plan` (`free | pro`). Stripe only touches `plan`; admin status stays safe.

---

## 📋 Backlog (priority order)

1. **Homepage marketing copy still says "groups"** in a couple places in `src/pages/HomePage.jsx` — small copy sweep.
2. **Verify slot-request flow E2E** in a real room — toggle `guestSlotSelection` in Project Settings, guest picks date→slots→Send. Confirm owner inbox shows slot chips and DayInspectorPanel renders "By time slot" heatmap.
3. **Inbox UI for `slot_map`** — inbox list still shows dates only; should surface selected slots per date when `slot_map` present.
4. **RESEND_API_KEY check** in Supabase → Edge Function Secrets (edge functions no-op silently if missing).
5. **Google OAuth verification** — submitted 2026-04-20. Check Cloud Console → OAuth consent screen → Verification center for status. Respond promptly if Google asks follow-ups.
6. **Stripe hosted checkout branding** — Stripe Dashboard → Settings → Branding (logo, colors) makes the checkout page match Coordie's aesthetic. 5-min task.
7. **Guest view privacy pass** — overlap counts show for guests but names should NOT. Double-check Monthly/Weekly tooltip `title` + hover card `isOwner` gating (already mostly handled, verify).
8. **Real-time subscription on `shared_availability`** in RoomView — only `date_requests` live-updates currently.
9. **Phase 2 room overlap: multi-person filter** — chip row at top of AvailabilityTab. Note: `shared_availability` is read but no longer written to (Share-with-team dropped).
10. **Timezone actually used** — stored in context, but slot times + email timestamps don't use it yet.
11. **Stripe webhooks** (when ready to harden) — current flow is webhook-less and catches cancellations on next `/billing` visit. Webhooks would catch them in real-time. Secret: `STRIPE_WEBHOOK_SECRET` → add to Supabase. Stub `stripe-webhook` edge function exists.
12. **Dead-code finding:** `supabase/functions/notify-shared-availability/index.ts:162` still queries the old `groups` table. Function is no longer called from client (Share-with-team dropped); would 500 if invoked. Safe to fix next time you touch edge functions.

---

## 🧭 Design decisions worth remembering

- **Webhook-less Stripe** (for now): simpler — verify on return via `?session_id={CHECKOUT_SESSION_ID}`, re-sync on every `/billing` mount. Tradeoff: cancellations only catch up when user revisits billing. Easy to add webhooks later without refactoring.
- **Google refresh tokens wiped only on `invalid_grant`**: transient errors (network, 5xx, rate limits, `invalid_client`) keep the token for next retry instead of forcing reconnect on every blip.
- **Calm calendar indicators**: numbers on day cells caused number-on-number parsing. Dots remove the noise; count lives in the header chip. Hover cards give full info on demand.
- **Admin role is separate from billing plan**: a customer can be both admin and pro. Stripe webhook only touches `plan`.

---

## 🔧 Working rules for this repo

### Committing (Dropbox + temp-index workaround)

Plain `git add` fails because Dropbox holds `.git/index`. Use a temp index every time:

```bash
GIT_INDEX_FILE=.git/index_tmp git read-tree HEAD   # CRITICAL — start from HEAD or you wipe the tree
GIT_INDEX_FILE=.git/index_tmp git add <files>      # stage specific files, NEVER `git add -A`
GIT_INDEX_FILE=.git/index_tmp git commit -m "..."
rm -f .git/index_tmp
git push origin master
```

### Preview server

- `preview_start` with name `cap-collective` (port 5173, config in `.claude/launch.json`)
- Vite dep cache pinned to `os.tmpdir()/vite-cap-collective` to avoid Dropbox EBUSY (see `vite.config.js`)
- App uses real Supabase auth — can't navigate owner routes in preview without credentials. Homepage renders fine.
- **Babel parser gotcha:** doesn't parse optional-catch-binding — use `catch (e) { }`.

### Design tokens

- Motion: `ease-ios` = `cubic-bezier(0.32, 0.72, 0, 1)`
- Shadows: `shadow-lift`, `shadow-sheet`
- Tap targets: `min-h-touch` / `min-w-touch` = 44px
- Accent: purple `#8b5cf6`
- Never `border-surface-700` (too harsh) — use `border-white/[0.06]` or `border-white/10`
- Cards: `bg-surface-900 border border-white/[0.06] rounded-2xl p-5 sm:p-6 hover:border-white/10 hover:shadow-lift transition-all duration-200 ease-ios`
- Page wrapper: `px-5 sm:px-8 lg:px-14 py-8 sm:py-12`
- H1: `text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15]`
- Loading: `<PageLoader />` — never "Loading..." text
- Toggles: off=`bg-surface-600`, on=`bg-accent`, knob=`bg-white shadow-sm`

### Settings persistence

- `profiles.settings` JSONB stores cross-device owner settings: `guestCalendarEnabled`, `timezone`, `theme`, `slotStateCustomizations`, `prefixRules`
- `AppContext.fetchPlan()` reads on login — Supabase wins over localStorage on conflict
- Rooms read `guestCalendarEnabled` from owner's profile, not context

### Edge function deploys

- Deploy via MCP `mcp__0d08157b-...__deploy_edge_function`
- Most functions use `verify_jwt: false` + in-code `supabase.auth.getUser()` — Supabase gateway's JWT check is too strict and returns 401 before our code runs
- **Notes:** `notify-date-request` still expects `groupName`/`groupId` field names; `createDateRequest` in AppContext passes them for backward compat

---

## 🗂 Key files

| File | What's there |
|---|---|
| `src/pages/HomePage.jsx` | Marketing at `/`. Phase-driven booking-flow demo |
| `src/App.jsx` | Routes: `/`, `/signin`, `/project/:id`, `/room/:token`, `/inbox`, `/booking/:slug`, `/admin`, `/billing`, etc. |
| `src/pages/ProductionView.jsx` | Sidebar = rooms + project mgmt; main = selected room's calendar. Contains: `ProductionView`, `RoomCalendarPanel`, `ShareModal`, `RenameRoomModal`, `EditProjectModal`, `PendingRequestsModal`, `EmptyState` |
| `src/pages/RoomView.jsx` | Guest-facing room (`/room/:token`). Notes + Availability tabs |
| `src/pages/BookingPageView.jsx` | Booking page with guest calendar overlay, slot picker |
| `src/pages/AdminDashboard.jsx` | Role-gated `/admin`. User list with inline plan/role pill toggles |
| `src/pages/BillingPage.jsx` | Upgrade flow (Stripe Checkout), verify-on-return, sync-on-mount, Manage-in-Stripe portal button |
| `src/components/availability/AvailabilityCalendar.jsx` | Monthly/Weekly/Daily + `DayInspectorPanel` (responded list + "Also invite" non-responders + By-time-slot heatmap + GCal scheduling) |
| `src/components/availability/MonthlyView.jsx` | Day grid with dot indicators + custom hover cards |
| `src/components/availability/WeeklyView.jsx` | Slot×day grid with dot indicators + hover cards on headers AND slot cells |
| `src/contexts/AppContext.jsx` | State, Supabase sync. Room CRUD, date requests, notifications, plan/role, `isAdmin` |
| `src/pages/CalendarSettings.jsx` | Google OAuth (with amber "Connection expired" state for stale connections), business hours, timezone, theme, branding, `guestCalendarEnabled` |
| `src/components/layout/Sidebar.jsx` | Nav (Projects, Booking, Availability, Settings) + admin-only "Admin" link + Upgrade/Billing |

---

## 🏗 Infrastructure

- **Vercel**: auto-deploys on push to `master`
- **Supabase project ID**: `xwuekcysigkujhyucugi`
- **Tables**: `productions`, `rooms`, `room_members`, `shared_notes`, `messages`, `date_requests`, `shared_availability`, `profiles`, `booking_pages`, `bookings`, `owner_calendar_events`
- **`profiles` columns**: `id, plan, role, stripe_customer_id, stripe_subscription_id, logo_url, logo_is_dark, connected_calendars, google_refresh_token, google_access_token, google_token_expires_at, settings (jsonb), created_at, updated_at`
- **Security-definer RPCs**: `admin_list_users()`, `admin_update_user(target_id, new_plan, new_role)` — both check `auth.uid()` is admin inside the function

### Edge functions deployed

| Function | Purpose | verify_jwt |
|---|---|---|
| `google-calendar-auth` | OAuth exchange/refresh/disconnect with resilient error handling | false |
| `create-checkout-session` | Stripe Checkout session for subscription | false |
| `verify-checkout-session` | Verify session on return, flip to pro | false |
| `create-portal-session` | Stripe Customer Portal URL | false |
| `sync-subscription-status` | Called on `/billing` mount to reconcile from Stripe | false |
| `notify-booking` | Email owner when someone books | true |
| `notify-date-request` | Email owner when guest sends date request (expects legacy `groupName`/`groupId` fields) | true |
| `send-welcome-email` | (deployed but disabled in client) | true |
| `stripe-webhook` | Stub for future webhook wiring | false |
| `notify-shared-availability` | Legacy — no longer called from client | false |

### Secrets (Supabase Edge Function Secrets)

- `STRIPE_SECRET_KEY` ✅
- `STRIPE_PRICE_ID` ✅
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ✅
- `RESEND_API_KEY` — check if set; edge functions silently no-op if missing
- `STRIPE_WEBHOOK_SECRET` — not set (webhook-less flow for now)

### Known user states (for debugging)

From `profiles`:
- `daniel@brandmoves.co` = admin, pro plan after successful test checkout, 2 calendars + refresh token
- `daniel.furfaro@gmail.com` = user, free plan, 2 calendars but **no refresh token** (will see "Reconnect" amber state in settings — expected)
- `daniel.furfato@gmail.com` = user, free plan, no calendars
- `cawleyconsulting@gmail.com` = user, free plan

---

## 💡 How Daniel works

- Ships fast, iterates on real feedback
- Values honesty about tradeoffs + vision alignment
- "When you see a good move, look for a better one"
- Prefers tight strategic responses for exploratory questions (2–4 sentences + recommendation + tradeoff)
- Framing: "effortless, useful, and gorgeous"
- Responds well to momentum — keep the energy up
- Prefers data model to match UX (groups→rooms was driven by this, not cosmetic)

---

**When ready: pull, check backlog item #1 (homepage copy) or ask Daniel what's next.**

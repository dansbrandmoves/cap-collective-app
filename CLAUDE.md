# Cap Collective App — Claude Orientation

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
- **State:** React Context (AppContext) + localStorage — no Zustand, no backend
- **Auth:** localStorage `isOwner` flag — no real auth in prototype
- **Deployment:** Vercel — `vercel.json` rewrite rule already in place
- **Notes:** Simple `<textarea>` — no rich text editor

---

## Current Build State (as of April 1, 2026)

### Fully working
- Dashboard — production cards, unread badges, date countdown, create production modal
- Production View — group tabs, private notes section, message preview, copy room link
- Room — Notes tab (auto-saves to localStorage), Chat tab (threaded, owner/guest bubbles), Availability tab (full calendar)
- Availability Rules page — slot editor (create/edit/delete), full calendar preview, production overrides
- Calendar Settings page — real Google Calendar OAuth (client-side), role assignment modal, manual sync, disconnect
- Owner/Guest mode toggle (bottom of sidebar) — switches the full app between views
- Shareable Room links — `/room/:productionId/:groupId` renders guest view with no owner chrome
- **Three calendar views** — Monthly (color-coded slot bars per day), Weekly (slot rows × 7 days), Daily (slot cards with driving event detail + private notes for owner)
- **Slot system** — owner can create/edit/delete named time slots (name, time range, color, default state)
- **Derivation logic** — `*` veto > `^` soft hold > governing calendar > available. All-day end-date correction applied.
- **Google Calendar OAuth** — client-side via Google Identity Services. Token stored in localStorage. Fetches calendar list + events from governing calendars on sync.

### Intentionally stubbed (not broken)
- Google Calendar OAuth requires `VITE_GOOGLE_CLIENT_ID` in `.env` — configured with real key, works in dev. Vercel needs env var added in dashboard.
- No email invite flow for group members yet
- Availability rule *creation* UI not built (rules exist in seed data, viewable but not editable)

### Not built yet
- Real auth (owner login with PIN or password)
- Multi-user real-time sync
- Mobile layout

---

## Architecture Decisions (don't second-guess without reason)

- **AppContext + localStorage over Zustand:** kept dependencies minimal for prototype. One context, auto-syncs on every state change. Storage key: `cap-collective-app`.
- **`isOwner: true` defaults on first load:** makes the demo work immediately without a login screen. Intentional for prototype.
- **Tailwind v3 not v4:** v4 uses CSS-based config (no `tailwind.config.js`), has rough Vite edges. Pinned to v3 deliberately.
- **Owner notes not rendered at all for guests** — not just hidden with CSS. Gated on `isOwner` in the component, not a style toggle.
- **Seed data always loads on first visit** — if localStorage is empty or corrupted, falls back to `SEED_DATA` from `src/data/seed.js`. Two rich productions pre-populated so the app looks alive on first open.

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
    AppContext.jsx            — all state, localStorage sync, helper functions
  data/
    seed.js                  — SEED_DATA: slots, connectedCalendars, calendarEvents (with * and ^ prefixes), productions
  utils/
    availability.js          — derivation logic (veto/hold/governing), getMonthGrid, getWeekDays, dateToStr
    googleCalendar.js        — GIS OAuth, fetchCalendarList, fetchCalendarEvents, fetchAllGoverningEvents
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
    ProductionView.jsx       — group list + group overview panel + private notes
    RoomView.jsx             — Notes / Chat / Availability tabs
    AvailabilityRules.jsx    — SlotEditor + calendar preview + production overrides
    CalendarSettings.jsx     — Google OAuth, role assignment modal, sync, disconnect
```

## Environment Variables

```
VITE_GOOGLE_CLIENT_ID=<google oauth client id>
```

- Set in `.env` for local dev (gitignored)
- Must also be added to Vercel dashboard → Project Settings → Environment Variables
- Google Cloud Console project: `cap-collective-app` (Project ID: `cap-collective-app`)
- OAuth Client ID type: Web application
- Authorized JS origins: `http://localhost:5173` + Vercel URL

---

## Screens

1. **Dashboard** (Christian only) — all active Productions, health signals, unread count
2. **Production View** (Christian only) — Groups as tabs, private notes layer
3. **Room** (Christian + Group members) — shared notes, chat, availability view
4. **Availability Rules** (Christian only) — slot types, date blocks, private context notes
5. **Calendar Settings** (Christian only) — connected calendars, roles, sync status (stubbed)

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
  └── Production[]
        ├── name, description, date range
        ├── ownerNotes (private — never shown to guests)
        ├── availability_rules[]
        └── groups[]
              ├── id, productionId, name
              ├── members[] ← email (not yet functional)
              └── room
                    ├── sharedNotes (string, edited by both sides)
                    ├── messages[] ← { id, senderId, senderName, text, timestamp, read }
                    └── (availability derived from calendarEvents in AppContext)
```

---

## Next Iteration Priorities

When the prototype is validated with Christian, here's the natural build order:

1. **Deploy to Vercel** — connect `dansbrandmoves/cap-collective-app`, auto-deploys on push
2. **Owner login** — simple PIN screen so Christian can safely share the URL. Store token in localStorage.
3. **Google Calendar OAuth** — replace stubbed `calendarEvents` in seed.js with real data. OAuth flow → assign calendar role immediately after connect.
4. **Availability rule creation UI** — let Christian add/edit rules from the Availability Rules page
5. **Mobile layout pass** — Room and Dashboard are the priority screens for mobile
6. **Real-time sync** — consider Supabase for shared notes + chat persistence across devices

---

## Calendar Notes

- Google Calendar OAuth is **stubbed** — hardcoded sample events in `src/data/seed.js`
- "Connect Google Calendar" button exists but is disabled — UX flow is visible, wiring comes next
- Sync behavior: manual refresh button for prototype; webhooks (Google Calendar push notifications) for production
- Calendar event tiers: `available` (green), `hold` (indigo), `booked` (amber), `blocked` (red)

---

## Open Questions (not yet answered by Christian)

- What does he call the unit of work — "Production," "Project," or "Shoot"?
- Does he want clients to request specific dates, or just see availability?
- How many active productions does he typically run at once?
- Desktop-first okay, or does he need mobile now?

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

- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **State:** React state + localStorage (no backend yet)
- **Auth:** Hardcoded owner vs. guest role (no real auth in prototype)
- **Deployment:** Vercel
- **Notes:** Simple textarea/contenteditable — no rich text editor

---

## Prototype Scope (what's in vs. out)

**In scope:**
- Create a Production with name and date range
- Create Groups with custom names
- Shareable link to a Room (no real auth)
- Shared notes inside a Room
- Chat thread inside a Room
- Simple availability calendar (stubbed — no OAuth)
- Owner private notes layer
- Dashboard with all Groups and basic unread indicator

**Out of scope:**
- Google Calendar OAuth (stub availability data)
- Real-time collaborative editing
- Full auth system
- Mobile optimization
- Multi-Production support

---

## Screens

1. **Dashboard** (Christian only) — all active Productions, health signals, unread count
2. **Production View** (Christian only) — Groups as tabs, private notes layer
3. **Room** (Christian + Group members) — shared notes, chat, availability view
4. **Availability Rules** (Christian only) — slot types, date blocks, private context notes
5. **Calendar Settings** (Christian only) — connected calendars, roles, sync status (stubbed for now)

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
        ├── owner_notes (private)
        ├── availability_rules[]
        └── Group[]
              ├── name (owner-defined)
              ├── members[] ← email invite
              └── Room
                    ├── shared_notes
                    ├── messages[]
                    └── availability_view ← derived from owner rules
```

---

## Calendar Notes

- Google Calendar OAuth is **stubbed** in the prototype — hardcode sample events
- Show a placeholder "Connect Google Calendar" button for UX flow visibility
- Wire real OAuth in the next iteration after prototype is validated
- Sync behavior: manual refresh button for prototype; webhooks for production

---

## Open Questions (not yet answered by Christian)

- What does he call the unit of work — "Production," "Project," or "Shoot"?
- Does he want clients to request specific dates, or just see availability?
- How many active productions does he typically run at once?
- Desktop-first okay, or does he need mobile now?

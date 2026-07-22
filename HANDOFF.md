# Coordie — Continuation Handoff

**Last session ended:** 2026-07-21 (UI/UX review + zen pass + deep declutter, shipped to prod)
**Last pushed commit:** `6f61a13` — "coordie: auth timeout must never delete the session token"

> **2026-07-21 (final block) — COPY SWEEP + SIDE NAV + WEBSITE + AUTH FIX**
> (`ae78477`, `04af2a5`, `6f61a13`, all deployed):
> - **Copy sweep, app-wide:** functional tone, fewer words, ZERO em dashes in
>   app/help copy (marketing landing + legal + admin diagnostics exempt... and the
>   landing got de-dashed anyway). Rule: say what it does, not why you'll love it.
> - **Guest signup nudge:** one quiet line ("Save this project to a free account");
>   modal = "Save this project / Creates a free account with <project> in it." with
>   Google + Microsoft + Email all as first-class buttons (was Google + tiny email link).
> - **Side nav:** "Sign out" moved to the Account page header (rare action, no
>   permanent nav space); hover the Projects row → quiet "+" opens the new-project
>   modal via /?new=1; non-admin stray divider fixed.
> - **Website:** accuracy pass (feature cards renamed Shared tasks / A shared
>   whiteboard, Outlook scheduling mentioned), sales flourishes removed ("THE MAGIC"
>   → "The overlap", "Ready to coordinate better?" → "Try it with your next project.").
> - **⚠️ AUTH BUG FIXED (`6f61a13`):** the 3s auth safety timeout was DELETING the
>   stored Supabase token on any slow load — silently signing real users out and
>   destroying their refresh token (reproduced live: it nuked Daniel's session in the
>   preview browser mid-review). Timeout now only unblocks the UI; session resolves
>   via getSession() + listener and recovers. If users ever reported "it logged me
>   out randomly," this was why. (Daniel: your preview-browser session was a casualty
>   of the OLD code — sign in once more.)

> **2026-07-21 (later still) — OUTLOOK SCHEDULING (`6d4b442`).** "Schedule meeting" now
> opens the user's OWN calendar: Google template OR Outlook deeplink (live.com for
> personal MSA domains, office.com for work). `utils/scheduling.js` resolves the
> provider with zero setup: explicit "use X instead" choice (localStorage
> `coordie-sched-provider`) → connect hint (`coordie-sched-provider-hint`, set when a
> guest connects Google/Outlook) → owner's connected-calendar providers → auth provider
> (azure→outlook) → email domain → google. Inspector footer shows the destination +
> one-tap switch. Both URL shapes verified via window.open capture. This closes the
> "primary calendar / schedulingProvider" item — the localStorage-per-device approach
> replaced the planned account-level setting (simpler, zero UI). If cross-device
> persistence is ever wanted, promote the override into profiles.settings.

> **2026-07-21 (later) — DEEP DECLUTTER (`92b28f9`).** Rule: if an element explains,
> duplicates, or counts what you can already see, it dies. Killed: "Tasks 2" tab count
> badge; "2 people · next 60 days" meta line; chip fractions when everyone's free (dot
> carries it); Dashboard + Shared-with-me subtitles; Account duplicate email line;
> working-hours caption; BOTH day-inspector instructional captions; slot rows saying
> the time twice (new `formatTimeRange()` in utils/availability.js — one friendly line,
> no raw 24h in UI; `block-` id prefix discriminates auto-generated slots).
> **"Board" tab renamed "Whiteboard"** (Daniel's call; internal key 'board' unchanged).

> **2026-07-21 — FULL UI/UX REVIEW SESSION (two commits, both live).**
> `7a13867` (bug pass) + `57e499d` (zen pass). Verified on prod after deploy.
>
> **Fixed — the big ones:**
> - **The "reconnecting to Google on every refresh" glitch** (Daniel's report): the
>   Calendars page fired a visible `handleSync()` on every mount → spinning arrows for
>   seconds. Now freshens ONCE per mount, silently; spinner/error only on manual sync.
> - **`dateToStr()` was UTC (`toISOString`)** → after ~8pm ET "today" highlighted
>   TOMORROW everywhere, best-day chips labeled one day but showed the next day's data,
>   and UTC+ timezones had the whole grid shifted a day. Now formats LOCAL dates.
>   (tests still pass — the dateToStr test only passes in UTC- zones under old code.)
> - **Stuck "Connecting…"**: GIS code client had no `error_callback` — closing the
>   Google popup left the guest connect button spinning forever. Cancels reset quietly.
> - **Shared projects counted against the owner's free project limit** (banner +
>   `canAddProject`) — being invited to 2 projects + owning 1 showed the upgrade nag.
> - Guest inspector: host now has a real email on invites — **owner email rides in
>   `profiles.settings.email`** (synced like displayName; populates after the owner
>   loads the app once). Guest name prompt shows "«Host» invited you to «Project»".
> - Booking page: **timezone label** ("Times in Eastern Daylight Time — the host's
>   time zone" when guest tz differs) + on confirm card. Was fully unlabeled.
> - Guest Tasks board: assignee "You" (OWNER_LABEL) now displays as the host's real
>   name for guests (`assigneeDisplay` prop on Board — display-only, data unchanged).
> - Landing copy de-Googled (feature card + CTA); debug console.logs DEV-gated;
>   RoomView raw "Loading..." → PageLoader; misc polish.
>
> **Zen pass (57e499d):** ONE "Connect calendar" CTA for guests (provider choice is a
> click-to-reveal menu when both Google+MS configured — progressive disclosure);
> roster instructional caption removed; Account→Calendars regrouped (connections →
> connected calendars → working hours → THEN appearance/timezone/branding); day
> inspector marks the viewing guest "· you".
>
> **⚠️ Environment note:** the old Dropbox copy is GONE (path no longer exists) — its
> `.env` went with it. `.env` was reconstructed in `D:\coordie` from Supabase MCP
> (URL + anon key) and the live bundle (Google/MS client IDs — public values). If lost
> again, same recipe. `node_modules` had to be reinstalled after the repo move.
>
> **Next zen arc (design-first, not started):** unify the two GuestCalendarPanel
> copies (RoomView vs BookingPageView) behind the new single-CTA pattern; booking-page
> guest connect is still **Google-only** (MS needs roomId-keyed server exchange —
> booking pages have no room, so it's real plumbing); booking-page cards could show
> the copy-link affordance directly (now hidden in ⋯); consider converting booking
> times into the guest's timezone (currently labeled, not converted).

> **2026-07-15 — MICROSOFT ENTRA PUBLISHER VERIFICATION IS DONE.** Coordie's consent
> screen now shows the blue "verified publisher" badge with "Moves and Measures LLC"
> instead of "unverified publisher." Multi-tenant users can consent without the scary
> interstitial. Key IDs saved to memory (`project_coordie_microsoft_verification.md`):
> - App ID: `1dbedd4d-b064-4be2-ae5e-d25fcc49a4b3`
> - Publisher domain: `movesandmeasures.com` (verified custom domain in BRANDMOVES.CO tenant)
> - MPN ID: `7122339` (Moves and Measures LLC in Partner Center)
> - Verification JSON hosted at `https://www.movesandmeasures.com/.well-known/microsoft-identity-association.json`
>
> **What tripped us up (for the record):** Microsoft's "Unable to connect to..." error
> was misleading. The file WAS reachable (200 OK, Content-Type application/json, valid
> TLS, both IPv4/IPv6). The real requirement was: (1) add movesandmeasures.com as a
> DNS-verified custom domain in the Entra tenant (via TXT record at the DNS registrar),
> and (2) associate an MPN ID from Microsoft Partner Center. Support engineer helped
> after ticket #2607150040010139 pointed us to the custom-domain requirement.
>
> **Repo location change:** Working directory moved from Dropbox path to `D:\coordie`
> to eliminate the Dropbox-touching-git-index bugs. Old Dropbox copy still exists at
> `C:\Users\danie\Dropbox\Creative Cloud Files\Client Fulfillment\MM\vibe-coding\cap-collective-app`
> and may still hold the real `.env` — pull secrets from there when running locally.

> **2026-06-03 (session 4, cont.):** GUEST MICROSOFT/OUTLOOK support shipped.
> Guests were Google-only; now connect Google, Outlook, or both. `guest_calendar_tokens`
> gained ms_* columns (same row as google_*). `microsoft-calendar-auth` (v3) +guest_exchange/
> guest_disconnect. `sync-guest-calendars` (v4) is provider-agnostic: fetches Google + Outlook,
> merges busy → free days; cron selects guests with EITHER token. Guest MS connect = POPUP that
> reuses the registered app-origin redirect (NO Entra change) + a boot shim in main.jsx that
> postMessages the code back. RoomView GuestCalendarPanel offers both (gated per-provider config).
> **UNTESTED end-to-end** (OAuth popup can't be exercised from CI) — Daniel/Dave should connect an
> Outlook calendar as a guest and confirm: popup → consent → closes → "Calendar connected" → busy
> days block. Check /admin/diagnostics `guest_sync` rows for `providers: {google, microsoft}`.
> Also: owner-busy slots now subtracted in the day scheduling panel (only available times shown,
> no dimmed "busy"); de-conflation pass (sync-calendar no longer touches MS calendars); new
> Availability Inspector tab in diagnostics.
>
> **STILL OPEN — "beyond Google-only" language sweep:** core calendar touchpoints de-Googled, but
> marketing/onboarding copy still Google-centric (HomePage.jsx hero "Connect Google Calendar",
> sign-in copy). Not yet swept. Privacy/Terms intentionally left provider-specific.

> **2026-06-03 (session 4):** De-conflation pass. `sync-calendar` (Google edge fn, now v5) was
> iterating ALL governing calendars incl. the owner's Outlook one — firing Google API calls against
> `ms:` ids every run. Now filters via `isGoogleCalendar()` (provider flag OR `ms:` prefix). MS is
> handled solely by `sync-ms-calendar`; both share `owner_calendar_events` (MS rows namespaced `ms:`).
> Provider-agnostic UI copy de-Googled (PeopleRoster tooltip, AvailabilityCalendar hints, booking
> email CTA). `googleCalId` params renamed `calId`. **NOTE:** investigated "owner shows free at 11am
> on 6/16 despite an overlapping Outlook event" — MS event IS in DB (11:30–16:30 UTC = 7:30am–12:30pm
> ET, correctly overlaps 11am) and loads on mount. Could not find a code path dropping it; likely
> stale client/deploy. Day-grid is day-level (afternoon-free → green day is expected); confirm via
> the **slot-level day inspector** (click 6/16 → the 11am slot row should read "Busy").
**Live at:** https://www.coordie.com (Vercel auto-deploys on push) — **THIS IS A LAUNCHED APP.**
  Don't ship anything that degrades real users (e.g. unverified OAuth scopes, broken builds).
**Google OAuth:** ✅ verified for `calendar.readonly` only. Owner + guest both request read-only.
**Commit convention:** prefix every commit subject with `coordie:` (parallel work across projects).
**Becoming:** Arro Calendar / Arro Scheduler — part of the Arro family (erro.ai).

---

## 🚦 Start here in a new thread
1. `git pull origin master`
2. Read memory index: `…/memory/MEMORY.md` — especially `project_coordie_guest_sync.md`,
   `project_coordie_diagnostics_and_roster.md`, `project_unified_calendar_direction.md`.
3. Skim `CLAUDE.md` at project root.
4. **Run `npm test`** (9 logic tests over the availability engine) before/after changes.
5. **Eyes:** when anything misbehaves, open **/admin/diagnostics** (admin only) and read the
   execution trace BEFORE guessing or doing SQL archaeology. Every guest/owner/cron flow logs there.

---

## ✅ Shipped 2026-06-03 (session 3 — latest) — Microsoft auth, provider groundwork, perms/UX

Commits: `0413bc5`, `67f8ed8`, `6622778`, `dd9c551` (all on `master`, prod).

- **Microsoft sign-in — LIVE (needs end-to-end test).** "Continue with Microsoft" button on
  `/signin` (`signInWithOAuth({provider:'azure'})`, scopes openid/email/profile/offline_access/
  User.Read/Calendars.Read). **Infra all set up this session** (Daniel did the portal work): Azure
  app registration "Coordie" (any Entra + personal accounts), redirect = Supabase callback, client
  secret, 6 Graph delegated scopes granted; Supabase Auth Azure provider enabled, tenant URL
  `https://login.microsoftonline.com/common`. **If sign-in errors on prod:** add the Vercel prod
  URL to Supabase → Auth → URL Configuration → Redirect URLs. **Calendar-sync secrets go in
  Supabase Edge Function secrets (MS_CLIENT_ID/SECRET/TENANT_ID), NEVER Vercel** (Vercel only
  exposes VITE_ vars → public).
- **Booking/project UX fixes.** Day inspector: "ideal time slots" now respect the selected
  time-of-day window (`windowFilter` prop on `DayInspectorPanel`, passed from `ProjectOverview`);
  "Pick a different time" no longer repeats the top slots (dedup by slot id); availability count
  uses the correct denominator (`totalKnown` = included people, e.g. 1/2 not 1/1).
- **Owner logo removed from project/room views** (kept on booking pages only); `CalendarSettings`
  branding copy updated to "Your logo appears on booking pages. Projects use the Coordie mark."
- **Sign-in page is always light** (Arro brand) + copy fix ("Welcome to Coordie" — works for new
  AND returning users). `/signin` added to the AppContext theme guard so app dark mode doesn't
  stomp it (same pattern as `/book/` and the marketing landing).
- **Sidebar project list grouped** into mine + **"Shared with me"** (Drive convention).
- **Project owner titled "Coordinator"** — a SUBTLE subtitle that complements the owner's real
  name, never replaces it (room sidebar shows the name as primary; "Coordinator · you" for self).
  Internal `OWNER_LABEL='You'` left alone — it's an availability-matching key, not just display.
- **Admin/member permissions.** Only the project **owner** gets the admin console (`ProductionView`).
  A member who opens a shared project is **redirected to their room** (participant view); the People
  roster's remove (✕) + "Add person" are gated behind a new `canManage` prop. (Note: the Sidebar
  "Shared with me" links go to `/project/:id`, which then redirects members to their room.)
- **Deselect-pending fixed.** Pending people (no calendar shared) are **toggleable again** — fixes
  founder's "can't deselect someone who hasn't accepted." (Walks back the earlier "pending can't be
  checked" behavior, which had locked them in a checked state — per founder feedback it was backward.)
- **Perf — instant calendar loads.** Stale-while-revalidate caching in **sessionStorage** for room
  schedule, owner calendar (guest view, `coordie-ownercal-<ownerId>`), and project-wide availability
  (`useProjectAvailability`, `coordie-projavail-<roomKey>`). Refresh paints last-known overlap
  instantly, then revalidates. Sidebar shows a **pulse-skeleton + "Loading calendars…"** before
  showing people checked off (no more misleading auto-checked flash). sessionStorage (not local)
  on purpose — survives refresh, clears on tab close, sidesteps the stale-data risk.

**Follow-ups shipped same session (`9cf6b83`):**
- **Owner shows their real name to guests, not "Coordinator."** Root cause: the owner's
  `settings.displayName` was never written (and the settings-sync object didn't even include it, so
  it'd wipe). Fix: backfill `displayName` from auth metadata (Google/MS name → email prefix) when
  empty, persist it in profile settings, include it in the sync object. "Coordinator" remains only
  as a last-resort fallback for an owner with truly no name. (Takes effect after the owner loads the
  app once so the backfill writes.)
- **Guest "Connect calendar" reflects server truth.** Was tracked only in sessionStorage
  (`coordie-gcal`), which clears on tab close → a connected guest got re-prompted after refresh. Now
  `connected = guestEvents !== null || sharedAvailability has rows for this guest` → the connected
  pill persists. (Disconnect still clears server token + availability via `disconnectGuestCalendar`.)

**Tasks upgrade — Trello card power-ups (`b439cd0`, `f59225d`):**
- **Labels** (`tasks.labels` jsonb `[{color,text}]`) — color palette + optional text; card shows
  color bars.
- **Due dates** (`tasks.due_on` date) — picker in modal; card chip (overdue=red, soon≤2d=amber).
- **Checklist** (`tasks.checklist` jsonb `[{id,text,done}]`) — progress bar + items; card shows x/y.
  All three persist via the existing `updateTask(updates)` path (no useBoard change).
- **Attachments** — new `task_attachments` table + public `task-attachments` storage bucket (anon
  read/write, realtime). `useTaskAttachments`: addLink (any URL; Google Drive links auto-tagged
  `drive`), addFile (upload), removeAttachment (frees the file). Modal section: list + paste-link +
  Upload.
- **Complete state** (`tasks.completed` + `completed_at`, `43d27da`) — real data, not UI-only.
  Hover-reveal complete circle top-left of each card (always shown once complete → green check +
  strikethrough); same toggle in the card header.
- **Minimal card restored** (`43d27da`) — Labels/Dates/Checklist/Attachments only render once they
  have content or you add them via an **"Add to card"** row (Trello-style). Members + Description +
  Comments stay always-on. (First pass showed all sections at once → looked bloated.)
- **Empty-column drop fix** (`43d27da`) — empty lists now have a roomy dashed "Drop here" target
  instead of a paper-thin line, so dropping into an empty column actually lands.
- **Follow-ups:** native **Google Drive Picker** (browse/pick, not just paste a share link) — needs
  Drive API key + OAuth creds Daniel will set up; phase 2. Optional: attachment-count badge on the
  card face (skipped to avoid loading all attachments for the board).

**Sidebar / branding / roster polish (`14ffb62`):**
- **No Coordie logo** at the top of the project sidebar (RoomView) anymore.
- **"Powered by Coordie" removed for actual app users.** It lives only on landing + booking pages
  (promo to prospects). Guest project pages use the not-signed-in "Create your free Coordie" nudge
  instead — that's the guest signup method, not a powered-by badge.
- **Project roster now matches the guest sidebar aesthetic** (avatar left, name + subtle subtitle,
  checkbox right, no calendar-icon clutter) — `PeopleRoster` restyled. Owner keeps copy-invite +
  **remove-from-project** (the X, gated by `canManage`) — the one thing the guest view doesn't have.
  This is the lightweight "improve it a bit" version of the roster unification, not a hook merge.
- **"Coordinator" is a subtitle, never a name.** Backfilled `profiles.settings.displayName` from auth
  metadata (full_name → name → email local-part) so existing owners show their real name to guests;
  the owner backfill-on-load also keeps new owners covered.

**Nav + roles (`46339b3`):**
- Shared projects (RoomView, signed-in member) now get the **"← Projects"** back-nav, matching how
  owned projects (ProductionView) do it. Owner keeps "← Back to project"; account-less guests get none.
- **Role model made explicit:** `room_members.role` ('member' default; 'coordinator'/'admin'
  reserved, check-constrained). The project `owner_id` is still the implicit **Coordinator** (full
  control). Not yet used in permission checks — those still gate on `owner_id === user.id` — but the
  column is there so future co-owner/elevated-permission features are role-based, not owner-only.
  When wiring it: `canManage = isOwner || role in ('coordinator','admin')`.
- **Guest project sidebar is now drag-resizable + collapsible** (`458bb47`) — RoomView's left
  panel uses the shared `useResizablePanel` ('coordie-room-nav'), same as the app nav + project
  panel (drag right edge, double-click reset, collapse to rail, width persisted). Replaced its
  ad-hoc `sidebarCollapsed` state.

### 🧱 Refactor debt (Dave's note — guest & owner pages should share code)
Dave flagged that the **guest project page (RoomView) and owner project page (ProductionView)** do
many of the same things and should share more code to cut duplication + bug surface. Already shared:
`ProjectOverview`, `DayInspectorPanel`, `useProjectAvailability`, `Board`, `Whiteboard`.

**Done (`1cffd26`, no behavior change):**
- ✅ **`utils/timeWindows.js`** — one source for `WINDOWS`/`WINDOW_ORDER`/`toMin`. Exports BOTH
  predicates by distinct names: `slotOverlapsWindow` (project + day inspector) and
  `slotStartsInWindow` (booking list). They intentionally differ — DON'T merge them.
- ✅ **`utils/cache.js`** — `readCache`/`writeCache`/`clearCache` replace the hand-rolled
  sessionStorage try/catch across RoomView, useProjectAvailability, BookingPageView.

**Refactor pass 2 (`5c56d90`) — audited owner (ProductionView) vs guest (RoomView) again:**
- ✅ **`WorkspaceTabs`** extracted — the Schedule/Tasks/Board tab bar was byte-identical in both;
  now one component (padding via `className`). The one genuinely clean merge.
- ❌ **Left the rest separate on purpose** (verdict, so we don't re-litigate):
  - *Sidebar shell* — wrapper/rail look similar but the mobile-drawer logic differs (RoomView
    `sidebarOpen` + backdrop + footer; ProductionView `mobileShowSidebar`, no footer). Genericizing
    = prop explosion for little gain.
  - *People list* — owner-centric `useProjectPeople` (project-wide, "You" first, add/remove/invite)
    vs guest room-scoped chip+knownGuests. Different identity + query scope. Restyle already gave
    them a shared *look*; merging the data model is high-risk on the core overlap feature.
  - *GuestCalendarPanel* (RoomView vs BookingPageView) — different connect flows (server refresh
    token vs one-time GIS). Could share UI shell only; not worth the risk.
  - *Availability loading* — RoomView (single room, unfiltered, for connected-detection) vs
    `useProjectAvailability` (all rooms, is_available=true). Parameterizable but touches the core
    feature; deferred unless it bites.

**Still open (design-first; do separately from feature work):**
- **People roster/filter — DEFERRED ON PURPOSE.** RoomView's inline list and ProductionView's
  `PeopleRoster`/`useProjectPeople` look similar but the data/identity model genuinely differs:
  `useProjectPeople` is **owner-centric** (owner = "You", first, with add/remove/invite), while the
  guest room frames "who's the owner" as someone else. Unifying needs a shared *presentational*
  list that each page feeds a normalized `{name, sub, active, onToggle, trailing}[]` — NOT a forced
  shared hook. Worth doing, but design it first; touches core overlap selection on a live app.
- **GuestCalendarPanel exists twice** (RoomView offline-code-client flow + BookingPageView flow) →
  extract one component or at least one connect hook. Medium risk (different connect logic).
- **`useBoard`/`useCanvas`** still have their own localStorage SWR (different store + shape) — could
  adopt a `useCachedQuery` helper later, lower priority.
Principle going forward: build project features once, parameterized by `isOwner`/`canManage`, not
twice — but keep genuinely-different models separate (don't over-unify).

**Account page polish (`18e40ee`, `be300e2`):**
- Account header shows the user's **email** + a "notifications/booking emails sent to <email>" line.
- Branding copy trimmed to "Your logo appears on booking pages."
- **`resetAllSettings` audited + modernized**: now also resets timezone + booking branding
  (brandColor/bookingTheme/logoMode) and sets `guestCalendarEnabled=true` (it was wrongly forcing
  it OFF — guest calendar connect is on-by-default now). Leaves projects/calendars/logo/displayName
  alone. (Was stale — predated the settings trim + guest-calendar-always-on.)
- **Account → Availability** now uses `MyAvailabilityCalendar` (new lined-grid look matching
  projects + booking), replacing the old MonthlyView "barcode" `AvailabilityCalendar` there.
  `AvailabilityCalendar` still used by ProductionView (untouched).

### ✅ Microsoft Calendar — WORKING END-TO-END (tested on prod 2026-06-03)
Verified live: connect Outlook (furfarodesign.com) → Choose calendars → role "governs" → sync →
test events landed in `owner_calendar_events` (`ms:` namespaced) and block availability. Cron keeps
it fresh every 15 min. **Gotcha fixed:** the post-connect redirect to `/calendars?ms_connected=1`
lost the query param (router rewrites `/calendars`→`/account?tab=calendars`); now redirects straight
to `/account?tab=calendars&ms_connected=1`, plus a manual "Choose calendars" button. Exchange errors
log to `diagnostics` (event `ms_calendar_auth`) with the redirect_uri + AADSTS detail.
Entra redirect URIs registered: Supabase callback + `www.coordie.com` + `coordie.com` + localhost.
**Still optional:** primary-calendar marker + `schedulingProvider` (default for event creation).

### 🟡 Microsoft Calendar — build history (staged)
**Phase 1 DONE (`afab663`, deployed, dormant):**
- `profiles.ms_refresh_token / ms_access_token / ms_token_expires_at`.
- `microsoft-calendar-auth` edge fn (exchange / refresh / disconnect) — Graph v2.0 token endpoint,
  tenant `common` (work + personal). Secrets MS_CLIENT_ID/SECRET/TENANT_ID already in Supabase.
  Mirrors `google-calendar-auth`. Nothing calls it yet → zero live impact.

**Phase 2a DONE (`9708cd4`) — connect + calendar picker, GATED behind VITE_MS_CLIENT_ID:**
- `src/utils/microsoftCalendar.js`: redirect OAuth, token refresh, disconnect, Graph calendar-list
  + events. AppContext handles the `microsoft-calendar` OAuth return → `/calendars?ms_connected=1`.
- `connected_calendars[].provider` ('google' default | 'microsoft'); MS ids namespaced `ms:<id>`.
- Account → Calendars: "Microsoft / Outlook Calendar" connect section + post-connect role picker
  (reuses the modal) + Outlook/Google badges. Entra redirect URIs added (coordie.com + localhost). ✅
- **No event sync yet** — connecting + picking calendars stores them but doesn't block availability
  until 2b. This is the OAuth + calendar-list slice for testing.

**⚠️ NEEDS DANIEL to test 2a:** add **`VITE_MS_CLIENT_ID`** (the app registration's Application/client
ID) to `.env` AND Vercel (Production) → redeploy. Until then the whole MS UI is hidden. Then:
Account → Calendars → Connect (Microsoft) → consent → should land back showing your Outlook
calendars in the role picker, then listed with an "Outlook" badge.

**Phase 2b DONE (`07c2734`) — event sync, coexistence handled:**
- `sync-ms-calendar` edge fn (deployed) + `cron_sync_ms_calendars` 15-min cron. Reads governing MS
  calendars from `connected_calendars`, Graph `calendarView` (windowed −31/+92d), full-replace this
  owner's `ms:<id>` rows in `owner_calendar_events`, skips `showAs=free`.
- **Coexistence audit result:** safe as-is. `sync-calendar` deletes/upserts scoped by `calendar_id`,
  MS ids are namespaced `ms:`, so neither provider wipes the other. `replaceCalendarEvents` (the only
  full `owner_id` delete) is **dead code — never called**. Did NOT patch `sync-calendar` (it errors
  harmlessly on MS cals; re-pasting a working 199-line prod fn for a cosmetic skip wasn't worth the
  risk — minor optimization noted: add `provider==='google'` to its governing filter someday).
- Client `triggerMicrosoftSync`; CalendarSettings fires it ~3s post-connect + manual "sync now"
  button. Owner's in-memory events refresh from `owner_calendar_events` via the existing realtime sub
  → MS busy times flow into `deriveSlotState`, no engine change.

**STILL TO TEST (Daniel — agent can't do live OAuth/Graph):** set `VITE_MS_CLIENT_ID` (Vercel + .env),
redeploy, then Account→Calendars→Connect (Microsoft)→pick calendars→"sync now"→confirm Outlook busy
days show in your availability. Watch `/admin/diagnostics` + the edge fn logs if anything's off.

### 🔜 Microsoft Calendar — remaining (small, after 2b is confirmed working)
- **Primary calendar marker + `schedulingProvider`** — when ≥2 calendars/providers, mark which is the
  default for event creation; route "Schedule meeting" to Google template vs Outlook compose deeplink
  (`outlook.live.com` personal vs `outlook.office.com` work). Cosmetic until native scheduling is on.

### 🔜 (folded into the above) — multi-provider / "connect another account" / primary calendar
**This is also the answer to "connect another calendar account" + "pick a primary calendar."**
Today Account → Calendars connects Google only. Connecting a second account (a Microsoft/Outlook
calendar, or another Google) and merging busy times — plus marking a **primary** calendar for
default event creation — all require the Graph read + sync below. NOT doable piecemeal; it's this
build. Until then: one Google account, role per calendar (governs/informational/ignored).
Answers both Daniel's "primary calendar type" question AND founder feedback ("Calendars section
only allows 1 calendar — I want busy times from Google + hotmail"). One build:
- **Data model:** `provider` ('google'|'microsoft') on each connected calendar; user-level
  **`schedulingProvider`** setting = where "Schedule meeting" sends them (default from sign-in
  provider; overridable in Account). Principle: **busy-reading is many-to-many** (aggregate ALL
  calendars, any provider); **meeting-creation is ONE destination** (schedulingProvider).
- **Build:** `microsoftCalendar.js` (Graph read → normalize into the existing internal event shape
  so `deriveSlotState` is unchanged); Graph sync edge fn + DB provider tagging; Account→Calendars
  UI to connect MULTIPLE calendars across BOTH providers (badge + role each) and merge busy times;
  guest+owner "Connect calendar" offers Google AND Microsoft; "Schedule meeting" routes Google
  template URL vs **Outlook compose deeplink** (`outlook.live.com` personal/hotmail vs
  `outlook.office.com` work — they differ).
- **Identity caveat:** a user's calendar account email ≠ sign-in email (Google login + hotmail
  calendar) — don't assume sign-in email == calendar email when matching people.
- **Prereq:** live-test Microsoft sign-in first (Daniel + Dave).

### Process note
Notion/Asana session-close protocols are OFF (Daniel's call). **This HANDOFF.md is the record** —
keep it updated. See `memory/feedback_skip_notion_asana.md`.

---

## ✅ Shipped 2026-06-02 (session 2) — Tasks board, Whiteboard, perf, marketing

**The project now has three surfaces, as tabs: `Schedule · Tasks · Board`.** (Owner project
view AND guest room — same components.) Naming: kanban = **Tasks**, infinite canvas = **Board**.

- **Tasks — a real Trello-style board** (`components/project/Board.jsx`, `hooks/useBoard.js`).
  Editable lists (add/rename/delete/reorder via grip), cards drag **between AND within** lists with a
  precise insertion line (`reorderTask`), assignees from the project roster. Click a card → **detail
  modal** (`TaskDetailModal`): editable title + description, Members, and a realtime **Comments &
  activity** feed (`hooks/useTaskComments.js`, author + timestamp + "Card created" line).
  Tables: `tasks` (+ `column_id`, `description`), `board_columns`, `task_comments`. One board **per
  project**; anon read/write like chat/notes; realtime. Default cols seeded To do/Doing/Done.
- **Board — a slimmed-down Miro** (`components/project/Whiteboard.jsx`, `hooks/useCanvas.js`).
  Infinite canvas, bottom-center toolbar, zoom-to-fit, toggleable dot grid (theme-aware).
  Elements: sticky / rect / circle / text / **comment pin** (author+timestamp) / **image** / **connector**.
  - **Images**: `utils/imageOptimizer.js` downscales→WebP (~320KB) before upload to the public
    `canvas-images` storage bucket; quota-capped (30MB/project, 200MB/account); proportional resize.
  - **Connectors**: drag from an element's **side dot** to another → naturally-curving arrow that
    **anchors to the four side dots** and tracks the elements as they move; click → style bar
    (thickness / arrow dir / color). Rendered in an SVG layer behind elements.
  - **Four-corner resize**, stickies have a paper gradient+shadow+sharp corners.
  - **Mobile**: `touch-action:none` on the viewport (smooth pan/drag for ALL objects) + **pinch-zoom**
    (multi-pointer map; ref-based `applyZoom` to dodge stale closures in long-lived listeners).
  Table: `canvas_elements` (type, x/y/w/h/z, text, color, font, author, **src/bytes** for images,
  **from_id/to_id/meta** for connectors). Migrations: `20260603_*` (board_columns_and_group_access,
  canvas_elements, canvas_images_storage, canvas_connectors, task_details_and_comments).

- **Guest room rebuilt as the project shell** (`RoomView.jsx`): collapsible **left sidebar**
  (owner branding + project name + People include/exclude filter + "Powered by Coordie"), **no top
  banner**, **connect-first middle** (Connect-your-calendar → then "When can everyone meet?" + a subtle
  disconnect pill), and a true **full-bleed top→bottom right day inspector**. `ProjectOverview` is now a
  real **two-pane** layout (calendar column scrolls; inspector fills height — `lg:h-full`, not sticky
  `h-screen`). Tabs float over content on `lg` so canvas+inspector reach the top. Guest = exact same
  experience as owner; schedule data + people-select lifted to RoomView. `AvailabilityTab` removed.
- **Join requires name + email** for open-link guests; the joiner is recorded as a room member.
- **Instant-load perf**: Tasks (`useBoard`) + Board (`useCanvas`) cache to localStorage
  (stale-while-revalidate, keys `coordie-board-<pid>` / `coordie-canvas-<pid>`) and paint instantly.
  **Calendar fetches windowed** to `[now-7d, now+120d]` (`calendarWindow()` in AppContext + guest fetch
  in RoomView) instead of all ~2,700 rows. (Trade-off: events >120d out won't show until widened.)
- **Owner project view**: tab bar floats on `lg` so the Schedule day inspector + Board canvas bleed to
  the top edge; mobile nav consolidated to one menu (sidebar `relative`+`fixed` clash fixed — see gotcha).
- **Hidden the "groups" concept** in UI (dashboard shows "N people", not "N groups").
- **David "0 free days" fixed** — `sync-guest-calendars` v2: a day is only UNAVAILABLE when heavily
  booked (≥6h, `BUSY_DAY_MINUTES`); `transparency:'transparent'` events don't block; opaque all-day
  blocks. Was marking any day with any event busy → busy calendars contributed nothing. (0→50 free days.)
- **Marketing refresh** (`b288e3c`): landing hero + feature grid + sign-in now pitch the full workspace
  (find the day → plan on a shared **board** + **whiteboard**); dropped stale "Booking pages too" /
  "Share rooms with groups" cards.

**Light-mode fix:** Tasks cards have a visible border + soft shadow (white/7% was invisible on light).

### 🔜 Queued, greenlit, NOT started — **Board Phase 1** (do this first next session)
Desktop **natural pan/zoom** (two-finger scroll pans, ⌘/pinch zooms, Space+drag pans anywhere — today
desktop wheel always zooms & pan needs empty space); **undo/redo** (⌘Z, command-stack of inverse ops —
note: `useCanvas.deleteElement` no longer removes the storage file, partly to keep image-delete
undoable); **hover-reveal connect dots + one-time coachmark**; **⌘D duplicate**; **concurrent-edit
safeguard** (pause the realtime refetch during active drag/typing so unsaved edits aren't clobbered).
User said "yes to all." Audit reasoning is in this session's chat.

### Loose ends
- `PersonChip` in `RoomView.jsx` is now unused (harmless) — can delete.
- Whiteboard image-delete leaves the storage file orphaned (row deleted → frees quota, file lingers);
  fine for now, could add a cleanup pass.
- Anon writes on board/canvas/images/task_comments (like chat/notes) — tighten before a true public launch.

---

## ✅ Shipped 2026-06-02 (session 1) — calendar unification + UX polish

**Big arc: unified the calendar look/feel/UX across PROJECTS + BOOKING.** Project UX is the
north star; booking adopts the same components + visual language. Key principle the user kept
returning to: the value is **overlap** ("when can everyone meet?" / "when are we both free?").

- **One lined-grid calendar everywhere.** Project view (`ProjectOverview.jsx`) + booking
  (`BookingPageView.jsx` `MonthCalendar`) + landing mockup (`HomePage.jsx`) all use the same
  Apple-style grid: true rectangular cells, subtle continuous border lines, **green DOT** (not a
  circle) when everyone/both are free, **weekend numbers muted** (`text-zinc-600`), today in teal,
  selected day = `ring-2 ring-inset ring-accent`. `getMonthGrid` + new `trimBlankWeeks()` in
  `utils/availability.js` (never render a trailing all-blank week — but `getMonthGrid` itself still
  returns 42 cells; the test relies on that, don't change it).
- **Shared `SlotRow` component** (`components/availability/SlotRow.jsx`) — booking's `TimeSlotPicker`
  and the project Day Inspector render slots from one source. Teal selected / dimmed busy.
- **Two-click scheduling** in the Day Inspector: tapping a slot SELECTS it (accent), the bottom
  "Schedule meeting" button is what opens the GCal tab. Removed the manual time picker + all-day.
- **Time-of-day filter** (Any time/Morning/Afternoon/Evening) on both: project work area + day
  inspector "Pick a different time"; booking date step (once connected) + time step. It's
  window-aware — `guestFreeDates`/best-days recompute per window so the dots/picks visibly change.
- **Booking page redesigned single-column → then two-column date step** (`de1af9a`): left column =
  title block + connect-calendar + filter + **TOP PICKS** (soonest 3 days you're both free, like
  project Best Days); right column = calendar. Centered, minimal header (logo+title/time as one
  object). Owner-canvas bloat gone. Booking uses the **owner's theme** (default light); violet
  `ambient-glow` retinted teal.
- **Day Inspector is now a flush full-height sidebar** (no floating rounded card / drop shadow).
- **Modals portal to `document.body`** (`components/ui/Modal.jsx`) so they're true full-viewport
  overlays (escape transformed/`overflow-hidden` ancestors). Booking-page kebab menu also portals.

**Fixes (verified):**
- **Person removal now sticks** (`2a7a294`). Root cause: removing a guest who'd connected their
  calendar didn't work because the **15-min guest-sync cron rebuilt their `shared_availability`** from
  their `guest_calendar_tokens` row (service-role-only — client can't delete it). Fix: new
  **`remove-project-guest` edge fn** (service role, verifies caller owns the rooms) deletes the TOKEN
  first, then sync_state/availability/requests/member. `removePersonEverywhere` in AppContext calls it.
  **Lesson: anything a cron rebuilds can't be fixed by a client delete alone — kill the cron's input.**
- **Instant project reload** (`9086230`): productions/roomMembers/bookingPages cached in localStorage,
  painted immediately, revalidated in background (stale-while-revalidate). Safe now that all pages run
  hooks before any early return (the old #310 trap is fixed). Cleared on sign-out. See
  `project_coordie_render_perf.md`.
- **Beefier free tier:** projects 1→3, rooms/project 2→5, booking pages 1→3 (`AppContext` consts).
- **Unified Add People modal** (`AddPersonModal.jsx`): name + optional email → adds + emails their
  invite link via new **`send-invite` edge fn** (Resend). Replaces the scattered Share section.
- Project + booking cards are clickable; per-card actions in a `⋯` menu. Admin Users + Diagnostics
  are now tabs (Diagnostics no longer a sidebar item). Owner email shows in the inspector ("You").

**Landing page** rebuilt around the project story ("Find the day that works for everyone." +
animated group-availability-converges mockup). Booking demoted to a secondary feature.

---

## 🅿️ PARKED: native in-app scheduling (revisit pre-launch-of-that-feature)
Built the full "schedule a real meeting in-app" flow, then **deliberately parked it** because this is
a live app and `calendar.events` is an unverified sensitive scope (would warn real users). Current
state (`2f56bc6`): owner + guest OAuth are **read-only**; the Day Inspector has the nice scheduling
form (title, Time window | All day toggle, best-slot prefill, attendee picker) but **"Schedule
meeting" opens a prefilled Google Calendar tab** (no write scope). The native path is preserved:
- `create_event` action is deployed in `google-calendar-auth` (unreachable for now).
- `createCalendarEvent()` helper exists in `googleCalendar.js`.
- To RE-ENABLE: flip `startGoogleAuth` to `OWNER_SCOPES` (readonly+events) and make
  `handleCreate()` in AvailabilityCalendar.jsx call `createCalendarEvent(...)` instead of
  `openGCalTemplate(...)`. THEN submit Google re-verification (scope justification + demo video +
  privacy-policy Calendar-data disclosure — the privacy page may need a wording update first).
User decided: stay on Google-Calendar-tab scheduling for now, polish everything else, revisit when
ready to launch native scheduling.

---

## ✅ Shipped 2026-05-31 / 06-01 session
**Native scheduling built then parked** (`02d1913` built it, `2f56bc6` parked it — see PARKED above).

**Unified guest calendar sync — guests now sync server-side like owners** (`8c4c95c`):
- New tables `guest_calendar_tokens` (+ `timezone`, refresh token, service-role-only RLS) and
  `guest_calendar_sync_state`. Mirrors the owner `profiles.google_refresh_token` + `calendar_sync_state`.
- `google-calendar-auth` edge fn gained `guest_exchange` (popup **code-client** auth code → refresh
  token, stored per room+guest) and `guest_disconnect` actions.
- New `sync-guest-calendars` edge fn: refresh token → fetch primary events → derive free days **in the
  guest's stored timezone** (Deno is UTC, so tz matters) → rewrite `shared_availability`; logs `guest_sync`.
- `cron_sync_guest_calendars` on the 15-min schedule (parallels `cron_sync_calendars`).
- Client: guest connect switched from implicit token (no refresh) to popup code client (offline →
  refresh token); `connectGuestCalendar` now just triggers the server sync. Migrations:
  `20260531_guest_calendar_sync_schema.sql`, `20260531_guest_sync_cron.sql`.
- **Gotcha:** guest sync only works for connections made on the post-`ed18ab0` build (older
  connections have no refresh token; cron can't sync them — guest must reconnect once).

**Owner is a first-class participant in joint availability** (`aa066cd`, `27ad5fd`): "You" is the
first roster chip, your connected-calendar free/busy counts in the day free/N tally, Best Days, and
the inspector. Fixed the old "[owner + 1 guest] never shows an overlap" gap.

**Account hub** (`b850c85`): `/account` with tabs **Calendars · Availability · Billing**, entered via
the sidebar **avatar** ("Account & settings"). Old `/calendars`, `/availability`, `/billing` redirect
into tabs. Sub-pages take an `embedded` prop (headerless). Sidebar nav trimmed to Projects + Booking
(+ admin). Loud "Upgrade to Pro" CTA gone — upgrade now surfaces contextually via `UpgradeModal`.

**Settings trimmed** (`b850c85`): cut Prefix Rules, Status Labels, availability-mode toggle (blocks is
default), Guest Calendar Access toggle (always on). Defaults still work under the hood; only UI removed.

**Roster → project left panel** (`b2c117b`): People roster moved out of the calendar column into the
left panel (who on the left, when full-width on the right). New `useProjectPeople` hook is the single
source of truth for roster + include/exclude selection, shared by panel and calendar.

**Collapsible + drag-resizable side panels** (`b2c117b`, `ed18ab0`): `useResizablePanel` hook +
`ResizeHandle.jsx`. Main nav and project panel each collapse to a rail + drag-resize independently;
widths persist in localStorage. Desktop only; mobile keeps the drawer.

**Admin Diagnostics** (`bf9fe18`): n8n-style execution log at `/admin/diagnostics`. `src/utils/diag.js`
(logEvent/startRun). This is the debugging backbone — use it first.

**Smaller:** guest-identity fix so invite_only guests always get the name prompt (`98cee05`);
`shared_availability`/`date_requests` added to realtime so the owner view updates live (`f11b102`);
removed private notes from the project panel; light-mode heading contrast fix (`604263b`).

---

## ✅ Shipped previous session (2026-05-30)
**Live calendar sync (S1) — server-owned, near-live, verified server-side:**
- `sync-calendar` edge function: incremental `events.list` per governing calendar with stored
  `syncToken`, writes only changed rows to `owner_calendar_events` (upsert/delete by
  `google_event_id`; daily re-baseline of the −1mo/+3mo window; empty delta = no write; dedupe
  by event id). Triggers: client on-app-load + manual; 15-min `pg_cron` fallback; (push = S2).
- Delivery via Supabase **realtime** on `owner_calendar_events` → owner + guests update live, no
  browser polling. Client retired the old full-fetch + Settings-scoped 30-min interval.
- Cron self-authorizes via a DB-stored `app_config.cron_secret` (no service-role key / Vault).
- **diagnostics table**: client→server event log (anon-insert) so guest-side flows are debuggable
  without the browser console. This is the tool that found the RLS bug.

**Arro theme + UX (all owner-side, user should eyeball):**
- Accent token violet → **Arro teal `#5e9c8c`** app-wide (`tailwind.config.js`).
- Dark mode less-dark slate (`#1e2429…`), **landing page forced light**.
- Availability month view: **one calm teal meter per day** (was a neon stripe-per-slot barcode).
- Day inspector is now a **real split column** (calendar shrinks beside it; no dimming overlay; Esc closes; mobile = bottom sheet). Applied in group calendar + project overview.
- Killed the room **Notes tab**. Decluttered/reorganized the **left nav** (primary top, project sub-list, config/account pinned bottom). "Who's included" people filter on Best Days.

**Earlier in session:** guest connect-calendar-first flow; date-request form → "tap your free
days"; Room→Group / Production→Project naming; one-click copy link; project-level **Best Days**
aggregate calendar; **group/project delete fix** (cascade FKs); legal TOS/Privacy updates.

---

## 🔜 Open / next (priority order)
0. **Board Phase 1** (greenlit, not started — see the "Queued" block in this session's shipped notes):
   desktop natural pan/zoom, undo/redo, hover-reveal connect dots + first-use coachmark, ⌘D duplicate,
   concurrent-edit safeguard. **Start here.**
1. **S2 — Google push notifications** (true seconds-live). Layers on the S1 engine. Plan is in
   `…/.claude/plans/let-s-double-down-on-steady-wall.md`. **Needs user config:** a
   `coordie.com/api/gcal-webhook` Vercel route (I provide code) + **domain verification** in
   Google Cloud Console. No new OAuth scope. Then build `calendar_watches` + `calendar-webhook`
   edge fn + `events.watch` register + renewal cron.
2. **The "one effortless dashboard"** (researched — see `project_unified_calendar_direction.md`):
   roster strip (everyone in the group, visible to members) → best-window answer line →
   **LIST / CALENDAR / GRID** toggle over one dataset → push inspector. Build incrementally.
   Sidebars should be **collapsible + drag-resizable**.
3. **A2/A3 — calendar convergence:** _partly done this session_ — booking + project + landing now
   share the lined-grid look and the `SlotRow` component. Still open: fold `ProjectOverview`'s grid
   into a single shared `<MonthCalendar>` component (booking's `MonthCalendar` and the project grid
   are still separate copies of the same markup), and migrate `RoomCalendarPanel` + guest `RoomView`
   to the `role` prop and delete legacy booleans.
4. **Bookings → a project "meeting" mode** (not a silo): the UX/look is now unified, but the data
   merge isn't — `rooms.mode` + `bookings.room_id`, guest pick-a-time via the unified calendar,
   retire `/booking-pages` last.
5. **Native in-app scheduling** — still parked (see PARKED above); needs Google re-verification.

---

## ⚠️ Gotchas (hard-won)
- **Dropbox holds `index.lock`** → commit via the temp-index workaround in CLAUDE.md
  (`GIT_INDEX_FILE=.git/index_tmp git read-tree HEAD` first — critical).
- **Don't use PowerShell here-strings (`@'...'@`) in the Bash tool** — the `@` leaks into the
  commit subject. Use a `printf`/`-F file` message.
- **Supabase RLS targets the `anon` role, not `public`** — guest (anonymous) inserts need
  policies `to anon, authenticated` + explicit grants, or they silently fail (this was the
  guest-sync bug). `date_requests` may still have a `public`-targeted insert policy — check it
  if guest date requests don't persist.
- **Owner-authenticated UI can't be verified by the agent** (no sign-in) — verify owner pages via
  `npm test`, Supabase SQL/MCP, the `diagnostics` table, and clean production build. BUT the
  **guest-facing surfaces CAN be eyeballed**: `preview_screenshot` works here (despite the old note)
  — load `/book/<slug>` (active slug e.g. `30-minutes-DnzQ`), `/` (landing), `/room/:token`. To
  simulate a connected guest calendar on the booking page: `sessionStorage.setItem('coordie-gcal','[]')`
  then reload (empty array = all weekdays free → dots + top picks render).
- **Anything a cron rebuilds can't be fixed by a client delete** — guest availability is rewritten
  every 15 min from `guest_calendar_tokens`; to truly remove a guest you must delete the token first
  (service-role only → `remove-project-guest` edge fn). Same shape applies to owner sync.
- **`productions` ARE cached in localStorage now** (stale-while-revalidate, commit 9086230). Don't
  revert it — the old #310 was the conditional-hooks bug, now fixed (all hooks before early returns).
- **Build verify trick:** `npx vite build --outDir "dist_v$(date +%s)"` then `grep "built in"` — using a
  fresh out dir each time avoids the Dropbox `EBUSY` rmdir error that hits when reusing `dist_verify`.
- **Edge functions** are deployed via MCP and mirrored in `supabase/functions/` for VC; migrations
  applied via MCP and mirrored in `supabase/migrations/`. Edge fns now: google-calendar-auth,
  sync-calendar, sync-guest-calendars, send-invite, remove-project-guest, notify-*, stripe-*.
- **Touch on the canvas:** the whiteboard sets `touch-action:none` on the viewport so the browser
  stops hijacking touch gestures — that's what made pan/drag/resize smooth on mobile. Don't remove it.
- **`relative` + `fixed` on one element = bug:** a mobile slide-over that had both classes resolved to
  `relative` (in-flow) and reserved its width off-screen, leaving a dead gutter. Pattern is `fixed`
  (mobile drawer) + `md:relative`/`md:sticky` (desktop) — never both unprefixed. Fixed in app-shell
  `Sidebar.jsx`, project `ProductionView.jsx`, and guest `RoomView.jsx`.
- **Calendar fetch is windowed** to `[now-7d, now+120d]` (`calendarWindow()`); navigating the calendar
  >120 days out shows no events until a sync widens it. Widen the window if that ever bites.
- **Tasks/Board cache to localStorage** (`coordie-board-<pid>` / `coordie-canvas-<pid>`,
  stale-while-revalidate). Data is always in Supabase; the cache just kills the empty-flash on load.
- **Preview Supabase can flake** (timed out mid-session this round → "Loading…" + stale HMR errors in
  the console that referenced already-removed components). Not a code bug; retry. Guest surfaces are
  still eyeball-able via `preview_screenshot` once it's connected (`/room/G9E7b3U9` is an active token).
- New edge fn version: `sync-guest-calendars` **v2** (free-day logic relaxed — busy days = ≥6h booked,
  Free/transparent events ignored). New storage bucket `canvas-images` (public, anon read/write).
- Supabase project: `xwuekcysigkujhyucugi`. GitHub: `dansbrandmoves/cap-collective-app`.

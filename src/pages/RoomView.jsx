import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useSearchParams, Link, useOutletContext } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/PageLoader'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'
import { Board } from '../components/project/Board'
import { Whiteboard } from '../components/project/Whiteboard'
import { ProjectOverview } from '../components/project/ProjectOverview'
import { WorkspaceTabs } from '../components/project/WorkspaceTabs'
import { useBoard } from '../hooks/useBoard'
import { useCanvas } from '../hooks/useCanvas'
import { useResizablePanel, ResizeHandle } from '../hooks/useResizablePanel'
import { projectKnownPeople } from '../utils/availability'
import { readCache, writeCache, clearCache } from '../utils/cache'
import { supabase } from '../utils/supabase'
import { loadGoogleIdentityServices, fetchCalendarEvents, isConfigured, connectGuestCalendarOffline, triggerGuestSync, disconnectGuestCalendar as disconnectGuestCalendarServer } from '../utils/googleCalendar'
import { isMsConfigured, connectGuestMicrosoftOffline, disconnectGuestMicrosoft } from '../utils/microsoftCalendar'
import { setSchedulingHint } from '../utils/scheduling'
import { CalendarDays, CheckCircle2, Menu, X, PanelLeft, Check, ChevronDown } from 'lucide-react'
import { startRun, STATUS } from '../utils/diag'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Growth-loop sign-in, shown as a modal right inside the room (no page bounce).
// Stores a pending join so the project follows the guest into their new account.
function JoinSignInModal({ isOpen, onClose, roomId, guestName, projectName, ownerName }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function rememberJoin() {
    try {
      localStorage.setItem('coordie-pending-join', JSON.stringify({ roomId, name: guestName || null }))
    } catch { /* best-effort */ }
  }

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    rememberJoin()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create your free Coordie" size="sm">
      <p className="text-sm text-zinc-400 leading-relaxed mb-1">
        Keep <span className="text-zinc-200 font-medium">{projectName || 'this project'}</span> in your own account
        {ownerName ? <> — everything {ownerName.split(' ')[0]} shared comes with you.</> : '.'}
      </p>
      <p className="text-xs text-zinc-600 leading-relaxed mb-5">
        Your board, whiteboard, and schedule stay exactly as they are. Free, no credit card.
      </p>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-50 text-zinc-900 font-medium text-sm rounded-xl px-4 py-3 transition-all duration-150 disabled:opacity-50 shadow-sm hover:shadow-md"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {loading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <button
        onClick={() => { rememberJoin(); window.location.href = '/signin' }}
        className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-4"
      >
        Use email instead
      </button>
    </Modal>
  )
}

function NamePrompt({ token, onConfirm, ownerLogo, ownerLogoDark, hostName, projectName }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const { theme } = useApp()
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canSubmit = name.trim() && emailValid
  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    localStorage.setItem(`room-identity-${token}`, name.trim())
    localStorage.setItem(`room-email-${token}`, email.trim())
    onConfirm(name.trim(), email.trim())
  }
  return (
    <div className="fixed inset-0 bg-surface-950 ambient-glow flex items-center justify-center z-50 px-6">
      <div className="bg-surface-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl px-8 py-10 w-full max-w-sm shadow-lift">
        <div className="flex items-center gap-3 mb-8">
          <img src="/coordie-logo.svg" alt="Coordie" className="h-6" style={{ filter: 'invert(1)' }} />
        </div>
        <h2 className="text-[24px] font-semibold text-zinc-50 tracking-tight leading-tight mb-2">Let’s find a day that works</h2>
        {(hostName || projectName) && (
          <p className="text-[13px] text-zinc-500 leading-relaxed mb-2">
            {hostName ? <>{hostName.split(' ')[0]} invited you</> : 'You’ve been invited'}
            {projectName ? <> to <span className="text-zinc-300 font-medium">{projectName}</span></> : null}.
          </p>
        )}
        <p className="text-[15px] text-zinc-400 leading-relaxed mb-7">Your name and email — so the team knows whose availability this is and can reach you about the meeting.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full bg-surface-800/70 border border-white/[0.06] rounded-xl px-4 py-3 text-[15px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all duration-200"
          />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full bg-surface-800/70 border border-white/[0.06] rounded-xl px-4 py-3 text-[15px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all duration-200"
          />
          <Button type="submit" disabled={!canSubmit} className="w-full mt-1">Continue →</Button>
          <p className="text-[12px] text-zinc-600 leading-relaxed">Your email is shared with the host only — used to send you the meeting invite.</p>
        </form>
      </div>
    </div>
  )
}

// Guest calendar panel — connects guest's Google Calendar so they can see their busy/free overlay in the views.
// `compact` drops the caption so it can live in the toolbar/tabs row without blocking the calendar.
function GuestCalendarPanel({ guestEvents, connected = false, onConnect, onDisconnect, ownerName, roomId, guestName, compact = false }) {
  const who = ownerName ? ownerName.split(' ')[0] : 'the team'
  const [gisReady, setGisReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const configured = isConfigured()

  useEffect(() => {
    if (!configured) return
    loadGoogleIdentityServices()
      .then(() => setGisReady(true))
      .catch(() => setError('Could not load Google Calendar.'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Offline (refresh-token) connect via the popup code client. The server stores
  // the refresh token and owns ongoing sync; here we also do an immediate read
  // for the guest's local busy overlay.
  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const { access_token } = await connectGuestCalendarOffline({ roomId, guestName })
      // Immediate local overlay (server will keep shared_availability fresh on its own).
      let events = []
      try {
        const timeMin = new Date()
        const timeMax = new Date()
        timeMax.setDate(timeMax.getDate() + 60)
        events = await fetchCalendarEvents(access_token, 'primary', timeMin, timeMax)
      } catch { /* overlay is best-effort; sync still runs server-side */ }
      setSchedulingHint('google')
      await onConnect(events)
    } catch (e) {
      // A deliberate popup close isn't an error — just reset the button.
      if (e?.message !== 'Connection cancelled.') setError(e?.message || 'Could not connect your calendar.')
    }
    setLoading(false)
  }

  // Outlook/Microsoft connect (popup). Server merges its busy with any Google
  // calendar the guest also connected — connect either or both.
  const msConfigured = isMsConfigured()
  async function handleConnectMicrosoft() {
    setLoading(true)
    setError(null)
    try {
      await connectGuestMicrosoftOffline({ roomId, guestName })
      setSchedulingHint('outlook')
      // No local overlay for MS — the server sync populates availability. Passing []
      // marks connected and triggers the (provider-merged) server sync.
      await onConnect([])
    } catch (e) {
      if (e?.message !== 'Connection cancelled.') setError(e?.message || 'Could not connect Outlook.')
    }
    setLoading(false)
  }

  // Show the connect UI as long as EITHER provider is configured.
  if (!configured && !msConfigured) return null

  // Connect affordance — compact (button only, for the toolbar) keeps it out of the
  // calendar's way; non-compact adds a one-line explainer. `connected` reflects
  // server truth (this guest has synced availability), so a refresh that cleared the
  // local session still shows the connected state instead of re-prompting.
  if (!connected) {
    // ONE primary action. When both providers are configured the choice between
    // Google and Outlook is a detail — disclosed on click, not competing up front.
    const both = configured && msConfigured
    const pick = (provider) => {
      setPickerOpen(false)
      if (provider === 'google') handleConnect()
      else handleConnectMicrosoft()
    }
    const onPrimary = () => {
      if (both) { setPickerOpen(o => !o); return }
      if (configured) handleConnect()
      else handleConnectMicrosoft()
    }
    return (
      <div className={compact ? 'relative inline-flex items-center gap-2' : 'mb-4 relative flex flex-col items-start gap-2.5'}>
        <Button
          onClick={onPrimary}
          disabled={loading || !guestName || (!both && configured && !gisReady)}
          size={compact ? 'sm' : undefined}
          className="justify-center flex-shrink-0"
          title="Highlights when you and the team are both free. Only free/busy is shared — never event details."
        >
          <CalendarDays size={15} strokeWidth={1.75} className="mr-2" />
          {loading ? 'Connecting…' : 'Connect calendar'}
          {both && !loading && <ChevronDown size={13} strokeWidth={2} className="ml-1.5 opacity-70" />}
        </Button>
        {pickerOpen && !loading && (
          <>
            <button className="fixed inset-0 z-20 cursor-default" aria-label="Close" onClick={() => setPickerOpen(false)} tabIndex={-1} />
            <div className="absolute top-full left-0 mt-2 z-30 min-w-[190px] bg-surface-900 border border-white/10 rounded-xl shadow-lift p-1.5 animate-fadeIn">
              <button onClick={() => pick('google')} disabled={!gisReady}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium text-zinc-200 hover:bg-white/[0.06] transition-colors disabled:opacity-50">
                Google Calendar
              </button>
              <button onClick={() => pick('microsoft')}
                className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium text-zinc-200 hover:bg-white/[0.06] transition-colors">
                Outlook / Microsoft
              </button>
            </div>
          </>
        )}
        {!compact && (
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-sm">
            So {who} can see when you&rsquo;re both free. Only your free/busy is shared — never event details.
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2 text-[12px] font-medium text-green-400 bg-green-500/[0.08] border border-green-500/20 rounded-full pl-2.5 pr-2 py-1.5 ${compact ? '' : 'mb-4'}`}>
      <CheckCircle2 size={14} strokeWidth={2} />
      <span className="hidden sm:inline">Calendar connected</span><span className="sm:hidden">Connected</span>
      <span className="text-zinc-600">·</span>
      <button onClick={onDisconnect} className="text-zinc-500 hover:text-zinc-300 transition-colors">Disconnect</button>
      {error && <span className="text-red-400 ml-1">{error}</span>}
    </div>
  )
}

function PersonChip({ name, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-[12px] font-medium border transition-colors ${
        active ? 'bg-accent/15 text-accent border-accent/25' : 'bg-white/[0.03] text-zinc-500 border-white/[0.07] hover:text-zinc-300'
      }`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${active ? 'bg-accent/25 text-accent' : 'bg-white/[0.06] text-zinc-400'}`}>
        {name[0]?.toUpperCase()}
      </span>
      {name}
    </button>
  )
}

export function RoomView() {
  const { token } = useParams()
  const { getProduction, getRoom, getMembersForRoom, addRoomMember, user, availabilityRules, effectiveSlots, slots: rawSlots, loading, refreshRoom, resolveToken, theme, businessHours, productions, calendarEvents, connectedCalendars, prefixRules } = useApp()
  // When a signed-in user opens a room, we're rendered inside AppShell (main nav).
  // openGlobalMenu opens that nav on mobile; null for account-less standalone guests.
  const outletCtx = useOutletContext()
  const openGlobalMenu = outletCtx?.openGlobalMenu
  const embedded = !!openGlobalMenu
  const [roomTab, setRoomTab] = useState('schedule') // 'schedule' | 'board'
  const [resolved, setResolved] = useState(null)
  const [resolving, setResolving] = useState(true)
  const [guestName, setGuestName] = useState(null)
  const [joinOpen, setJoinOpen] = useState(false)
  const [ownerLogo, setOwnerLogo] = useState(null)
  const [ownerLogoDark, setOwnerLogoDark] = useState(true)
  const [ownerName, setOwnerName] = useState(null)
  const [ownerEmail, setOwnerEmail] = useState(null)
  const [ownerCalendarEvents, setOwnerCalendarEvents] = useState([])
  const [ownerConnectedCalendars, setOwnerConnectedCalendars] = useState([])
  const [ownerGuestCalendarEnabled, setOwnerGuestCalendarEnabled] = useState(true)

  useEffect(() => {
    if (loading) return
    resolveToken(token).then(result => {
      setResolved(result)
      setResolving(false)
    })
  }, [token, loading, resolveToken])

  const production = resolved ? getProduction(resolved.productionId) : null
  // Project-level board (shared by everyone on the project). Hook runs every render
  // with a possibly-null id so the hook count stays stable before the early returns.
  const board = useBoard(resolved?.productionId)
  const canvas = useCanvas(resolved?.productionId, production?.ownerId)
  const boardPeople = useMemo(
    () => (resolved?.roomId ? getMembersForRoom(resolved.roomId) : []),
    [resolved?.roomId, getMembersForRoom]
  )
  // "Preview as guest" (?preview=guest) lets the signed-in owner see the exact
  // guest experience — force guest mode even though they own the project.
  const [searchParams] = useSearchParams()
  const previewAsGuest = searchParams.get('preview') === 'guest'
  const isOwner = !previewAsGuest && !!user && production?.ownerId === user.id

  // Guest calendar connect lives at the RoomView level so its control can sit in the
  // tabs row (out of the calendar's way). Server owns ongoing sync; we hold events
  // only to know connected/not, and trigger an immediate first sync on connect.
  const [guestEvents, setGuestEvents] = useState(() => readCache('coordie-gcal'))
  const connectGuestCalendar = useCallback(async (events) => {
    setGuestEvents(events)
    writeCache('coordie-gcal', events)
    const rid = resolved?.roomId
    if (!rid || !guestName) return
    const run = startRun('guest_connect_calendar', { actor: guestName, roomId: rid })
    run.step('connected via offline code client', STATUS.OK, { eventCount: events?.length ?? 0 })
    const { error } = await triggerGuestSync({ roomId: rid, guestName })
    run.finish(error ? STATUS.ERROR : STATUS.OK, error ? 'First server sync failed (cron will retry)' : `Connected ${guestName}`)
  }, [resolved?.roomId, guestName])
  const disconnectGuestCalendar = useCallback(async () => {
    setGuestEvents(null)
    clearCache('coordie-gcal')
    const rid = resolved?.roomId
    if (rid && guestName) {
      // Disconnect every provider this guest may have connected.
      const { error } = await disconnectGuestCalendarServer({ roomId: rid, guestName })
      if (error) console.error('[coordie] guest Google disconnect failed:', error.message)
      try { await disconnectGuestMicrosoft({ roomId: rid, guestName }) } catch { /* best-effort */ }
    }
  }, [resolved?.roomId, guestName])

  // ── Schedule data + people-select (lifted so the left sidebar owns the People filter) ──
  const [dateRequests, setDateRequests] = useState([])
  const [sharedAvailability, setSharedAvailability] = useState([])
  const [schedLoading, setSchedLoading] = useState(true)     // people/availability still loading
  const [excluded, setExcluded] = useState(() => new Set())
  const [includedOwner, setIncludedOwner] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)      // mobile drawer
  // Desktop: collapsible + drag-resizable, persisted — same as the main nav + project panel.
  const navPanel = useResizablePanel('coordie-room-nav', { defaultWidth: 288, min: 240, max: 420, side: 'right' })

  useEffect(() => {
    const rid = resolved?.roomId
    if (!rid) return
    const cacheKey = `coordie-sched-${rid}`
    // Stale-while-revalidate: paint last-known schedule instantly from cache, then
    // refresh from the server in the background. A refresh no longer shows an empty
    // sidebar while the network round-trips.
    const latest = { dateRequests: [], sharedAvailability: [] }
    const cached = readCache(cacheKey)
    if (cached) {
      latest.dateRequests = cached.dateRequests || []
      latest.sharedAvailability = cached.sharedAvailability || []
      setDateRequests(latest.dateRequests)
      setSharedAvailability(latest.sharedAvailability)
      setSchedLoading(false)   // we have something to show immediately
    } else {
      setSchedLoading(true)
    }
    const loadReq = () => supabase.from('date_requests').select('*').eq('room_id', rid)
      .then(({ data }) => { latest.dateRequests = data || []; setDateRequests(latest.dateRequests); writeCache(cacheKey, latest) })
    const loadAvail = () => supabase.from('shared_availability').select('*').eq('room_id', rid)
      .then(({ data }) => { latest.sharedAvailability = data || []; setSharedAvailability(latest.sharedAvailability); writeCache(cacheKey, latest) })
    Promise.all([loadReq(), loadAvail()]).finally(() => setSchedLoading(false))
    const channel = supabase
      .channel(`room-overlap-${rid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_requests', filter: `room_id=eq.${rid}` }, loadReq)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_availability', filter: `room_id=eq.${rid}` }, loadAvail)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [resolved?.roomId])

  const schedRoomId = resolved?.roomId
  const dateReqMap = useMemo(() => ({ [schedRoomId]: dateRequests }), [schedRoomId, dateRequests])
  const sharedMap = useMemo(() => ({ [schedRoomId]: sharedAvailability }), [schedRoomId, sharedAvailability])
  const knownGuests = useMemo(
    () => (production ? [...projectKnownPeople(production.rooms || [], dateReqMap, sharedMap)] : []),
    [production, dateReqMap, sharedMap]
  )

  // Use project-specific slots if configured, otherwise global
  const slots = useMemo(() => {
    const config = production?.availabilityConfig || production?.availability_config
    if (!config) return effectiveSlots
    if (config.mode === 'slots') return config.customSlots || rawSlots
    // Generate blocks from project business hours
    const schedule = config.businessHours?.schedule || {}
    let earliest = '23:59', latest = '00:00'
    for (const day of Object.values(schedule)) {
      if (!day) continue
      if (day.start < earliest) earliest = day.start
      if (day.end > latest) latest = day.end
    }
    if (earliest >= latest) return effectiveSlots
    const dur = config.blockDuration || 30
    const generated = []
    let [h, m] = earliest.split(':').map(Number)
    const endMins = latest.split(':').map(Number).reduce((a, b, i) => a + (i === 0 ? b * 60 : b), 0)
    while (h * 60 + m + dur <= endMins) {
      const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const te = h * 60 + m + dur
      const end = `${String(Math.floor(te / 60)).padStart(2, '0')}:${String(te % 60).padStart(2, '0')}`
      const period = h >= 12 ? 'PM' : 'AM'
      generated.push({ id: `block-${start}`, name: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`, startTime: start, endTime: end, color: '#22c55e', defaultState: 'available' })
      m += dur
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60 }
    }
    return generated
  }, [production, effectiveSlots, rawSlots])

  useEffect(() => {
    if (!production?.ownerId) return
    supabase.from('profiles').select('logo_url, logo_is_dark, connected_calendars, settings').eq('id', production.ownerId).single()
      .then(({ data }) => {
        setOwnerLogo(data?.logo_url || null)
        setOwnerLogoDark(data?.logo_is_dark ?? true)
        setOwnerName(data?.settings?.displayName || null)
        setOwnerEmail(data?.settings?.email || null)
        if (!isOwner && data?.connected_calendars?.length) {
          setOwnerConnectedCalendars(data.connected_calendars)
        }
        setOwnerGuestCalendarEnabled(data?.settings?.guestCalendarEnabled ?? true)
      })
  }, [production?.ownerId, isOwner])

  useEffect(() => {
    if (!production?.ownerId || isOwner) return
    const ownerId = production.ownerId
    const mapRow = e => ({ id: e.google_event_id || e.id, calendarId: e.calendar_id, title: e.title, start: e.start, end: e.end_at, isAllDay: e.is_all_day })
    // Stale-while-revalidate: paint the owner's last-known calendar from cache so the
    // overlap renders instantly on refresh, then revalidate against the server.
    const cacheKey = `coordie-ownercal-${ownerId}`
    const cached = readCache(cacheKey)
    if (Array.isArray(cached)) setOwnerCalendarEvents(cached)
    // Window to the scheduling horizon so the guest view loads fast (not every row).
    const ws = new Date(); ws.setDate(ws.getDate() - 7)
    const we = new Date(); we.setDate(we.getDate() + 120)
    const load = () => supabase.from('owner_calendar_events').select('*').eq('owner_id', ownerId)
      .gte('end_at', ws.toISOString()).lte('start', we.toISOString())
      .then(({ data }) => {
        const mapped = (data || []).map(mapRow)
        setOwnerCalendarEvents(mapped)
        writeCache(cacheKey, mapped)
      })
    load()
    // Live: when the owner's calendar changes (server sync), guests update too.
    const ch = supabase
      .channel(`owner-cal-guest-${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_calendar_events', filter: `owner_id=eq.${ownerId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [production?.ownerId, isOwner])

  useEffect(() => {
    if (!resolved) return
    if (isOwner) { setGuestName(null); return }
    // Signed-in member: identify by their account email (no name prompt) — this is
    // what makes an invited collaborator's project feel like "theirs" once they sign up.
    if (user?.email) {
      const mine = getMembersForRoom(resolved.roomId).find(m => (m.email || '').toLowerCase() === user.email.toLowerCase())
      if (mine?.name) { setGuestName(mine.name); return }
    }
    if (resolved.mode === 'invite_only') {
      setGuestName(resolved.memberName)
    } else {
      const stored = localStorage.getItem(`room-identity-${token}`)
      if (stored) setGuestName(stored)
    }
  }, [resolved, isOwner, token, user?.email, getMembersForRoom])

  useEffect(() => {
    if (!resolved) return
    const { productionId, roomId } = resolved
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_notes', filter: `room_id=eq.${roomId}` },
        () => refreshRoom(productionId, roomId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [resolved, refreshRoom])

  if (loading || resolving) {
    return <PageLoader full />
  }

  if (!resolved) {
    return (
      <div className="flex items-center justify-center h-dvh text-zinc-500 flex-col gap-3">
        <p>Link not found.</p>
        <p className="text-sm text-zinc-500">This link may be invalid or expired.</p>
      </div>
    )
  }

  const { productionId, roomId, mode } = resolved
  const room = getRoom(productionId, roomId)

  if (!production || !room) {
    // If productions state is empty, the Supabase fetch hasn't completed yet (or failed mid-load).
    // Show a loading state instead of the misleading "room gone" message — the production may arrive
    // a moment later once the query resolves. Previously this race caused valid rooms to flash
    // "unavailable" on slow mobile networks.
    if (productions.length === 0) {
      return <PageLoader full />
    }
    return (
      <div className="flex items-center justify-center h-dvh bg-surface-950 px-5">
        <div className="text-center max-w-sm">
          <p className="text-zinc-300 font-medium mb-2">This link is no longer available</p>
          <p className="text-sm text-zinc-600">The project it belonged to may have been removed. Contact the person who shared this link for an updated one.</p>
        </div>
      </div>
    )
  }

  // A guest must have an identity before they can contribute availability —
  // otherwise the write is attributed to nobody and silently no-ops (the
  // guestName-null skip the diagnostics caught). open_link guests are prompted
  // on first visit; invite_only guests normally get their name from the member
  // token, but if that didn't resolve (e.g. the shared open link was used for an
  // invite_only room) we fall back to the same prompt instead of a dead flow.
  if (!isOwner && !guestName) {
    // Joining via an open link now requires name + email. Record them as a room
    // member so the host has their email (for the meeting invite) and sees them.
    const handleGuestJoin = (name, email) => {
      setGuestName(name)
      const existing = getMembersForRoom(resolved.roomId).some(m => (m.email || '').toLowerCase() === (email || '').toLowerCase())
      if (resolved.roomId && name && !existing) {
        try { addRoomMember(resolved.roomId, { name, email }) } catch (e) { /* best-effort */ }
      }
    }
    return <NamePrompt token={token} onConfirm={handleGuestJoin} ownerLogo={ownerLogo} ownerLogoDark={ownerLogoDark}
      hostName={ownerName} projectName={production?.name} />
  }

  const effectiveCalendarEvents = isOwner ? calendarEvents : ownerCalendarEvents
  const effectiveConnectedCalendars = isOwner ? connectedCalendars : ownerConnectedCalendars
  const selfName = user?.user_metadata?.full_name || user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : 'You')
  const ownerDisplay = ownerName || 'Coordinator'
  // Show the real name as the primary label; "Coordinator" is a subtle subtitle, not a name.
  const ownerChipLabel = isOwner ? selfName : ownerDisplay
  const totalPeople = knownGuests.length + 1
  const toggleGuest = (name) => setExcluded(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })

  // Connected state is server truth (synced availability for this guest), not just
  // the local session — so a refresh doesn't wrongly re-prompt "Connect calendar".
  const guestCalendarConnected = guestEvents !== null
    || (!!guestName && sharedAvailability.some(a => a.guest_name === guestName))

  // Connect-first: the calendar column leads with the connect prompt (or, once
  // connected, a subtle disconnect pill). People filtering lives in the left sidebar.
  const connectSlot = (!isOwner && ownerGuestCalendarEnabled) ? (
    <div className="mb-6">
      <GuestCalendarPanel
        guestEvents={guestEvents}
        connected={guestCalendarConnected}
        onConnect={connectGuestCalendar}
        onDisconnect={disconnectGuestCalendar}
        ownerName={ownerName}
        roomId={roomId}
        guestName={guestName}
      />
    </div>
  ) : null

  return (
    <div className={`flex overflow-hidden bg-surface-950 ${embedded ? 'flex-1 min-h-0 self-stretch' : 'h-dvh'}`}>
      <JoinSignInModal
        isOpen={joinOpen}
        onClose={() => setJoinOpen(false)}
        roomId={resolved.roomId}
        guestName={guestName}
        projectName={production?.name}
        ownerName={ownerName}
      />
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Collapsed rail (desktop) — click to re-expand */}
      {navPanel.collapsed && (
        <div className="hidden md:flex flex-col items-center w-12 flex-shrink-0 bg-surface-900 border-r border-white/[0.06] py-4">
          <button onClick={() => navPanel.setCollapsed(false)} title="Expand panel"
            className="text-zinc-500 hover:text-zinc-100 transition-colors p-1.5 rounded-md hover:bg-surface-800">
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Left sidebar: branding + name + People filter. Drag the right edge to resize. */}
      <aside
        style={{ width: navPanel.width }}
        className={`fixed inset-y-0 left-0 z-30 max-w-[85vw] bg-surface-900 border-r border-white/[0.06] flex flex-col
        md:relative md:z-auto md:max-w-none md:translate-x-0
        ${navPanel.dragging ? '' : 'transition-transform duration-300 ease-ios'}
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${navPanel.collapsed ? 'md:hidden' : ''}`}>
        {!navPanel.collapsed && <ResizeHandle onPointerDown={navPanel.startDrag} onDoubleClick={navPanel.reset} side="right" dragging={navPanel.dragging} />}
        <div className="px-5 py-5 border-b border-white/[0.05]">
          <div className="flex items-center justify-end mb-3 gap-2 min-h-[20px]">
            {isOwner && <span className="mr-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">Owner</span>}
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-500 hover:text-zinc-200 p-1"><X size={16} /></button>
            <button onClick={() => navPanel.setCollapsed(true)} title="Collapse panel" className="hidden md:flex text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded p-1"><PanelLeft size={15} strokeWidth={1.75} /></button>
          </div>
          <h2 className="text-[15px] font-semibold text-zinc-50 leading-snug tracking-tight truncate">{production.name}</h2>
          {room.name && room.name !== production.name && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{room.name}</p>
          )}
          {isOwner ? (
            <Link to={`/project/${productionId}`} className="inline-flex items-center gap-1 mt-2 text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors">← Back to project</Link>
          ) : user ? (
            /* Signed-in member of a shared project: same "← Projects" back-nav owned
               projects get, so they can return to their dashboard. */
            <Link to="/" className="inline-flex items-center gap-1 mt-2 text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors">← Projects</Link>
          ) : null}
        </div>

        {/* People filter — toggle who counts toward the overlap */}
        <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
          <p className="px-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-2">People</p>
          {schedLoading ? (
            /* Loading: pulse skeleton rows until calendar data resolves — don't
               show people pre-checked before we actually know who's free. */
            <div className="space-y-1" aria-busy="true">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-2.5 px-2 py-2 animate-pulse">
                  <span className="w-7 h-7 rounded-full bg-white/[0.06] flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block h-3 rounded bg-white/[0.06]" style={{ width: `${70 - i * 12}%` }} />
                  </span>
                  <span className="w-5 h-5 rounded-full bg-white/[0.05] flex-shrink-0" />
                </div>
              ))}
              <p className="px-2 mt-1 text-[12px] text-zinc-600 leading-relaxed">Loading calendars…</p>
            </div>
          ) : (
            <>
              {[{ name: ownerChipLabel, active: includedOwner, toggle: () => setIncludedOwner(v => !v), sub: (!isOwner && !ownerName) ? null : (isOwner ? 'Coordinator · you' : 'Coordinator') },
                ...knownGuests.map(n => ({ name: n, active: !excluded.has(n), toggle: () => toggleGuest(n), sub: n === guestName ? 'you' : null }))
              ].map((p, i) => (
                <button key={i} onClick={p.toggle}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${p.active ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-zinc-500'}`}>
                    {p.name[0]?.toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13px] truncate ${p.active ? 'text-zinc-100' : 'text-zinc-500'}`}>{p.name}</span>
                    {p.sub && <span className="block text-[11px] text-zinc-600">{p.sub}</span>}
                  </span>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${p.active ? 'bg-accent border-accent text-white' : 'border-white/15 text-transparent'}`}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              ))}
              {knownGuests.length === 0 && (
                <p className="px-2 mt-1 text-[12px] text-zinc-600 leading-relaxed">As people connect their calendars, they’ll appear here.</p>
              )}
            </>
          )}
        </div>

        {/* Bottom of sidebar: a soft growth nudge for NOT-signed-in guests only (the
            project follows them in when they sign up). No "Powered by Coordie" for
            actual app users — that promo lives on the landing/booking pages only. */}
        {!user && (
          <div className="px-5 py-3 border-t border-white/[0.05]">
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="group w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-2 -mx-1 hover:bg-accent/[0.08] transition-colors">
              <span className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
                <img src="/coordie-logo.svg" alt="" className="h-3" style={{ filter: 'invert(1)' }} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-zinc-200 group-hover:text-white leading-tight">Create your free Coordie</span>
                <span className="block text-[11px] text-zinc-500 leading-tight">Keep this project — and start your own.</span>
              </span>
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        {/* Mobile top bar */}
        <div className="md:hidden relative z-20 flex items-center gap-2 px-3 py-3 border-b border-white/[0.05] bg-surface-900 flex-shrink-0 safe-top">
          {embedded && (
            <button onClick={openGlobalMenu} className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-white/5 transition-colors" aria-label="Open navigation">
              <Menu size={19} strokeWidth={1.75} />
            </button>
          )}
          <button onClick={() => setSidebarOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-white/5 transition-colors" aria-label={embedded ? 'Open project panel' : 'Open menu'}>
            {embedded ? <PanelLeft size={19} strokeWidth={1.75} /> : <Menu size={19} strokeWidth={1.75} />}
          </button>
          <span className="text-sm font-semibold text-zinc-100 flex-1 truncate tracking-tight">{production.name}</span>
        </div>

        {/* Floating tabs (lg) so the calendar + day inspector bleed to the top */}
        <WorkspaceTabs active={roomTab} onChange={setRoomTab} taskCount={board.tasks.length}
          className="px-5 sm:px-8 pt-4 sm:pt-5" />

        {roomTab === 'schedule' && (
          <ProjectOverview
            production={production}
            slots={slots}
            calendarEvents={effectiveCalendarEvents}
            connectedCalendars={effectiveConnectedCalendars}
            prefixRules={prefixRules}
            businessHours={production?.availability_config?.businessHours || businessHours}
            loading={false}
            dateRequestsByRoom={dateReqMap}
            sharedAvailByRoom={sharedMap}
            excluded={excluded}
            includedOwner={includedOwner}
            totalPeople={totalPeople}
            ownerLabel={isOwner ? undefined : ownerDisplay}
            ownerEmail={isOwner ? undefined : ownerEmail}
            viewerName={isOwner ? null : guestName}
            viewerEmail={isOwner ? null : (() => { try { return localStorage.getItem(`room-email-${token}`) } catch { return null } })()}
            floatingHeader
            headerSlot={connectSlot}
          />
        )}
        {roomTab === 'tasks' && (
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 sm:px-8 py-4 sm:py-6 lg:pt-[88px]">
            <Board
              columns={board.columns}
              tasksByColumn={board.tasksByColumn}
              people={boardPeople}
              projectId={resolved?.productionId}
              authorName={isOwner ? (ownerName || 'Owner') : guestName}
              assigneeDisplay={isOwner ? null : (n => n === 'You' ? ownerDisplay : n)}
              addColumn={board.addColumn}
              renameColumn={board.renameColumn}
              deleteColumn={board.deleteColumn}
              moveColumn={board.moveColumn}
              addTask={board.addTask}
              updateTask={board.updateTask}
              moveTask={board.moveTask}
              reorderTask={board.reorderTask}
              deleteTask={board.deleteTask}
            />
          </div>
        )}
        {roomTab === 'board' && (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <Whiteboard canvas={canvas} authorName={isOwner ? (ownerName || 'Owner') : guestName} />
          </div>
        )}
      </div>
    </div>
  )
}

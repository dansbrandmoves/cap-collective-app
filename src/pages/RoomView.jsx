import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'
import { supabase } from '../utils/supabase'
import { loadGoogleIdentityServices, fetchCalendarEvents, isConfigured, connectGuestCalendarOffline, triggerGuestSync, disconnectGuestCalendar as disconnectGuestCalendarServer } from '../utils/googleCalendar'
import { CalendarDays, CheckCircle2 } from 'lucide-react'
import { startRun, STATUS } from '../utils/diag'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function NamePrompt({ token, onConfirm, ownerLogo, ownerLogoDark }) {
  const [name, setName] = useState('')
  const { theme } = useApp()
  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    localStorage.setItem(`room-identity-${token}`, name.trim())
    onConfirm(name.trim())
  }
  return (
    <div className="fixed inset-0 bg-surface-950 ambient-glow flex items-center justify-center z-50 px-6">
      <div className="bg-surface-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl px-8 py-10 w-full max-w-sm shadow-lift">
        <div className="flex items-center gap-3 mb-8">
          {ownerLogo ? (
            <div className={`rounded-xl px-3 py-2 inline-flex ${ownerLogoDark ? 'bg-[#f0f0f0]' : 'bg-[#1a1a1e]'}`}>
              <img src={ownerLogo} alt="" className="max-h-7 max-w-[120px] object-contain" />
            </div>
          ) : (
            <img src="/coordie-logo.svg" alt="Coordie" className="h-6" style={{ filter: 'invert(1)' }} />
          )}
        </div>
        <h2 className="text-[24px] font-semibold text-zinc-50 tracking-tight leading-tight mb-2">Let’s find a day that works</h2>
        <p className="text-[15px] text-zinc-400 leading-relaxed mb-7">First, what’s your name? So the team knows whose availability this is.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full bg-surface-800/70 border border-white/[0.06] rounded-xl px-4 py-3 text-[15px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all duration-200"
          />
          <Button type="submit" disabled={!name.trim()} className="w-full">Continue →</Button>
        </form>
      </div>
    </div>
  )
}

// Guest calendar panel — connects guest's Google Calendar so they can see their busy/free overlay in the views
function GuestCalendarPanel({ guestEvents, onConnect, onDisconnect, ownerName, roomId, guestName }) {
  const who = ownerName ? ownerName.split(' ')[0] : 'the team'
  const [gisReady, setGisReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
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
      await onConnect(events)
    } catch (e) {
      setError(e?.message || 'Could not connect your calendar.')
    }
    setLoading(false)
  }

  if (!configured) return null

  if (guestEvents === null) {
    return (
      <div className="bg-gradient-to-b from-accent/[0.08] to-transparent border border-accent/20 rounded-2xl px-6 py-7 mb-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center mx-auto mb-4">
          <CalendarDays size={20} strokeWidth={1.75} className="text-accent" />
        </div>
        <p className="text-[17px] font-semibold text-zinc-50 tracking-tight mb-1.5">
          Connect your calendar — that’s it
        </p>
        <p className="text-[13px] text-zinc-400 leading-relaxed max-w-sm mx-auto mb-5">
          We’ll find the days you’re free and share them with {who} automatically. No form to fill out.
          Only free/busy is read — never your event titles or details.
        </p>
        <Button
          onClick={handleConnect}
          disabled={!gisReady || loading || !guestName}
          className="w-full sm:w-auto justify-center px-6"
        >
          <CalendarDays size={15} strokeWidth={1.75} className="mr-2" />
          Connect Google Calendar
        </Button>
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="border border-surface-700 rounded-xl px-5 py-4 mb-5 text-sm text-zinc-500">
        Loading your calendar...
      </div>
    )
  }

  return (
    <div className="bg-green-500/[0.07] border border-green-500/20 rounded-2xl px-5 py-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CheckCircle2 size={16} strokeWidth={2} className="text-green-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100 tracking-tight">Done — we found your free days</p>
          <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">
            {who.charAt(0).toUpperCase() + who.slice(1)} can see them now. Your busy times are dimmed below — nothing else to do.
          </p>
        </div>
        <button onClick={onDisconnect}
          className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0">
          Disconnect
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}

function AvailabilityTab({ isOwner, availabilityRules, roomId, guestName, slots, projectBusinessHours, guestSlotSelection, ownerCalendarEvents, ownerConnectedCalendars, ownerId, ownerName, guestCalendarEnabled }) {
  const { calendarEvents, connectedCalendars, prefixRules, createDateRequest, slotStates, businessHours } = useApp()
  const effectiveCalendarEvents = isOwner ? calendarEvents : ownerCalendarEvents
  const effectiveConnectedCalendars = isOwner ? connectedCalendars : ownerConnectedCalendars
  const [dateRequests, setDateRequests] = useState([])
  const [sharedAvailability, setSharedAvailability] = useState([])

  // Lifted guest calendar state — survives view switches and remounts
  const [guestEvents, setGuestEvents] = useState(() => {
    try { const s = sessionStorage.getItem('coordie-gcal'); return s ? JSON.parse(s) : null } catch (e) { return null }
  })
  // Calendar connect now goes through the offline (refresh-token) flow: the popup
  // code client stores a refresh token server-side, and the sync-guest-calendars
  // edge function owns writing shared_availability (and keeps it fresh on a 15-min
  // cron). Here we just hold the events for the guest's local busy overlay and
  // kick off an immediate first sync so they don't wait for the cron.
  async function connectGuestCalendar(events) {
    setGuestEvents(events)
    try { sessionStorage.setItem('coordie-gcal', JSON.stringify(events)) } catch (e) { /* */ }

    const run = startRun('guest_connect_calendar', { actor: guestName || 'unknown guest', roomId })
    run.step('connected via offline code client', STATUS.OK, { eventCount: events?.length ?? 0 })

    if (!roomId || !guestName) {
      run.step('aborted: missing identity', STATUS.SKIP, { roomId, guestName })
      run.finish(STATUS.SKIP, 'Skipped — missing roomId or guestName (guest may be viewing as owner)')
      return
    }

    // Trigger the server-side sync immediately; it derives free days in the
    // guest's timezone and writes shared_availability. Realtime updates the owner.
    const { error } = await triggerGuestSync({ roomId, guestName })
    if (error) {
      run.step('trigger server sync', STATUS.ERROR, { error: error.message })
      run.finish(STATUS.ERROR, 'Connected, but the first server sync failed (cron will retry)')
    } else {
      run.step('trigger server sync', STATUS.OK)
      run.finish(STATUS.OK, `Connected ${guestName} — server sync running`)
    }
  }
  async function disconnectGuestCalendar() {
    setGuestEvents(null)
    try { sessionStorage.removeItem('coordie-gcal') } catch (e) { /* */ }
    if (roomId && guestName) {
      const { error } = await disconnectGuestCalendarServer({ roomId, guestName })
      if (error) console.error('[coordie] guest disconnect failed:', error.message)
    }
  }

  useEffect(() => {
    if (!roomId) return
    supabase.from('date_requests').select('*').eq('room_id', roomId)
      .then(({ data }) => setDateRequests(data || []))
    supabase.from('shared_availability').select('*').eq('room_id', roomId)
      .then(({ data }) => setSharedAvailability(data || []))

    const channel = supabase
      .channel(`room-overlap-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_requests', filter: `room_id=eq.${roomId}` }, () => {
        supabase.from('date_requests').select('*').eq('room_id', roomId)
          .then(({ data }) => setDateRequests(data || []))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_availability', filter: `room_id=eq.${roomId}` }, () => {
        supabase.from('shared_availability').select('*').eq('room_id', roomId)
          .then(({ data }) => setSharedAvailability(data || []))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  return (
    <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-4 sm:py-6">
      {!isOwner && (
        <>
          {guestCalendarEnabled && (
            <GuestCalendarPanel
              guestEvents={guestEvents}
              onConnect={connectGuestCalendar}
              onDisconnect={disconnectGuestCalendar}
              ownerName={ownerName}
              roomId={roomId}
              guestName={guestName}
            />
          )}
          <p className="text-sm text-zinc-400 mb-4">
            {guestCalendarEnabled && guestEvents === null
              ? (guestSlotSelection
                  ? 'Or tap a date below to pick the time slots that work for you.'
                  : 'Or just tap the days you’re free below — no account needed.')
              : (guestSlotSelection
                  ? 'Tap a date to pick which time slots work for you.'
                  : 'Tap the days you’re free, then send them over.')}
          </p>
        </>
      )}
      <AvailabilityCalendar
        slots={slots}
        calendarEvents={effectiveCalendarEvents}
        connectedCalendars={effectiveConnectedCalendars}
        availabilityRules={availabilityRules}
        prefixRules={prefixRules}
        isOwner={isOwner}
        slotStates={slotStates}
        businessHours={projectBusinessHours || businessHours}
        guestSlotSelection={guestSlotSelection}
        roomId={roomId}
        guestName={guestName}
        ownerName={ownerName}
        onRequestSubmit={(rId, data) => createDateRequest(rId, { ...data, ownerId })}
        dateRequests={dateRequests}
        sharedAvailability={sharedAvailability}
        guestEvents={guestEvents}
      />
    </div>
  )
}

export function RoomView() {
  const { token } = useParams()
  const { getProduction, getRoom, user, availabilityRules, effectiveSlots, slots: rawSlots, loading, refreshRoom, resolveToken, theme, businessHours, productions } = useApp()
  const [resolved, setResolved] = useState(null)
  const [resolving, setResolving] = useState(true)
  const [guestName, setGuestName] = useState(null)
  const [ownerLogo, setOwnerLogo] = useState(null)
  const [ownerLogoDark, setOwnerLogoDark] = useState(true)
  const [ownerName, setOwnerName] = useState(null)
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
  const isOwner = !!user && production?.ownerId === user.id

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
    const load = () => supabase.from('owner_calendar_events').select('*').eq('owner_id', ownerId)
      .then(({ data }) => setOwnerCalendarEvents((data || []).map(mapRow)))
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
    if (resolved.mode === 'invite_only') {
      setGuestName(resolved.memberName)
    } else {
      const stored = localStorage.getItem(`room-identity-${token}`)
      if (stored) setGuestName(stored)
    }
  }, [resolved, isOwner, token])

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
    return <div className="flex items-center justify-center h-screen text-zinc-500">Loading...</div>
  }

  if (!resolved) {
    return (
      <div className="flex items-center justify-center h-screen text-zinc-500 flex-col gap-3">
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
      return <div className="flex items-center justify-center h-screen text-zinc-500">Loading...</div>
    }
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950 px-5">
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
    return <NamePrompt token={token} onConfirm={setGuestName} ownerLogo={ownerLogo} ownerLogoDark={ownerLogoDark} />
  }

  return (
    <div className="flex flex-col h-screen bg-surface-950">
      {/* Room header */}
      <div className="flex items-center justify-between px-5 sm:px-8 py-3.5 sm:py-4 border-b border-white/[0.06] bg-surface-900/80 backdrop-blur-xl safe-top">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {isOwner && (
            <Link to={`/project/${productionId}`} className="text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0 flex items-center gap-1">
              <span>←</span> <span className="hidden sm:inline">{production.name}</span><span className="sm:hidden">Back</span>
            </Link>
          )}
          {!isOwner && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {ownerLogo ? (
                <div className={`rounded-lg px-2 py-1 inline-flex ${ownerLogoDark ? 'bg-[#f0f0f0]' : 'bg-[#1a1a1e]'}`}>
                  <img src={ownerLogo} alt="" className="max-h-4 max-w-[80px] object-contain" />
                </div>
              ) : (
                <img src="/coordie-logo.svg" alt="Coordie" className="h-4" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
              )}
            </div>
          )}
          <div className="h-4 w-px bg-white/10 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-[15px] font-semibold text-zinc-100 truncate tracking-tight">{room.name}</span>
            <span className="text-zinc-600 mx-1.5 text-sm hidden sm:inline">·</span>
            <span className="text-[13px] text-zinc-500 hidden sm:inline truncate">{production.name}</span>
          </div>
        </div>
        {isOwner && (
          <span className="flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">Owner</span>
        )}
      </div>

      <AvailabilityTab
        isOwner={isOwner}
        availabilityRules={availabilityRules}
        roomId={roomId}
        guestName={guestName}
        slots={slots}
        projectBusinessHours={production?.availability_config?.businessHours}
        guestSlotSelection={production?.availability_config?.guestSlotSelection || false}
        ownerCalendarEvents={ownerCalendarEvents}
        ownerConnectedCalendars={ownerConnectedCalendars}
        ownerId={production?.ownerId}
        ownerName={ownerName}
        guestCalendarEnabled={ownerGuestCalendarEnabled}
      />

      {/* Footer */}
      {!isOwner && (
        <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-center safe-bottom-sm">
          <a href="https://coordie.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            <img src="/coordie-logo.svg" alt="" className="h-2.5" style={{ filter: 'invert(0.4)' }} />
            Powered by Coordie
          </a>
        </div>
      )}
    </div>
  )
}

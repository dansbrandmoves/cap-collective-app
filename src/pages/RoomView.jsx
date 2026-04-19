import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'
import { supabase } from '../utils/supabase'
import { loadGoogleIdentityServices, fetchCalendarEvents, isConfigured } from '../utils/googleCalendar'
import { CalendarDays, CheckCircle2 } from 'lucide-react'
import { GoogleOAuthGuide } from '../components/ui/GoogleOAuthGuide'

const TABS = ['Availability', 'Notes']
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
        <h2 className="text-[24px] font-semibold text-zinc-50 tracking-tight leading-tight mb-2">What's your name?</h2>
        <p className="text-[15px] text-zinc-400 leading-relaxed mb-7">So the team knows who they're talking to.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full bg-surface-800/70 border border-white/[0.06] rounded-xl px-4 py-3 text-[15px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all duration-200"
          />
          <Button type="submit" disabled={!name.trim()} className="w-full">Enter Room →</Button>
        </form>
      </div>
    </div>
  )
}

function NotesTab({ productionId, group, guestName }) {
  const { updateSharedNotes } = useApp()
  const [value, setValue] = useState(group.room.sharedNotes)
  const [saved, setSaved] = useState(true)
  const timerRef = useRef(null)
  const pendingRef = useRef(false)

  useEffect(() => {
    if (!pendingRef.current) setValue(group.room.sharedNotes)
  }, [group.room.sharedNotes])

  function handleChange(e) {
    setValue(e.target.value)
    setSaved(false)
    pendingRef.current = true
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      updateSharedNotes(productionId, group.id, e.target.value)
      setSaved(true)
      pendingRef.current = false
    }, 800)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 sm:px-8 py-3 border-b border-surface-700">
        <p className="text-sm text-zinc-500">Shared notes — both sides can edit</p>
        <span className={`text-xs transition-opacity ${saved ? 'text-zinc-600' : 'text-accent'}`}>
          {saved ? 'Saved' : 'Saving...'}
        </span>
      </div>
      <div className="flex-1 overflow-hidden px-5 sm:px-8 py-4 sm:py-6">
        <textarea
          value={value}
          onChange={handleChange}
          className="w-full h-full bg-transparent text-sm text-zinc-200 leading-relaxed resize-none focus:outline-none font-mono placeholder-zinc-700"
          placeholder="Start typing shared notes..."
          spellCheck={false}
        />
      </div>
    </div>
  )
}

// Guest calendar panel — connects guest's Google Calendar so they can see their busy/free overlay in the views
function GuestCalendarPanel({ guestEvents, onConnect, onDisconnect }) {
  const [gisReady, setGisReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showGuide, setShowGuide] = useState(false)
  const tokenClientRef = useRef(null)
  const configured = isConfigured()

  useEffect(() => {
    if (!configured) return
    loadGoogleIdentityServices()
      .then(() => {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          callback: handleTokenResponse,
        })
        setGisReady(true)
      })
      .catch(() => setError('Could not load Google Calendar.'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTokenResponse(tokenResponse) {
    if (tokenResponse.error) { setError('Sign-in failed.'); return }
    setLoading(true)
    setError(null)
    try {
      const timeMin = new Date()
      const timeMax = new Date()
      timeMax.setDate(timeMax.getDate() + 60)
      const events = await fetchCalendarEvents(tokenResponse.access_token, 'primary', timeMin, timeMax)
      onConnect(events)
    } catch (e) {
      setError('Could not fetch calendar events.')
    }
    setLoading(false)
  }

  if (!configured) return null

  if (guestEvents === null) {
    return (
      <>
        {showGuide && (
          <GoogleOAuthGuide
            onConfirm={() => { setShowGuide(false); tokenClientRef.current?.requestAccessToken() }}
            onCancel={() => setShowGuide(false)}
          />
        )}
        <div className="border border-dashed border-white/10 rounded-2xl px-5 py-4 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CalendarDays size={15} strokeWidth={1.75} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100 mb-0.5 tracking-tight">Spot your free time at a glance</p>
                <p className="text-xs text-zinc-400 leading-relaxed">We'll dim slots where you're already busy so you can pick dates and times that actually work. Only free/busy is read &mdash; never event details, and nothing leaves your browser.</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowGuide(true)}
              disabled={!gisReady || loading}
              className="flex-shrink-0 self-start sm:self-auto"
            >
              <CalendarDays size={13} strokeWidth={1.75} className="mr-1.5" />
              Connect Calendar
            </Button>
          </div>
        </div>
      </>
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
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <div className="flex items-center gap-1.5 text-[11px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5">
        <CheckCircle2 size={11} strokeWidth={2} />
        Your calendar connected — busy times dimmed below
      </div>
      <button onClick={onDisconnect}
        className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors ml-auto">
        Disconnect
      </button>
      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </div>
  )
}

function AvailabilityTab({ isOwner, availabilityRules, groupId, guestName, slots, projectBusinessHours, guestSlotSelection, ownerCalendarEvents, ownerConnectedCalendars, ownerId, guestCalendarEnabled }) {
  const { calendarEvents, connectedCalendars, prefixRules, createDateRequest, slotStates, businessHours } = useApp()
  const effectiveCalendarEvents = isOwner ? calendarEvents : ownerCalendarEvents
  const effectiveConnectedCalendars = isOwner ? connectedCalendars : ownerConnectedCalendars
  const [dateRequests, setDateRequests] = useState([])
  const [sharedAvailability, setSharedAvailability] = useState([])

  // Lifted guest calendar state — survives view switches and remounts
  const [guestEvents, setGuestEvents] = useState(() => {
    try { const s = sessionStorage.getItem('coordie-gcal'); return s ? JSON.parse(s) : null } catch (e) { return null }
  })
  function connectGuestCalendar(events) {
    setGuestEvents(events)
    try { sessionStorage.setItem('coordie-gcal', JSON.stringify(events)) } catch (e) { /* */ }
  }
  function disconnectGuestCalendar() {
    setGuestEvents(null)
    try { sessionStorage.removeItem('coordie-gcal') } catch (e) { /* */ }
  }

  // Fetch overlap data so the calendar can show who's free at a glance
  useEffect(() => {
    if (!groupId) return
    supabase.from('date_requests').select('*').eq('group_id', groupId)
      .then(({ data }) => setDateRequests(data || []))
    supabase.from('shared_availability').select('*').eq('group_id', groupId)
      .then(({ data }) => setSharedAvailability(data || []))

    // Live updates when guests share new availability
    const channel = supabase
      .channel(`room-overlap-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_requests', filter: `group_id=eq.${groupId}` }, () => {
        supabase.from('date_requests').select('*').eq('group_id', groupId)
          .then(({ data }) => setDateRequests(data || []))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_availability', filter: `group_id=eq.${groupId}` }, () => {
        supabase.from('shared_availability').select('*').eq('group_id', groupId)
          .then(({ data }) => setSharedAvailability(data || []))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [groupId])

  return (
    <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-4 sm:py-6">
      {!isOwner && (
        <>
          {guestCalendarEnabled && (
            <GuestCalendarPanel
              guestEvents={guestEvents}
              onConnect={connectGuestCalendar}
              onDisconnect={disconnectGuestCalendar}
            />
          )}
          <p className="text-sm text-zinc-400 mb-4">
            {guestSlotSelection ? 'Tap a date to pick which time slots work for you.' : 'Tap dates to select them, then send a request.'}
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
        groupId={groupId}
        guestName={guestName}
        onRequestSubmit={(gId, data) => createDateRequest(gId, { ...data, ownerId })}
        dateRequests={dateRequests}
        sharedAvailability={sharedAvailability}
        guestEvents={guestEvents}
      />
    </div>
  )
}

export function RoomView() {
  const { token } = useParams()
  const { getProduction, getGroup, user, availabilityRules, effectiveSlots, slots: rawSlots, loading, refreshRoom, resolveToken, theme, businessHours } = useApp()
  const [activeTab, setActiveTab] = useState('Availability')
  const [resolved, setResolved] = useState(null)
  const [resolving, setResolving] = useState(true)
  const [guestName, setGuestName] = useState(null)
  const [ownerLogo, setOwnerLogo] = useState(null)
  const [ownerLogoDark, setOwnerLogoDark] = useState(true)
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
        if (!isOwner && data?.connected_calendars?.length) {
          setOwnerConnectedCalendars(data.connected_calendars)
        }
        setOwnerGuestCalendarEnabled(data?.settings?.guestCalendarEnabled ?? true)
      })
  }, [production?.ownerId, isOwner])

  useEffect(() => {
    if (!production?.ownerId || isOwner) return
    supabase.from('owner_calendar_events').select('*').eq('owner_id', production.ownerId)
      .then(({ data }) => {
        if (data?.length) {
          setOwnerCalendarEvents(data.map(e => ({
            id: e.id,
            calendarId: e.calendar_id,
            title: e.title,
            start: e.start,
            end: e.end_at,
            isAllDay: e.is_all_day,
          })))
        }
      })
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
    const { productionId, groupId } = resolved
    const channel = supabase
      .channel(`room-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_notes', filter: `group_id=eq.${groupId}` },
        () => refreshRoom(productionId, groupId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [resolved, refreshRoom])

  if (loading || resolving) {
    return <div className="flex items-center justify-center h-screen text-zinc-500">Loading room...</div>
  }

  if (!resolved) {
    return (
      <div className="flex items-center justify-center h-screen text-zinc-500 flex-col gap-3">
        <p>Room not found.</p>
        <p className="text-sm text-zinc-500">This link may be invalid or expired.</p>
      </div>
    )
  }

  const { productionId, groupId, mode } = resolved
  const group = getGroup(productionId, groupId)

  if (!production || !group) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950 px-5">
        <div className="text-center max-w-sm">
          <p className="text-zinc-300 font-medium mb-2">This room is no longer available</p>
          <p className="text-sm text-zinc-600">The project it belonged to may have been removed. Contact the person who shared this link for an updated one.</p>
        </div>
      </div>
    )
  }

  if (!isOwner && mode === 'open_link' && !guestName) {
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
            <span className="text-[15px] font-semibold text-zinc-100 truncate tracking-tight">{group.name}</span>
            <span className="text-zinc-600 mx-1.5 text-sm hidden sm:inline">·</span>
            <span className="text-[13px] text-zinc-500 hidden sm:inline truncate">{production.name}</span>
          </div>
        </div>
        {isOwner && (
          <span className="flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">Owner</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-5 sm:px-8 border-b border-white/[0.06] bg-surface-900/60 backdrop-blur-sm">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`min-h-touch px-4 py-3 text-[13px] font-medium transition-colors border-b-2 tracking-tight ${
              activeTab === tab ? 'border-accent text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Notes' && (
        <NotesTab productionId={productionId} group={group} guestName={guestName} />
      )}
      {activeTab === 'Availability' && (
        <AvailabilityTab
          isOwner={isOwner}
          availabilityRules={availabilityRules}
          groupId={groupId}
          guestName={guestName}
          slots={slots}
          projectBusinessHours={production?.availability_config?.businessHours}
          guestSlotSelection={production?.availability_config?.guestSlotSelection || false}
          ownerCalendarEvents={ownerCalendarEvents}
          ownerConnectedCalendars={ownerConnectedCalendars}
          ownerId={production?.ownerId}
          guestCalendarEnabled={ownerGuestCalendarEnabled}
        />
      )}

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

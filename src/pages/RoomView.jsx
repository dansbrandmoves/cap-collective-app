import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'
import { supabase } from '../utils/supabase'
import { loadGoogleIdentityServices, fetchCalendarEvents, isConfigured } from '../utils/googleCalendar'
import { deriveSlotState, dateToStr } from '../utils/availability'
import { CalendarDays, X, CheckCircle2, CircleDot, Share2 } from 'lucide-react'

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl px-8 py-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          {ownerLogo ? (
            <div className={`rounded-lg px-2.5 py-1.5 inline-flex ${ownerLogoDark ? 'bg-[#f0f0f0]' : 'bg-[#1a1a1e]'}`}>
              <img src={ownerLogo} alt="" className="max-h-6 max-w-[100px] object-contain" />
            </div>
          ) : (
            <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: 'invert(1)' }} />
          )}
        </div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">What's your name?</h2>
        <p className="text-sm text-zinc-500 mb-6">So the team knows who they're talking to.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full bg-surface-800 border border-surface-600 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
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

// Guest calendar panel — lets guest connect their Google Calendar and see their free dates
function GuestCalendarPanel({ slots, groupId, guestName: guestNameProp }) {
  const [gisReady, setGisReady] = useState(false)
  const [guestEvents, setGuestEvents] = useState(null) // null = not connected yet
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [shared, setShared] = useState(false)
  const [sharing, setSharing] = useState(false)
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
      setGuestEvents(events)
    } catch {
      setError('Could not fetch calendar events.')
    }
    setLoading(false)
  }

  // Find dates in the next 60 days where the guest has no events during slot hours
  const freeDates = useMemo(() => {
    if (!guestEvents || !slots.length) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const result = []
    const guestCals = [{ googleCalendarId: 'primary', role: 'governs', defaultState: 'booked' }]
    const guestEventsTagged = guestEvents.map(e => ({ ...e, calendarId: 'primary' }))

    for (let i = 1; i < 60; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      // Guest is free if they have no conflicting events in ANY of the slots
      const hasFreeSlot = slots.some(slot => {
        const { state } = deriveSlotState(date, slot, guestEventsTagged, guestCals, [])
        return state === 'available'
      })
      if (hasFreeSlot) result.push(date)
    }
    return result.slice(0, 30)
  }, [guestEvents, slots])

  if (!configured) return null

  if (guestEvents === null) {
    return (
      <div className="border border-dashed border-surface-600 rounded-xl px-5 py-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-800 border border-surface-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CalendarDays size={15} strokeWidth={1.75} className="text-zinc-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-0.5">See your availability</p>
            <p className="text-xs text-zinc-500">Connect your Google Calendar to see which days you're free.</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => tokenClientRef.current?.requestAccessToken()}
          disabled={!gisReady || loading}
          className="flex-shrink-0 self-start sm:self-auto"
        >
          <CalendarDays size={13} strokeWidth={1.75} className="mr-1.5" />
          Connect Calendar
        </Button>
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
    <div className="bg-surface-900 border border-surface-700 rounded-xl px-5 py-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} strokeWidth={1.75} className="text-zinc-400" />
          <p className="text-sm font-medium text-zinc-200">Your free days (next 60 days)</p>
        </div>
        <button
          onClick={() => setGuestEvents(null)}
          className="p-1 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label="Disconnect calendar"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {freeDates.length === 0 ? (
        <p className="text-sm text-zinc-500">No free days found in the next 60 days based on your primary calendar.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
          {freeDates.map(date => (
            <div key={dateToStr(date)} className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={13} strokeWidth={1.75} className="text-green-500 flex-shrink-0" />
              <span className="text-zinc-300">
                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
      {freeDates.length > 0 && !shared && (
        <button onClick={async () => {
          if (!guestNameProp || !groupId) return
          setSharing(true)
          try {
            const rows = freeDates.map(d => ({
              group_id: groupId,
              guest_name: guestNameProp,
              date: dateToStr(d),
              is_available: true,
            }))
            await supabase.from('shared_availability').delete()
              .eq('group_id', groupId).eq('guest_name', guestNameProp)
            await supabase.from('shared_availability').insert(rows)
            setShared(true)
          } catch { /* ignore */ }
          setSharing(false)
        }} disabled={sharing}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-accent hover:text-amber-400 bg-accent/10 hover:bg-accent/15 border border-accent/20 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
          <Share2 size={12} strokeWidth={1.75} />
          {sharing ? 'Sharing...' : 'Share availability with this project'}
        </button>
      )}
      {shared && (
        <p className="mt-3 text-xs text-green-400 flex items-center gap-1.5">
          <CheckCircle2 size={12} strokeWidth={1.75} />
          Your availability has been shared with the project manager.
        </p>
      )}
      <p className="text-xs text-zinc-600 mt-2">Based on your Google primary calendar.</p>
    </div>
  )
}

function AvailabilityTab({ isOwner, availabilityRules, groupId, guestName, slots, projectBusinessHours }) {
  const { calendarEvents, connectedCalendars, prefixRules, createDateRequest, slotStates, guestCalendarEnabled, businessHours } = useApp()
  return (
    <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-4 sm:py-6">
      {!isOwner && (
        <>
          {guestCalendarEnabled && <GuestCalendarPanel slots={slots} groupId={groupId} guestName={guestName} />}
          <p className="text-sm text-zinc-400 mb-4">Tap dates to select them, then send a request.</p>
        </>
      )}
      <AvailabilityCalendar
        slots={slots}
        calendarEvents={calendarEvents}
        connectedCalendars={connectedCalendars}
        availabilityRules={availabilityRules}
        prefixRules={prefixRules}
        isOwner={isOwner}
        slotStates={slotStates}
        businessHours={projectBusinessHours || businessHours}
        groupId={groupId}
        guestName={guestName}
        onRequestSubmit={createDateRequest}
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
    supabase.from('profiles').select('logo_url, logo_is_dark').eq('id', production.ownerId).single()
      .then(({ data }) => { setOwnerLogo(data?.logo_url || null); setOwnerLogoDark(data?.logo_is_dark ?? true) })
  }, [production?.ownerId])

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
    return <div className="flex items-center justify-center h-screen text-zinc-500">Room not found.</div>
  }

  if (!isOwner && mode === 'open_link' && !guestName) {
    return <NamePrompt token={token} onConfirm={setGuestName} ownerLogo={ownerLogo} ownerLogoDark={ownerLogoDark} />
  }

  return (
    <div className="flex flex-col h-screen bg-surface-950">
      {/* Room header */}
      <div className="flex items-center justify-between px-5 sm:px-8 py-3 sm:py-4 border-b border-surface-700 bg-surface-900">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {isOwner && (
            <Link to={`/project/${productionId}`} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
              ← <span className="hidden sm:inline">{production.name}</span><span className="sm:hidden">Back</span>
            </Link>
          )}
          {!isOwner && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {ownerLogo ? (
                <div className={`rounded-md px-2 py-1 inline-flex ${ownerLogoDark ? 'bg-[#f0f0f0]' : 'bg-[#1a1a1e]'}`}>
                  <img src={ownerLogo} alt="" className="max-h-4 max-w-[80px] object-contain" />
                </div>
              ) : (
                <img src="/coordie-logo.svg" alt="Coordie" className="h-4" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
              )}
            </div>
          )}
          <div className="h-4 w-px bg-surface-700 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-semibold text-zinc-100 truncate">{group.name}</span>
            <span className="text-zinc-600 mx-1.5 text-sm hidden sm:inline">·</span>
            <span className="text-sm text-zinc-500 hidden sm:inline truncate">{production.name}</span>
          </div>
        </div>
        {isOwner && <Badge variant="ghost" className="flex-shrink-0">Owner</Badge>}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-5 sm:px-8 border-b border-surface-700 bg-surface-900">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab ? 'border-accent text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
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
        />
      )}

      {/* Footer */}
      {!isOwner && (
        <div className="px-5 py-3 border-t border-surface-800 flex items-center justify-center">
          <a href="https://coordie.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors">
            <img src="/coordie-logo.svg" alt="" className="h-2.5" style={{ filter: 'invert(0.4)' }} />
            Powered by Coordie
          </a>
        </div>
      )}
    </div>
  )
}

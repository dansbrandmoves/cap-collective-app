import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'
import { supabase } from '../utils/supabase'
import { loadGoogleIdentityServices, fetchCalendarEvents, isConfigured } from '../utils/googleCalendar'
import { deriveSlotState, dateToStr } from '../utils/availability'
import { CalendarDays, X, CheckCircle2, CircleDot, Share2, MousePointer2, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'

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

// Animated step-by-step guide shown before Google OAuth to set expectations
function GoogleOAuthGuide({ onConfirm, onCancel }) {
  const [step, setStep] = useState(0) // 0 = step 1 (Advanced), 1 = step 2 (Go to)
  const [phase, setPhase] = useState('idle') // idle → moving → clicking → done

  // Sequence: show cursor → bob → click → advance
  useEffect(() => {
    let t1, t2, t3
    setPhase('idle')
    t1 = setTimeout(() => setPhase('moving'), 400)
    t2 = setTimeout(() => setPhase('clicking'), 1800)
    t3 = setTimeout(() => {
      if (step === 0) { setStep(1); }
      else { setPhase('done') }
    }, 2600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [step])

  const STEP_DURATION = 2600

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full sm:max-w-[420px] bg-surface-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-sheet overflow-hidden animate-slideUp">

        {/* Progress bar */}
        <div className="h-[2px] bg-white/5">
          <div
            key={step}
            className="h-full bg-accent animate-progress-fill"
            style={{ animationDuration: `${STEP_DURATION}ms` }}
          />
        </div>

        <div className="px-6 pt-5 pb-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <ShieldAlert size={14} strokeWidth={1.75} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100 tracking-tight">What you'll see next</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Google shows a security screen — here's what to click</p>
              </div>
            </div>
            <button onClick={onCancel} className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors mt-0.5">
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mb-5 pl-10">
            {[0, 1].map(i => (
              <div key={i} className={`rounded-full transition-all duration-300 ${i === step ? 'w-4 h-1.5 bg-accent' : 'w-1.5 h-1.5 bg-white/15'}`} />
            ))}
          </div>

          {/* Google screen mockup */}
          <div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-xl mb-5">
            {/* Google's UI — white card */}
            <div className="bg-white px-5 pt-5 pb-4">
              {/* Google logo row */}
              <div className="flex items-center gap-1 mb-4">
                <span style={{ fontFamily: 'Product Sans, system-ui, sans-serif', fontSize: 20 }}>
                  <span style={{ color: '#4285F4' }}>G</span><span style={{ color: '#EA4335' }}>o</span><span style={{ color: '#FBBC05' }}>o</span><span style={{ color: '#4285F4' }}>g</span><span style={{ color: '#34A853' }}>l</span><span style={{ color: '#EA4335' }}>e</span>
                </span>
              </div>

              <p className="text-[11px] text-gray-600 mb-0.5 leading-snug">coordie.com wants to access your Google Account</p>

              {/* Warning badge */}
              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3 mt-2">
                <span className="text-yellow-500 text-sm leading-none mt-0.5">⚠</span>
                <p className="text-[11px] text-gray-700 leading-snug font-medium">Google hasn't verified this app</p>
              </div>

              <p className="text-[10px] text-gray-500 leading-snug mb-4">
                The app is requesting access to sensitive info in your Google Account. Only proceed if you trust the developer.
              </p>

              {/* Back to safety button */}
              <div className="w-full py-2 bg-blue-600 rounded-md text-center text-[11px] text-white font-medium mb-3">
                Back to safety
              </div>

              {/* Advanced section */}
              {step === 0 ? (
                <div className="relative">
                  <div className={`inline-flex items-center gap-1 text-blue-600 text-[11px] font-medium cursor-pointer rounded px-1 py-0.5 transition-all ${phase !== 'idle' ? 'bg-blue-50' : ''}`}>
                    <ChevronDown size={11} />
                    <span>Advanced</span>
                  </div>
                  {/* Pulse ring on the Advanced link */}
                  {phase !== 'idle' && (
                    <div className="absolute left-0 top-0 -inset-0.5 rounded animate-pulse-ring pointer-events-none" />
                  )}
                  {/* Animated cursor */}
                  <div className={`absolute left-6 transition-all duration-500 ${phase === 'idle' ? 'top-6 opacity-0' : phase === 'clicking' ? 'top-0.5 opacity-100' : 'top-2 opacity-100'}`}>
                    <MousePointer2
                      size={18}
                      strokeWidth={1.5}
                      className={`text-gray-800 drop-shadow ${phase === 'clicking' ? 'animate-cursor-bob' : ''}`}
                      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="inline-flex items-center gap-1 text-blue-600 text-[11px] font-medium cursor-pointer rounded px-1 py-0.5 mb-2">
                    <ChevronUp size={11} />
                    <span>Advanced</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-snug mb-2">
                    coordie.com has not been verified by Google yet. Only proceed if you understand the risks.
                  </p>
                  {/* "Go to coordie.com (unsafe)" */}
                  <div className="relative">
                    <p className={`text-blue-600 text-[11px] underline font-medium cursor-pointer rounded px-1 py-0.5 inline-block transition-all ${phase !== 'idle' ? 'bg-blue-50' : ''}`}>
                      Go to coordie.com (unsafe)
                    </p>
                    {phase !== 'idle' && (
                      <div className="absolute left-0 top-0 -inset-0.5 rounded animate-pulse-ring pointer-events-none" />
                    )}
                    {/* Cursor */}
                    <div className={`absolute left-44 transition-all duration-500 ${phase === 'idle' ? 'top-6 opacity-0' : phase === 'clicking' ? 'top-0.5 opacity-100' : 'top-2 opacity-100'}`}>
                      <MousePointer2
                        size={18}
                        strokeWidth={1.5}
                        className={`text-gray-800 ${phase === 'clicking' ? 'animate-cursor-bob' : ''}`}
                        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step label overlay */}
            <div className="bg-surface-800 border-t border-white/8 px-4 py-2.5 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-accent">{step + 1}</span>
              </div>
              <p className="text-[11px] text-zinc-300 font-medium">
                {step === 0 ? 'Click "Advanced" at the bottom of Google\'s screen' : 'Then click "Go to coordie.com (unsafe)"'}
              </p>
            </div>
          </div>

          {/* Trust note */}
          <p className="text-[11px] text-zinc-500 leading-relaxed mb-5 text-center">
            This screen appears because Coordie is pending Google's 4-week verification. Your calendar data never leaves your device.
          </p>

          {/* CTA */}
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Got it — connect my calendar
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 mt-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// Guest calendar panel — lets guest connect their Google Calendar and see their free dates
function GuestCalendarPanel({ slots, groupId, guestName: guestNameProp, ownerId }) {
  const [gisReady, setGisReady] = useState(false)
  const [guestEvents, setGuestEvents] = useState(null) // null = not connected yet
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [shared, setShared] = useState(false)
  const [sharing, setSharing] = useState(false)
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
                <p className="text-sm font-semibold text-zinc-100 mb-0.5 tracking-tight">See overlap instantly</p>
                <p className="text-xs text-zinc-400 leading-relaxed">Connect your calendar to highlight days that work for both of you. Only free/busy is read &mdash; never event details.</p>
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
            if (ownerId) {
              supabase.functions.invoke('notify-shared-availability', {
                body: { guestName: guestNameProp, ownerId, groupId, dates: rows.map(r => r.date) },
              }).catch(() => {})
            }
          } catch (e) { /* ignore */ }
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

function AvailabilityTab({ isOwner, availabilityRules, groupId, guestName, slots, projectBusinessHours, guestSlotSelection, ownerCalendarEvents, ownerConnectedCalendars, ownerId }) {
  const { calendarEvents, connectedCalendars, prefixRules, createDateRequest, slotStates, guestCalendarEnabled, businessHours } = useApp()
  const effectiveCalendarEvents = isOwner ? calendarEvents : ownerCalendarEvents
  const effectiveConnectedCalendars = isOwner ? connectedCalendars : ownerConnectedCalendars
  const [dateRequests, setDateRequests] = useState([])
  const [sharedAvailability, setSharedAvailability] = useState([])

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
          {guestCalendarEnabled && <GuestCalendarPanel slots={slots} groupId={groupId} guestName={guestName} ownerId={ownerId} />}
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
    supabase.from('profiles').select('logo_url, logo_is_dark, connected_calendars').eq('id', production.ownerId).single()
      .then(({ data }) => {
        setOwnerLogo(data?.logo_url || null)
        setOwnerLogoDark(data?.logo_is_dark ?? true)
        if (!isOwner && data?.connected_calendars?.length) {
          setOwnerConnectedCalendars(data.connected_calendars)
        }
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

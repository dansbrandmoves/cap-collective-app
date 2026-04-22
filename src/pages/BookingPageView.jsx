import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { getMonthGrid, dateToStr, eventOverlapsSlot } from '../utils/availability'
import { supabase } from '../utils/supabase'
import { loadGoogleIdentityServices, fetchCalendarEvents, isConfigured } from '../utils/googleCalendar'
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, CalendarDays, X } from 'lucide-react'
import { GoogleOAuthGuide } from '../components/ui/GoogleOAuthGuide'

// iOS system motion curve
const IOS_EASE = [0.32, 0.72, 0, 1]

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function generateTimeSlots(start, end, duration) {
  const slots = []
  let [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const endMins = eh * 60 + em
  while (sh * 60 + sm + duration <= endMins) {
    const startStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`
    const endStr = addMinutes(startStr, duration)
    slots.push({ startTime: startStr, endTime: endStr, label: formatTime(startStr) })
    sm += duration
    if (sm >= 60) { sh += Math.floor(sm / 60); sm = sm % 60 }
  }
  return slots
}

function formatDate(ds) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateShort(ds) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDayHeader(ds) {
  const d = new Date(ds + 'T00:00:00')
  return { weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), day: d.getDate() }
}

/* ── Month Calendar ── */
function MonthCalendar({ availableDays, selectedDate, onSelectDate, guestFreeDates }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const grid = useMemo(() => getMonthGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate])
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-zinc-100 tracking-tight">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors">
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors">
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {dayHeaders.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] py-1.5">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }, i) => {
          const ds = dateToStr(date)
          const isPast = date < today
          const isToday = dateToStr(date) === dateToStr(today)
          const isAvailable = inMonth && !isPast && availableDays.includes(date.getDay())
          const isSelected = selectedDate === ds
          const isGuestFree = guestFreeDates?.has(ds)

          return (
            <button key={i} disabled={!isAvailable} onClick={() => isAvailable && onSelectDate(ds)}
              className={`relative aspect-square flex items-center justify-center text-sm rounded-full transition-all duration-200 ease-ios font-medium ${
                !inMonth ? 'text-transparent' :
                isSelected ? 'bg-accent text-white shadow-[0_4px_16px_-4px_rgb(139_92_246/0.5)] scale-100' :
                isAvailable ? 'text-zinc-100 hover:bg-white/5 hover:scale-105 cursor-pointer' :
                'text-zinc-700 cursor-default'
              }`}>
              {date.getDate()}
              {isToday && !isSelected && inMonth && (
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
              )}
              {!isToday && isGuestFree && !isSelected && isAvailable && (
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-400/70" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Time Slot Picker ── */
function TimeSlotPicker({ slots, takenSlots, ownerEvents, guestEvents, selectedDate, selectedSlot, onSelect }) {
  const date = selectedDate ? new Date(selectedDate + 'T00:00:00') : null
  const available = slots.filter(s => {
    if (takenSlots.some(t => t.start_time === s.startTime)) return false
    if (date && ownerEvents.some(ev => eventOverlapsSlot(date, s, {
      ...ev, end: ev.end_at, isAllDay: ev.is_all_day,
    }))) return false
    return true
  })

  if (!available.length) {
    return (
      <div className="text-center py-12">
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
          <Clock size={16} strokeWidth={1.75} className="text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-400">No available times</p>
        <p className="text-xs text-zinc-600 mt-1">Try a different date.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {available.map((slot, i) => {
        const isSelected = selectedSlot?.startTime === slot.startTime
        const isGuestBusy = guestEvents !== null && date &&
          guestEvents.some(ev => eventOverlapsSlot(date, slot, { ...ev, calendarId: 'primary' }))
        return (
          <motion.button
            key={slot.startTime}
            onClick={() => onSelect(slot)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.015, duration: 0.2, ease: IOS_EASE }}
            className={`w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ease-ios ${
              isSelected
                ? 'bg-accent text-white shadow-[0_8px_24px_-8px_rgb(139_92_246/0.5)]'
                : isGuestBusy
                ? 'border border-white/[0.05] text-zinc-600'
                : 'border border-white/10 text-zinc-200 hover:border-accent/40 hover:bg-white/[0.03]'
            }`}>
            {slot.label}
            {isGuestBusy && !isSelected && (
              <span className="flex items-center gap-1 text-[10px] font-normal text-zinc-700">
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                busy
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}

/* ── Confirm Form ── */
function ConfirmForm({ page, selectedDate, selectedSlot, onConfirm, submitting }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  const rf = page.required_fields || { name: true, email: true, message: false }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (rf.email && !form.email.trim()) return
    if (rf.message && !form.message.trim()) return
    onConfirm(form)
  }

  const canSubmit = form.name.trim()
    && (!rf.email || form.email.trim())
    && (!rf.message || form.message.trim())

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-surface-800/50 border border-surface-700 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
          <CalendarDays size={16} className="text-accent" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-200">{formatDateShort(selectedDate)}</p>
          <p className="text-xs text-zinc-500">{selectedSlot.label} – {formatTime(selectedSlot.endTime)} ({page.duration_minutes} min)</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Name</label>
        <input type="text" placeholder="Your name" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent" autoFocus />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email {!page.required_fields?.email && <span className="text-zinc-700">(optional)</span>}</label>
        <input type="email" placeholder="your@email.com" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Message {!page.required_fields?.message && <span className="text-zinc-700">(optional)</span>}</label>
        <textarea placeholder="Anything you'd like us to know..." value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={2}
          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none" />
      </div>
      <Button type="submit" size="lg" className="w-full justify-center" disabled={!canSubmit || submitting}>
        {submitting ? 'Confirming...' : 'Confirm Booking'}
      </Button>
    </form>
  )
}

/* ── Guest Calendar Panel ── */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// guestEvents: null = not connected, array = connected
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

  // Connected — compact chip
  if (guestEvents !== null) {
    return (
      <div className="flex items-center gap-2 mt-4">
        <div className="flex items-center gap-1.5 text-[11px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5">
          <CheckCircle2 size={11} strokeWidth={2} />
          Your calendar connected
        </div>
        <button onClick={onDisconnect} className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
          Disconnect
        </button>
      </div>
    )
  }

  // Not connected — invite to connect
  return (
    <>
      {showGuide && (
        <GoogleOAuthGuide
          onConfirm={() => { setShowGuide(false); tokenClientRef.current?.requestAccessToken() }}
          onCancel={() => setShowGuide(false)}
        />
      )}
      <div className="border border-dashed border-white/10 rounded-xl px-4 py-3 mt-4">
        <div className="flex items-center gap-3">
          <CalendarDays size={15} strokeWidth={1.75} className="text-zinc-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-300">Spot your free time at a glance</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">We'll dim slots where you're already busy. Free/busy only — never event details, nothing leaves your browser.</p>
          </div>
        </div>
        <button
          onClick={() => setShowGuide(true)}
          disabled={!gisReady || loading}
          className="mt-2 w-full text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
        >
          {loading ? 'Connecting...' : 'Connect Calendar'}
        </button>
        {error && <p className="text-[11px] text-red-400 mt-1.5">{error}</p>}
      </div>
    </>
  )
}

/* ── Main Component ── */
export function BookingPageView() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const hideLogo = searchParams.get('logo') === '0'
  const hideDesc = searchParams.get('desc') === '0'
  const theme = searchParams.get('theme') // 'light' | 'dark' | null (null = dark)
  const { resolveBookingSlug, createBooking } = useApp()

  // Apply theme to document root — safe in iframe (isolated document)
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    return () => document.documentElement.classList.remove('light')
  }, [theme])

  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [takenSlots, setTakenSlots] = useState([])
  const [ownerEvents, setOwnerEvents] = useState([])
  const [ownerLogo, setOwnerLogo] = useState(null)
  const [ownerLogoDark, setOwnerLogoDark] = useState(true)
  const [ownerGuestCalendarEnabled, setOwnerGuestCalendarEnabled] = useState(true)
  const [guestEvents, setGuestEvents] = useState(() => {
    try { const s = sessionStorage.getItem('coordie-gcal'); return s ? JSON.parse(s) : null } catch (e) { return null }
  })

  function connectGuestCalendar(events) {
    setGuestEvents(events)
    try { sessionStorage.setItem('coordie-gcal', JSON.stringify(events)) } catch (e) { /* full */ }
  }
  function disconnectGuestCalendar() {
    setGuestEvents(null)
    try { sessionStorage.removeItem('coordie-gcal') } catch (e) { /* */ }
  }
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Preserve last non-null values so exit animations don't crash on null
  const lastSlotRef = useRef(null)
  if (selectedSlot !== null) lastSlotRef.current = selectedSlot
  const lastDateHeaderRef = useRef(null)

  // Mobile step state (desktop shows all panels)
  const [mobileStep, setMobileStep] = useState(1)

  useEffect(() => {
    resolveBookingSlug(slug).then(data => { setPage(data); setLoading(false) }).catch(() => setLoading(false))
  }, [slug, resolveBookingSlug])

  // Fetch owner's calendar events (synced to Supabase) so we can block busy slots
  useEffect(() => {
    if (!page?.owner_id) return
    supabase.from('owner_calendar_events')
      .select('*')
      .eq('owner_id', page.owner_id)
      .then(({ data }) => setOwnerEvents(data || []))
    supabase.from('profiles')
      .select('logo_url, logo_is_dark, settings')
      .eq('id', page.owner_id)
      .single()
      .then(({ data }) => {
        setOwnerLogo(data?.logo_url || null)
        setOwnerLogoDark(data?.logo_is_dark ?? true)
        setOwnerGuestCalendarEnabled(data?.settings?.guestCalendarEnabled ?? true)
      })
  }, [page])

  useEffect(() => {
    if (!selectedDate || !page) return
    supabase.from('bookings').select('start_time, end_time')
      .eq('booking_page_id', page.id).eq('date', selectedDate).eq('status', 'confirmed')
      .then(({ data }) => setTakenSlots(data || []))
  }, [selectedDate, page])

  const timeSlots = useMemo(() => {
    if (!page) return []
    const hours = page.available_hours || { start: '09:00', end: '17:00' }
    return generateTimeSlots(hours.start, hours.end, page.duration_minutes || 30)
  }, [page])

  // Days where guest has at least one free slot — used to dot the calendar
  const guestFreeDates = useMemo(() => {
    if (!guestEvents || !timeSlots.length) return null
    const result = new Set()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    for (let i = 1; i < 90; i++) {
      const date = new Date(today); date.setDate(today.getDate() + i)
      const ds = dateToStr(date)
      const hasFree = timeSlots.some(slot =>
        !guestEvents.some(ev => eventOverlapsSlot(date, slot, { ...ev, calendarId: 'primary' }))
      )
      if (hasFree) result.add(ds)
    }
    return result
  }, [guestEvents, timeSlots])

  function handleDateSelect(ds) {
    setSelectedDate(ds)
    setSelectedSlot(null)
    setMobileStep(2)
  }

  function handleTimeSelect(slot) {
    setSelectedSlot(slot)
    setMobileStep(3)
  }

  async function handleConfirm(form) {
    if (!selectedDate || !selectedSlot) return
    setSubmitting(true)
    const success = await createBooking({
      bookingPageId: page.id, guestName: form.name.trim(), guestEmail: form.email.trim(),
      guestMessage: form.message.trim(),
      date: selectedDate, startTime: selectedSlot.startTime, endTime: selectedSlot.endTime,
    })
    setSubmitting(false)
    if (success) setDone(true)
  }

  /* Loading */
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <img src="/coordie-logo.svg" alt="Coordie" className="h-5 animate-pulse" style={{ filter: 'invert(1)' }} />
      </div>
    )
  }

  /* Not Found */
  if (!page) {
    return (
      <div className="min-h-screen bg-surface-950 ambient-glow flex items-center justify-center px-6">
        <div className="text-center max-w-sm animate-fadeIn">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center mx-auto mb-5">
            <CalendarDays size={20} strokeWidth={1.5} className="text-zinc-500" />
          </div>
          <p className="text-zinc-100 text-lg font-semibold mb-1.5">Booking page not found</p>
          <p className="text-sm text-zinc-500 leading-relaxed">This link may be invalid or the page has been deactivated.</p>
        </div>
      </div>
    )
  }

  /* Success */
  if (done) {
    return (
      <div className="min-h-screen bg-surface-950 ambient-glow flex items-center justify-center px-6 py-10 safe-top safe-bottom">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: IOS_EASE }}
          className="max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.45, ease: IOS_EASE }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-green-500/[0.04] border border-green-500/20 flex items-center justify-center mx-auto mb-8"
          >
            <CheckCircle2 size={34} strokeWidth={1.5} className="text-green-400" />
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-50 mb-3 tracking-tight">You're booked</h2>
          <p className="text-base text-zinc-400 mb-10 leading-relaxed">A spot has been reserved for you.</p>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 sm:p-6 text-left space-y-4 mb-10">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <CalendarDays size={16} strokeWidth={1.75} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-zinc-100">{formatDateShort(selectedDate)}</p>
                <p className="text-sm text-zinc-500">{formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center flex-shrink-0">
                <Clock size={16} strokeWidth={1.75} className="text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-zinc-100">{page.duration_minutes} minutes</p>
                <p className="text-sm text-zinc-500 truncate">{page.name}</p>
              </div>
            </div>
          </div>
          <a href="https://coordie.com" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            <img src="/coordie-logo.svg" alt="" className="h-2.5" style={{ filter: 'invert(0.4)' }} />
            Powered by Coordie
          </a>
        </motion.div>
      </div>
    )
  }

  /* ── Booking flow: full-bleed asymmetric (desktop) + stacked (mobile) ── */
  // Page logo takes priority over owner profile logo
  const displayLogo = page.logo_url || ownerLogo
  const displayLogoDark = page.logo_url ? (page.logo_is_dark ?? true) : ownerLogoDark

  const dateHeader = selectedDate ? formatDayHeader(selectedDate) : null
  if (dateHeader !== null) lastDateHeaderRef.current = dateHeader
  const step = selectedSlot ? 'confirm' : selectedDate ? 'time' : 'date'

  return (
    <div className="bg-surface-950 ambient-glow relative">

      {/* ═══ DESKTOP (md+): asymmetric full-bleed ═══ */}
      <div className="hidden md:grid md:grid-cols-[minmax(0,440px)_1fr] lg:grid-cols-[minmax(0,520px)_1fr] h-screen overflow-hidden">

        {/* LEFT — brand canvas */}
        <aside className="flex flex-col justify-between px-10 lg:px-16 py-12 lg:py-20 border-r border-white/[0.06] relative overflow-y-auto">
          {/* Subtle accent line */}
          <div className="absolute top-0 left-0 w-px h-32 bg-gradient-to-b from-accent/50 to-transparent" />

          <div>
            {!hideLogo && (
              <div className="mb-10">
                {displayLogo ? (
                  <div className={`rounded-xl px-3 py-2 inline-flex ${displayLogoDark ? 'bg-[#f0f0f0]' : 'bg-[#1a1a1e]'}`}>
                    <img src={displayLogo} alt="" className="max-h-7 max-w-[120px] object-contain" />
                  </div>
                ) : (
                  <img src="/coordie-logo.svg" alt="Coordie" className="h-6" style={{ filter: 'invert(1)' }} />
                )}
              </div>
            )}
            <h1 className={`text-3xl lg:text-[40px] font-semibold text-zinc-50 leading-[1.1] tracking-tight mb-4 ${hideLogo ? 'mt-2' : ''}`}>
              {page.name}
            </h1>
            {page.description && !hideDesc && (
              <p className="text-base text-zinc-400 leading-relaxed mb-8 max-w-md">{page.description}</p>
            )}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] border border-white/[0.06] px-3.5 py-1.5 text-sm text-zinc-300">
              <Clock size={13} strokeWidth={1.75} className="text-zinc-500" />
              {page.duration_minutes} minutes
            </div>
          </div>

          <div className="space-y-6 pt-10">
            {ownerGuestCalendarEnabled && <GuestCalendarPanel guestEvents={guestEvents} onConnect={connectGuestCalendar} onDisconnect={disconnectGuestCalendar} />}
            <a href="https://coordie.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
              <img src="/coordie-logo.svg" alt="" className="h-2.5" style={{ filter: 'invert(0.4)' }} />
              Powered by Coordie
            </a>
          </div>
        </aside>

        {/* RIGHT — booking flow: full calendar → slot picker slides in */}
        <main className="flex items-start justify-center px-8 lg:px-14 pt-16 lg:pt-20 pb-10 overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 'date' && (
              <motion.div
                key="calendar"
                className="w-full max-w-[500px]"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.28, ease: IOS_EASE }}
              >
                <MonthCalendar
                  availableDays={page.available_days || [1, 2, 3, 4, 5]}
                  selectedDate={selectedDate}
                  onSelectDate={handleDateSelect}
                  guestFreeDates={guestFreeDates}
                />
              </motion.div>
            )}

            {step === 'time' && (
              <motion.div
                key="time"
                className="w-full max-w-[320px]"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.28, ease: IOS_EASE }}
              >
                <div className="flex items-center gap-3 mb-8">
                  <button
                    onClick={() => { setSelectedDate(null); setSelectedSlot(null) }}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors -ml-2"
                  >
                    <ChevronLeft size={18} strokeWidth={1.75} />
                  </button>
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">{lastDateHeaderRef.current?.weekday}</p>
                    <p className="text-2xl font-semibold text-zinc-100 tracking-tight">{lastDateHeaderRef.current?.day}</p>
                  </div>
                </div>
                <TimeSlotPicker
                  slots={timeSlots} takenSlots={takenSlots} ownerEvents={ownerEvents} guestEvents={guestEvents}
                  selectedDate={selectedDate} selectedSlot={selectedSlot} onSelect={handleTimeSelect}
                />
              </motion.div>
            )}

            {step === 'confirm' && (
              <motion.div
                key="confirm"
                className="w-full max-w-[380px]"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.28, ease: IOS_EASE }}
              >
                <div className="flex items-center gap-3 mb-8">
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors -ml-2"
                  >
                    <ChevronLeft size={18} strokeWidth={1.75} />
                  </button>
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">Your details</p>
                </div>
                <ConfirmForm page={page} selectedDate={selectedDate} selectedSlot={lastSlotRef.current}
                  onConfirm={handleConfirm} submitting={submitting} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ═══ MOBILE: stacked full-bleed ═══ */}
      <div className="md:hidden min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 pt-6 safe-top pb-6 relative">
          <div className="absolute top-0 left-0 w-px h-16 bg-gradient-to-b from-accent/50 to-transparent" />
          {!hideLogo && (
            <div className="mb-5">
              {displayLogo ? (
                <div className={`rounded-xl px-2.5 py-1.5 inline-flex ${displayLogoDark ? 'bg-[#f0f0f0]' : 'bg-[#1a1a1e]'}`}>
                  <img src={displayLogo} alt="" className="max-h-6 max-w-[100px] object-contain" />
                </div>
              ) : (
                <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: 'invert(1)' }} />
              )}
            </div>
          )}
          <h1 className="text-[26px] font-semibold text-zinc-50 leading-[1.15] tracking-tight mb-2">{page.name}</h1>
          {page.description && !hideDesc && <p className="text-[15px] text-zinc-400 leading-relaxed mb-4">{page.description}</p>}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/[0.06] px-3 py-1 text-xs text-zinc-300">
            <Clock size={11} strokeWidth={1.75} className="text-zinc-500" />
            {page.duration_minutes} minutes
          </div>
        </header>

        <div className="border-t border-white/[0.05] mx-6" />

        {/* Steps */}
        <div className="flex-1 px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={mobileStep}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: IOS_EASE }}
            >
              {mobileStep === 1 && (
                <MonthCalendar
                  availableDays={page.available_days || [1, 2, 3, 4, 5]}
                  selectedDate={selectedDate}
                  onSelectDate={handleDateSelect}
                />
              )}

              {mobileStep === 2 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setMobileStep(1)}
                      className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors -ml-2">
                      <ChevronLeft size={18} strokeWidth={1.75} />
                    </button>
                    <div>
                      <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">{lastDateHeaderRef.current?.weekday}</p>
                      <p className="text-xl font-semibold text-zinc-100 tracking-tight">{lastDateHeaderRef.current?.day}</p>
                    </div>
                  </div>
                  <TimeSlotPicker slots={timeSlots} takenSlots={takenSlots} ownerEvents={ownerEvents} guestEvents={guestEvents} selectedDate={selectedDate} selectedSlot={selectedSlot} onSelect={handleTimeSelect} />
                </div>
              )}

              {mobileStep === 3 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => { setSelectedSlot(null); setMobileStep(2) }}
                      className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors -ml-2">
                      <ChevronLeft size={18} strokeWidth={1.75} />
                    </button>
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">Your details</p>
                  </div>
                  <ConfirmForm page={page} selectedDate={selectedDate} selectedSlot={lastSlotRef.current}
                    onConfirm={handleConfirm} submitting={submitting} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="px-6 pb-6 safe-bottom space-y-4">
          {ownerGuestCalendarEnabled && (
            <GuestCalendarPanel guestEvents={guestEvents} onConnect={connectGuestCalendar} onDisconnect={disconnectGuestCalendar} />
          )}
          <a href="https://coordie.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            <img src="/coordie-logo.svg" alt="" className="h-2.5" style={{ filter: 'invert(0.4)' }} />
            Powered by Coordie
          </a>
        </footer>
      </div>
    </div>
  )
}

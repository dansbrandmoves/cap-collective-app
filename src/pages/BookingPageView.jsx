import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { getMonthGrid, trimBlankWeeks, dateToStr, eventOverlapsSlot } from '../utils/availability'
import { SlotRow } from '../components/availability/SlotRow'
import { supabase } from '../utils/supabase'
import { loadGoogleIdentityServices, fetchCalendarEvents, isConfigured } from '../utils/googleCalendar'
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, CalendarDays, X } from 'lucide-react'

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

// Time-of-day windows — same language as the project view. Filters the slots.
const WINDOWS = {
  any:       { label: 'Any time',  start: 0,        end: 24 * 60 },
  morning:   { label: 'Morning',   start: 5 * 60,   end: 12 * 60 },
  afternoon: { label: 'Afternoon', start: 12 * 60,  end: 17 * 60 },
  evening:   { label: 'Evening',   start: 17 * 60,  end: 23 * 60 },
}
const WINDOW_ORDER = ['any', 'morning', 'afternoon', 'evening']
const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }
const slotInWindow = (slot, w) => { const s = toMin(slot.startTime); return s >= w.start && s < w.end }

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
  const grid = useMemo(() => trimBlankWeeks(getMonthGrid(viewDate.getFullYear(), viewDate.getMonth())), [viewDate])
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[18px] font-semibold text-zinc-100 tracking-tight">{monthLabel}</h3>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors">
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors">
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Same lined-grid calendar as the project view — unified look. Green dot
          = you're both free that day, accent ring = selected. */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/[0.07]">
          {dayHeaders.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] py-2.5 border-r border-white/[0.04] last:border-r-0">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map(({ date, inMonth }, i) => {
            const ds = dateToStr(date)
            const isPast = date < today
            const isToday = dateToStr(date) === dateToStr(today)
            const isAvailable = inMonth && !isPast && availableDays.includes(date.getDay())
            const isSelected = selectedDate === ds
            const isGuestFree = guestFreeDates?.has(ds) && isAvailable
            return (
              <button key={i} disabled={!isAvailable} onClick={() => isAvailable && onSelectDate(ds)}
                className={`relative min-h-[64px] sm:min-h-[84px] border-r border-b border-white/[0.04] flex items-start justify-start p-2 sm:p-2.5 transition-colors ${
                  !inMonth || !isAvailable ? 'pointer-events-none' :
                  isGuestFree ? 'bg-green-500/[0.09] hover:bg-green-500/[0.15] cursor-pointer' :
                  'hover:bg-white/[0.03] cursor-pointer'
                } ${isSelected ? 'ring-2 ring-inset ring-accent bg-accent/[0.04]' : ''}`}>
                {inMonth && (
                  <span className={`text-[13px] sm:text-[15px] font-medium ${
                    !isAvailable ? 'text-zinc-700' : isToday ? 'text-accent' : 'text-zinc-200'
                  }`}>{date.getDate()}</span>
                )}
                {/* Subtle dot when you're both free that day */}
                {inMonth && isGuestFree && (
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Labeled key so availability isn't conveyed by colour alone */}
      {guestFreeDates && guestFreeDates.size > 0 && (
        <p className="flex items-center justify-center gap-2 text-[12px] text-zinc-500 mt-3">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
          Green dot = you&rsquo;re both free
        </p>
      )}
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
      {available.map((slot) => {
        const isSelected = selectedSlot?.startTime === slot.startTime
        const isGuestBusy = guestEvents !== null && date &&
          guestEvents.some(ev => eventOverlapsSlot(date, slot, { ...ev, calendarId: 'primary' }))
        return (
          <SlotRow
            key={slot.startTime}
            center
            name={slot.label}
            state={isSelected ? 'selected' : isGuestBusy ? 'busy' : 'available'}
            onClick={() => onSelect(slot)}
            trailing={isGuestBusy && !isSelected ? (
              <span className="flex items-center gap-1 text-[10px] font-normal text-zinc-700">
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                busy
              </span>
            ) : null}
          />
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

  // Connected — compact chip inline
  if (guestEvents !== null) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5">
          <CheckCircle2 size={12} strokeWidth={2} />
          Calendar connected
        </span>
        <button onClick={onDisconnect} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
          Disconnect
        </button>
      </div>
    )
  }

  // Not connected — one compact CTA (it sits in the work area above the calendar)
  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={() => tokenClientRef.current?.requestAccessToken()}
        disabled={!gisReady || loading}
        title="Only your availability — free or busy — is shared."
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-full px-3.5 py-1.5 transition-colors disabled:opacity-50"
      >
        <CalendarDays size={13} strokeWidth={1.75} className="text-zinc-400" />
        {loading ? 'Connecting…' : 'Connect your calendar'}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </span>
  )
}

// Turn a #hex into "r g b" channels + pick a readable foreground. Used to apply a
// host's brand color to the booking page's buttons/accents (overriding the neutral
// default). Returns null for anything unparseable so we fall back to neutral.
function brandVars(hex) {
  if (!hex) return null
  const h = String(hex).replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const fg = (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '24 24 27' : '255 255 255'
  const hov = [r, g, b].map(c => Math.round(c * 0.88)).join(' ')
  return { '--accent': `${r} ${g} ${b}`, '--accent-hover': hov, '--accent-fg': fg }
}

/* ── Main Component ── */
export function BookingPageView() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const hideLogo = searchParams.get('logo') === '0'
  const hideDesc = searchParams.get('desc') === '0'
  const themeParam = searchParams.get('theme') // 'light' | 'dark' | 'auto' — embed override
  const accentParam = searchParams.get('accent') // hex (no #) — embed brand-color override
  const { resolveBookingSlug, createBooking } = useApp()

  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [takenSlots, setTakenSlots] = useState([])
  const [ownerEvents, setOwnerEvents] = useState([])
  const [ownerLogo, setOwnerLogo] = useState(null)
  const [ownerLogoDark, setOwnerLogoDark] = useState(true)
  const [ownerGuestCalendarEnabled, setOwnerGuestCalendarEnabled] = useState(true)
  const [bookingTheme, setBookingTheme] = useState(null) // owner's booking-page default: 'light' | 'dark' | 'auto'
  const [brandColor, setBrandColor] = useState(null) // owner's brand color (#hex) or null = neutral
  const [windowKey, setWindowKey] = useState('any')   // time-of-day slot filter

  // Booking pages have their OWN theme, independent of the owner's app theme.
  // Precedence: embed ?theme= override > the owner's bookingTheme default > light.
  //   light | dark (neutral charcoal, not the app's tinted slate) | auto (follows
  //   the embedding site's prefers-color-scheme).
  const mode = themeParam || bookingTheme || 'light'
  const [resolvedTheme, setResolvedTheme] = useState('light')
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const compute = () => {
      const effective = mode === 'auto' ? (mq?.matches ? 'dark' : 'light') : mode
      setResolvedTheme(effective)
      document.documentElement.classList.toggle('light', effective === 'light')
    }
    compute()
    if (mode === 'auto' && mq?.addEventListener) {
      mq.addEventListener('change', compute)
      return () => { mq.removeEventListener('change', compute); document.documentElement.classList.remove('light') }
    }
    return () => document.documentElement.classList.remove('light')
  }, [mode])
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
        // Dedicated booking-page theme; default light (not the owner's app theme).
        setBookingTheme(data?.settings?.bookingTheme || 'light')
        setBrandColor(data?.settings?.brandColor || null)
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

  // Days where guest has at least one free slot in the chosen time-of-day window —
  // used to dot the calendar. Recomputes as the window filter changes.
  const guestFreeDates = useMemo(() => {
    if (!guestEvents || !timeSlots.length) return null
    const windowed = timeSlots.filter(s => slotInWindow(s, WINDOWS[windowKey]))
    const result = new Set()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    for (let i = 1; i < 90; i++) {
      const date = new Date(today); date.setDate(today.getDate() + i)
      const ds = dateToStr(date)
      const hasFree = windowed.some(slot =>
        !guestEvents.some(ev => eventOverlapsSlot(date, slot, { ...ev, calendarId: 'primary' }))
      )
      if (hasFree) result.add(ds)
    }
    return result
  }, [guestEvents, timeSlots, windowKey])

  // Once connected: the soonest days you're both free (in the chosen window),
  // surfaced as quick "top picks" — like the project view's best days.
  const topPicks = useMemo(() => {
    if (!guestFreeDates || !page) return []
    const availDays = page.available_days || [1, 2, 3, 4, 5]
    return [...guestFreeDates]
      .filter(ds => availDays.includes(new Date(ds + 'T00:00:00').getDay()))
      .sort()
      .slice(0, 3)
  }, [guestFreeDates, page])

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
      <div className="min-h-dvh bg-surface-950 flex items-center justify-center">
        <img src="/coordie-logo.svg" alt="Coordie" className="h-5 animate-pulse" style={{ filter: 'invert(1)' }} />
      </div>
    )
  }

  /* Not Found */
  if (!page) {
    return (
      <div className="min-h-dvh bg-surface-950 ambient-glow flex items-center justify-center px-6">
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
      <div className="min-h-dvh bg-surface-950 ambient-glow flex items-center justify-center px-6 py-10 safe-top safe-bottom">
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

  // Title block (logo + name + duration), reused: left-aligned in the date step's
  // left column, centered on the time/confirm steps.
  const titleBlock = (
    <div className="flex items-center gap-3">
      {!hideLogo && (
        displayLogo ? (
          // Host's brand mark on a clear background (no chip) so it looks like
          // their page, not ours. "Powered by Coordie" lives in the footer.
          <img src={displayLogo} alt="" className="max-h-9 max-w-[130px] object-contain flex-shrink-0" />
        ) : (
          <img src="/coordie-logo.svg" alt="Coordie" className="h-6 flex-shrink-0" style={{ filter: resolvedTheme === 'light' ? 'none' : 'invert(1)' }} />
        )
      )}
      <div className="text-left min-w-0">
        <h1 className="text-[20px] sm:text-[23px] font-semibold text-zinc-50 tracking-tight leading-tight">{page.name}</h1>
        <p className="text-[13px] text-zinc-500">
          {page.duration_minutes} min{page.description && !hideDesc ? ` · ${page.description}` : ''}
        </p>
      </div>
    </div>
  )

  return (
    <div className="booking-neutral min-h-dvh bg-surface-950 ambient-glow" style={brandVars(accentParam || brandColor) || undefined}>
      <div className="mx-auto max-w-[940px] px-5 sm:px-8 py-8 sm:py-12 safe-top safe-bottom">

        {/* On the slot/confirm steps the title sits centered up top; on the date
            step it lives in the left column (below). */}
        {step !== 'date' && <header className="flex items-center justify-center gap-3 mb-8">{titleBlock}</header>}

        <AnimatePresence mode="wait">
          {step === 'date' && (
            <motion.div key="date"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: IOS_EASE }}
              className="md:flex md:gap-8 lg:gap-12 md:items-start">

              {/* LEFT — title + controls + top picks. Centered on mobile, left-aligned at md+ */}
              <div className="md:w-[300px] md:flex-shrink-0 mb-8 md:mb-0 text-center md:text-left">
                <div className="flex justify-center md:justify-start">{titleBlock}</div>

                {ownerGuestCalendarEnabled && (
                  <div className="mt-6">
                    {guestEvents === null && (
                      <p className="text-[12px] text-zinc-500 mb-2 leading-relaxed max-w-xs mx-auto md:mx-0">
                        Connect your calendar to get recommended times you&rsquo;re both free.
                      </p>
                    )}
                    <div className="flex justify-center md:justify-start">
                      <GuestCalendarPanel guestEvents={guestEvents} onConnect={connectGuestCalendar} onDisconnect={disconnectGuestCalendar} />
                    </div>

                    {guestEvents !== null && (
                      <>
                        <div className="flex justify-center md:justify-start mt-4">
                          <div className="inline-flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.05] rounded-lg p-0.5">
                            {WINDOW_ORDER.map(key => (
                              <button key={key} onClick={() => setWindowKey(key)}
                                className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150 ${
                                  windowKey === key ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400 hover:text-zinc-100'
                                }`}>
                                {WINDOWS[key].label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {topPicks.length > 0 && (
                          <div className="mt-5 max-w-xs mx-auto md:mx-0">
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-2">Top picks</p>
                            <div className="space-y-1.5">
                              {topPicks.map(ds => {
                                const d = new Date(ds + 'T00:00:00')
                                return (
                                  <button key={ds} onClick={() => handleDateSelect(ds)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-green-500/25 bg-green-500/[0.08] hover:bg-green-500/[0.14] text-left transition-colors">
                                    <span className="text-[13px] font-medium text-zinc-100">{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT — calendar */}
              <div className="flex-1 min-w-0">
                <MonthCalendar
                  availableDays={page.available_days || [1, 2, 3, 4, 5]}
                  selectedDate={selectedDate}
                  onSelectDate={handleDateSelect}
                  guestFreeDates={guestFreeDates}
                />
              </div>
            </motion.div>
          )}

          {step === 'time' && (
            <motion.div key="time" className="max-w-[460px] mx-auto"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.24, ease: IOS_EASE }}>
              <div className="flex items-center justify-center gap-3 mb-6">
                <button onClick={() => { setSelectedDate(null); setSelectedSlot(null) }}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors -ml-2">
                  <ChevronLeft size={18} strokeWidth={1.75} />
                </button>
                <div>
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">{lastDateHeaderRef.current?.weekday}</p>
                  <p className="text-2xl font-semibold text-zinc-100 tracking-tight">{lastDateHeaderRef.current?.day}</p>
                </div>
              </div>

              {/* Time-of-day filter — narrows a long list of times right here */}
              <div className="flex justify-center mb-4">
                <div className="inline-flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.05] rounded-lg p-0.5">
                  {WINDOW_ORDER.map(key => (
                    <button key={key} onClick={() => setWindowKey(key)}
                      className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 ${
                        windowKey === key ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400 hover:text-zinc-100'
                      }`}>
                      {WINDOWS[key].label}
                    </button>
                  ))}
                </div>
              </div>

              <TimeSlotPicker
                slots={timeSlots.filter(s => slotInWindow(s, WINDOWS[windowKey]))}
                takenSlots={takenSlots} ownerEvents={ownerEvents} guestEvents={guestEvents}
                selectedDate={selectedDate} selectedSlot={selectedSlot} onSelect={handleTimeSelect}
              />
            </motion.div>
          )}

          {step === 'confirm' && (
            <motion.div key="confirm" className="max-w-[480px] mx-auto"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.24, ease: IOS_EASE }}>
              <div className="flex items-center justify-center gap-3 mb-6">
                <button onClick={() => setSelectedSlot(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors -ml-2">
                  <ChevronLeft size={18} strokeWidth={1.75} />
                </button>
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">Your details</p>
              </div>
              <ConfirmForm page={page} selectedDate={selectedDate} selectedSlot={lastSlotRef.current}
                onConfirm={handleConfirm} submitting={submitting} />
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-10 text-center">
          <a href="https://coordie.com" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            <img src="/coordie-logo.svg" alt="" className="h-2.5" style={{ filter: 'invert(0.4)' }} />
            Powered by Coordie
          </a>
        </footer>
      </div>
    </div>
  )
}


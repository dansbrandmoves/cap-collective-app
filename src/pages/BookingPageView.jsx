import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { getMonthGrid, dateToStr } from '../utils/availability'
import { supabase } from '../utils/supabase'
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, CalendarDays, User, Mail } from 'lucide-react'

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
  const d = new Date(ds + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateShort(ds) {
  const d = new Date(ds + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/* ── Month Calendar ── */
function MonthCalendar({ availableDays, selectedDate, onSelectDate }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const grid = useMemo(() => getMonthGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate])

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-800 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="text-sm font-semibold text-zinc-100">{monthLabel}</h3>
        <button
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-800 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-zinc-600 py-1.5">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }, i) => {
          const ds = dateToStr(date)
          const isPast = date < today
          const isToday = dateToStr(date) === dateToStr(today)
          const dayOfWeek = date.getDay()
          const isAvailable = inMonth && !isPast && availableDays.includes(dayOfWeek)
          const isSelected = selectedDate === ds

          return (
            <button
              key={i}
              disabled={!isAvailable}
              onClick={() => isAvailable && onSelectDate(ds)}
              className={`relative aspect-square flex items-center justify-center text-sm rounded-xl transition-all duration-150 ${
                !inMonth ? 'text-zinc-800' :
                isSelected ? 'bg-accent text-white font-semibold shadow-sm shadow-accent/30 scale-105' :
                isAvailable ? 'text-zinc-200 hover:bg-surface-700 hover:text-white cursor-pointer' :
                'text-zinc-700 cursor-default'
              }`}
            >
              {date.getDate()}
              {isToday && !isSelected && inMonth && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Time Slot Picker ── */
function TimeSlotPicker({ slots, takenSlots, onSelect, selectedSlot }) {
  function isSlotTaken(slot) {
    return takenSlots.some(t => t.start_time === slot.startTime)
  }

  const available = slots.filter(s => !isSlotTaken(s))

  if (available.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock size={24} className="text-zinc-600 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">No available times on this date.</p>
        <p className="text-xs text-zinc-600 mt-1">Try selecting a different day.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
      {available.map(slot => {
        const isSelected = selectedSlot?.startTime === slot.startTime
        return (
          <button
            key={slot.startTime}
            onClick={() => onSelect(slot)}
            className={`px-3 py-3 rounded-xl text-sm font-medium text-center transition-all duration-150 ${
              isSelected
                ? 'bg-accent text-white shadow-sm shadow-accent/30 border border-accent'
                : 'border border-surface-600 text-zinc-300 hover:border-accent/50 hover:text-accent hover:bg-accent/5'
            }`}
          >
            {slot.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Step Indicator ── */
function StepIndicator({ step }) {
  const steps = ['Date', 'Time', 'Details']
  return (
    <div className="flex items-center justify-center gap-1.5 mb-5">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
            i + 1 < step ? 'bg-accent text-white' :
            i + 1 === step ? 'bg-accent/15 text-accent border border-accent/30' :
            'bg-surface-800 text-zinc-600 border border-surface-700'
          }`}>
            {i + 1 < step ? <CheckCircle2 size={12} /> : i + 1}
          </div>
          {i < 2 && <div className={`w-6 h-px transition-colors duration-300 ${i + 1 < step ? 'bg-accent' : 'bg-surface-700'}`} />}
        </div>
      ))}
    </div>
  )
}

/* ── Main Component ── */
export function BookingPageView() {
  const { slug } = useParams()
  const { resolveBookingSlug, createBooking } = useApp()

  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [takenSlots, setTakenSlots] = useState([])
  const [form, setForm] = useState({ name: '', email: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    resolveBookingSlug(slug).then(data => {
      setPage(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [slug, resolveBookingSlug])

  useEffect(() => {
    if (!selectedDate || !page) return
    supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('booking_page_id', page.id)
      .eq('date', selectedDate)
      .eq('status', 'confirmed')
      .then(({ data }) => setTakenSlots(data || []))
  }, [selectedDate, page])

  const timeSlots = useMemo(() => {
    if (!page) return []
    const hours = page.available_hours || { start: '09:00', end: '17:00' }
    return generateTimeSlots(hours.start, hours.end, page.duration_minutes || 30)
  }, [page])

  function handleDateSelect(ds) {
    setSelectedDate(ds)
    setSelectedSlot(null)
    setStep(2)
  }

  function handleTimeSelect(slot) {
    setSelectedSlot(slot)
    setStep(3)
  }

  async function handleConfirm(e) {
    e.preventDefault()
    if (!form.name.trim() || !selectedDate || !selectedSlot) return
    setSubmitting(true)
    const success = await createBooking({
      bookingPageId: page.id,
      guestName: form.name.trim(),
      guestEmail: form.email.trim(),
      date: selectedDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
    })
    setSubmitting(false)
    if (success) setDone(true)
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <span className="text-accent font-bold text-sm">Co</span>
          </div>
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    )
  }

  /* ── Not Found ── */
  if (!page) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={20} className="text-zinc-600" />
          </div>
          <p className="text-zinc-300 font-medium mb-1">Booking page not found</p>
          <p className="text-sm text-zinc-600">This link may be invalid or the page has been deactivated.</p>
        </div>
      </div>
    )
  }

  /* ── Success ── */
  if (done) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
        <div className="bg-surface-900 border border-surface-700 rounded-2xl p-8 sm:p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">You're booked</h2>
          <p className="text-sm text-zinc-500 mb-6">A spot has been reserved for you.</p>

          <div className="bg-surface-800/50 border border-surface-700 rounded-xl p-5 text-left space-y-3 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <CalendarDays size={14} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">{formatDateShort(selectedDate)}</p>
                <p className="text-xs text-zinc-500">{formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center flex-shrink-0">
                <Clock size={14} className="text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">{page.duration_minutes} minutes</p>
                <p className="text-xs text-zinc-500">{page.name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-600">
            <div className="w-4 h-4 rounded bg-accent/15 flex items-center justify-center">
              <span className="text-accent font-bold text-[7px]">Co</span>
            </div>
            Powered by Coordie
          </div>
        </div>
      </div>
    )
  }

  /* ── Booking Flow ── */
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4 py-8">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl max-w-[420px] w-full shadow-xl shadow-black/20 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-xs">Co</span>
            </div>
            <span className="text-xs font-medium text-zinc-500">Coordie</span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100 leading-tight">{page.name}</h1>
          {page.description && <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">{page.description}</p>}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-zinc-500">
            <Clock size={12} className="text-zinc-600" />
            <span>{page.duration_minutes} min</span>
          </div>
        </div>

        <div className="border-t border-surface-800" />

        <div className="px-6 py-5">
          <StepIndicator step={step} />

          {/* Step 1: Date */}
          {step === 1 && (
            <div className="animate-fadeIn">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Select a date</p>
              <MonthCalendar
                availableDays={page.available_days || [1, 2, 3, 4, 5]}
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
              />
            </div>
          )}

          {/* Step 2: Time */}
          {step === 2 && (
            <div className="animate-fadeIn">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setStep(1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Pick a time</p>
                  <p className="text-sm text-zinc-300 font-medium">{formatDateShort(selectedDate)}</p>
                </div>
              </div>
              <TimeSlotPicker
                slots={timeSlots}
                takenSlots={takenSlots}
                onSelect={handleTimeSelect}
                selectedSlot={selectedSlot}
              />
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setStep(2)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Your details</p>
              </div>

              {/* Summary card */}
              <div className="bg-surface-800/50 border border-surface-700 rounded-xl p-4 mb-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <CalendarDays size={16} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{formatDateShort(selectedDate)}</p>
                  <p className="text-xs text-zinc-500">{selectedSlot.label} – {formatTime(selectedSlot.endTime)} ({page.duration_minutes} min)</p>
                </div>
              </div>

              <form onSubmit={handleConfirm} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      type="text"
                      placeholder="Your name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full pl-9"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email <span className="text-zinc-700">(optional)</span></label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full pl-9"
                    />
                  </div>
                </div>
                <div className="pt-1">
                  <Button type="submit" size="lg" className="w-full justify-center" disabled={!form.name.trim() || submitting}>
                    {submitting ? 'Confirming...' : 'Confirm Booking'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-700">
            <div className="w-3.5 h-3.5 rounded bg-accent/15 flex items-center justify-center">
              <span className="text-accent font-bold text-[6px]">Co</span>
            </div>
            Powered by Coordie
          </div>
        </div>
      </div>
    </div>
  )
}

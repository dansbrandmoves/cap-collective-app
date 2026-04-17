import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { getMonthGrid, dateToStr } from '../utils/availability'
import { supabase } from '../utils/supabase'
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, CalendarDays } from 'lucide-react'

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

function MonthCalendar({ availableDays, selectedDate, onSelectDate }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const grid = useMemo(() => getMonthGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate])

  function prevMonth() {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }
  function nextMonth() {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-700 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-sm font-medium text-zinc-200">{monthLabel}</h3>
        <button onClick={nextMonth} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-700 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-zinc-600 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {grid.map(({ date, inMonth }, i) => {
          const ds = dateToStr(date)
          const isPast = date < today
          const dayOfWeek = date.getDay()
          const isAvailable = inMonth && !isPast && availableDays.includes(dayOfWeek)
          const isSelected = selectedDate === ds

          return (
            <button
              key={i}
              disabled={!isAvailable}
              onClick={() => isAvailable && onSelectDate(ds)}
              className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-colors ${
                !inMonth ? 'text-zinc-800' :
                isSelected ? 'bg-accent text-white font-semibold' :
                isAvailable ? 'text-zinc-200 hover:bg-surface-700 cursor-pointer' :
                'text-zinc-700 cursor-default'
              }`}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TimeSlotPicker({ slots, takenSlots, onSelect }) {
  function isSlotTaken(slot) {
    return takenSlots.some(t => t.start_time === slot.startTime)
  }

  const available = slots.filter(s => !isSlotTaken(s))

  if (available.length === 0) {
    return <p className="text-sm text-zinc-500 text-center py-6">No available times on this date.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
      {available.map(slot => (
        <button
          key={slot.startTime}
          onClick={() => onSelect(slot)}
          className="px-3 py-2.5 rounded-lg border border-surface-600 bg-surface-700 text-sm text-zinc-200 hover:border-accent hover:text-accent hover:bg-accent/5 transition-colors text-center"
        >
          {slot.label}
        </button>
      ))}
    </div>
  )
}

export function BookingPageView() {
  const { slug } = useParams()
  const { resolveBookingSlug, createBooking } = useApp()

  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1) // 1=date, 2=time, 3=confirm
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

  // Fetch taken slots when date is selected
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

  function formatDate(ds) {
    const d = new Date(ds + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-sm">Co</span>
          </div>
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-2">Booking page not found</p>
          <p className="text-sm text-zinc-600">This link may be invalid or the page has been deactivated.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
        <div className="bg-surface-900 border border-surface-700 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={28} className="text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Booking Confirmed</h2>
          <p className="text-sm text-zinc-400 mb-6">You're all set.</p>
          <div className="bg-surface-800 rounded-xl p-4 text-left space-y-2 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays size={14} className="text-zinc-500" />
              <span className="text-zinc-200">{formatDate(selectedDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={14} className="text-zinc-500" />
              <span className="text-zinc-200">{formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-600">Powered by Coordie</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4 py-10">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-surface-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-[10px]">Co</span>
            </div>
            <span className="text-xs text-zinc-500">Coordie</span>
          </div>
          <h1 className="text-lg font-semibold text-zinc-100 mt-3">{page.name}</h1>
          {page.description && <p className="text-sm text-zinc-500 mt-1">{page.description}</p>}
          <div className="flex items-center gap-3 mt-3">
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock size={12} /> {page.duration_minutes} min
            </span>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* Step 1: Date */}
          {step === 1 && (
            <>
              <p className="text-xs font-medium text-zinc-400 mb-4">Select a date</p>
              <MonthCalendar
                availableDays={page.available_days || [1, 2, 3, 4, 5]}
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
              />
            </>
          )}

          {/* Step 2: Time */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setStep(1)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-700 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <p className="text-xs font-medium text-zinc-400">
                  {formatDate(selectedDate)}
                </p>
              </div>
              <TimeSlotPicker
                slots={timeSlots}
                takenSlots={takenSlots}
                onSelect={handleTimeSelect}
              />
            </>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setStep(2)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-700 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <p className="text-xs font-medium text-zinc-400">Confirm your booking</p>
              </div>

              <div className="bg-surface-800 rounded-xl p-4 mb-5 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays size={14} className="text-zinc-500" />
                  <span className="text-zinc-200">{formatDate(selectedDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-zinc-500" />
                  <span className="text-zinc-200">{selectedSlot.label} – {formatTime(selectedSlot.endTime)}</span>
                </div>
              </div>

              <form onSubmit={handleConfirm} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Your Name</label>
                  <input
                    type="text"
                    placeholder="John Smith"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email (optional)</label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
                  />
                </div>
                <Button type="submit" className="w-full justify-center" disabled={!form.name.trim() || submitting}>
                  {submitting ? 'Booking...' : 'Confirm Booking'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { getMonthGrid, trimBlankWeeks, dateToStr, deriveSlotState } from '../../utils/availability'
import { SlotRow } from './SlotRow'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// The owner's own default availability, rendered in the same calm lined-grid look
// as the project + booking calendars (green = you have an open slot that day).
// Click a day to see each slot's state. Read-only — editing happens via working
// hours (Calendars tab) + the slot editor below.
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATE_TONE = {
  available: 'text-green-400',
  blocked:   'text-red-400',
  hold:      'text-indigo-400',
  booked:    'text-amber-400',
}

export function MyAvailabilityCalendar({
  slots = [], calendarEvents = [], connectedCalendars = [], prefixRules = [],
  businessHours = null, slotStates = {},
}) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [inspected, setInspected] = useState(null) // dateStr

  const grid = useMemo(() => trimBlankWeeks(getMonthGrid(year, month)), [year, month])

  const dayInfo = useMemo(() => {
    const map = {}
    for (const { date, inMonth } of grid) {
      if (!inMonth) continue
      const free = slots.filter(s =>
        deriveSlotState(date, s, calendarEvents, connectedCalendars, prefixRules, businessHours).state === 'available'
      ).length
      map[dateToStr(date)] = { free, total: slots.length }
    }
    return map
  }, [grid, slots, calendarEvents, connectedCalendars, prefixRules, businessHours])

  const inspectedSlots = useMemo(() => {
    if (!inspected) return []
    const date = new Date(inspected + 'T00:00:00')
    return slots.map(s => ({
      slot: s,
      state: deriveSlotState(date, s, calendarEvents, connectedCalendars, prefixRules, businessHours).state,
    }))
  }, [inspected, slots, calendarEvents, connectedCalendars, prefixRules, businessHours])

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  function goToday() { setMonth(today.getMonth()); setYear(today.getFullYear()) }

  const todayStr = dateToStr(today)
  const inspectedDate = inspected ? new Date(inspected + 'T00:00:00') : null

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-[18px] font-semibold text-zinc-100 tracking-tight">{MONTH_NAMES[month]} {year}</h3>
        <div className="flex items-center gap-1.5">
          <button onClick={goToday} className="min-h-[36px] text-[13px] font-medium text-zinc-400 hover:text-zinc-100 px-3 rounded-lg hover:bg-white/5 transition-colors">Today</button>
          <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors"><ChevronLeft size={18} strokeWidth={1.75} /></button>
          <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors"><ChevronRight size={18} strokeWidth={1.75} /></button>
        </div>
      </div>

      {/* Lined grid — same Apple-style cells as the project calendar */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/[0.07]">
          {DOW.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] py-2.5 border-r border-white/[0.04] last:border-r-0">
              <span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map(({ date, inMonth }, i) => {
            const ds = dateToStr(date)
            const info = dayInfo[ds]
            const isToday = ds === todayStr
            const hasFree = info && info.free > 0
            const isSelected = inMonth && ds === inspected
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            return (
              <button
                key={i}
                disabled={!inMonth}
                onClick={() => inMonth && setInspected(ds)}
                title={info ? `${info.free} of ${info.total} slots open` : undefined}
                className={`relative min-h-[64px] sm:min-h-[84px] border-r border-b border-white/[0.04] flex items-start justify-start p-2 sm:p-2.5 transition-colors ${
                  !inMonth ? 'pointer-events-none' :
                  hasFree ? 'bg-green-500/[0.09] hover:bg-green-500/[0.15] cursor-pointer' :
                  'hover:bg-white/[0.03] cursor-pointer'
                } ${isSelected ? 'ring-2 ring-inset ring-accent bg-accent/[0.04]' : ''}`}
              >
                {inMonth && (
                  <span className={`text-[13px] sm:text-[15px] font-medium ${isToday ? 'text-accent' : isWeekend ? 'text-zinc-600' : 'text-zinc-200'}`}>
                    {date.getDate()}
                  </span>
                )}
                {inMonth && hasFree && (
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day detail — each slot's state for the selected day */}
      {inspected && (
        <div className="mt-6">
          <div className="mb-3">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">{inspectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</p>
            <p className="text-[20px] font-semibold text-zinc-100 tracking-tight">{inspectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
          </div>
          {slots.length === 0 ? (
            <p className="text-[13px] text-zinc-500">No time slots defined yet. Working hours come from the Calendars tab.</p>
          ) : (
            <div className="space-y-2 max-w-md">
              {inspectedSlots.map(({ slot, state }) => (
                <SlotRow
                  key={slot.id}
                  state={state === 'available' ? 'available' : 'busy'}
                  barColor={slot.color || '#5e9c8c'}
                  name={slot.name}
                  time={`${slot.startTime} – ${slot.endTime}`}
                  trailing={
                    <span className={`text-[11px] font-medium flex-shrink-0 ${STATE_TONE[state] || 'text-zinc-500'}`}>
                      {slotStates[state]?.label || state}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

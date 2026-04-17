import { useState } from 'react'
import { MonthlyView } from './MonthlyView'
import { WeeklyView } from './WeeklyView'
import { DailyView } from './DailyView'
import { DateRequestModal } from './DateRequestModal'
import { useApp } from '../../contexts/AppContext'
import { getWeekStart, dateToStr, deriveSlotState } from '../../utils/availability'
import { Button } from '../ui/Button'

const VIEWS = ['Monthly', 'Weekly', 'Daily']

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function AvailabilityCalendar({
  slots, calendarEvents, connectedCalendars, availabilityRules = [], prefixRules = [],
  isOwner = false, slotStates: slotStatesProp, groupId, guestName, onRequestSubmit,
  dateRequests = [], sharedAvailability = [], businessHours = null, guestSlotSelection = false,
}) {
  const { slotStates: contextSlotStates } = useApp()
  const slotStates = slotStatesProp || contextSlotStates

  const today = new Date()
  const [view, setView] = useState('Monthly')
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [weekStart, setWeekStart] = useState(getWeekStart(today))
  const [selectedDay, setSelectedDay] = useState(today)

  // Date selection for guests
  const [selectedDates, setSelectedDates] = useState([])
  const [selectedSlotMap, setSelectedSlotMap] = useState({}) // { [dateStr]: [slotId, ...] } for slot-level
  const [slotPickerDate, setSlotPickerDate] = useState(null) // date string showing slot picker
  const [showRequestModal, setShowRequestModal] = useState(false)
  const isSelectionMode = !isOwner && !!groupId

  function handleDayClick(date) {
    if (isSelectionMode) {
      const ds = dateToStr(date)
      if (guestSlotSelection) {
        // Toggle slot picker for this date
        setSlotPickerDate(prev => prev === ds ? null : ds)
      } else {
        toggleDate(ds)
      }
    } else {
      setSelectedDay(date)
      setView('Daily')
    }
  }

  function toggleDate(ds) {
    setSelectedDates(prev =>
      prev.includes(ds) ? prev.filter(d => d !== ds) : [...prev, ds]
    )
  }

  function toggleSlotForDate(ds, slotId) {
    setSelectedSlotMap(prev => {
      const current = prev[ds] || []
      const updated = current.includes(slotId)
        ? current.filter(id => id !== slotId)
        : [...current, slotId]
      if (updated.length === 0) {
        const { [ds]: _, ...rest } = prev
        // Also remove from selectedDates
        setSelectedDates(d => d.filter(x => x !== ds))
        return rest
      }
      // Also add to selectedDates if not already there
      setSelectedDates(d => d.includes(ds) ? d : [...d, ds])
      return { ...prev, [ds]: updated }
    })
  }

  function clearSelection() { setSelectedDates([]) }

  async function handleRequestSubmit(data) {
    if (!onRequestSubmit || !groupId) return false
    const success = await onRequestSubmit(groupId, data)
    if (success) { setSelectedDates([]); setShowRequestModal(false) }
    return success
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }
  function prevWeek() { setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n }) }
  function nextWeek() { setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n }) }
  function prevDay() { setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n }) }
  function nextDay() { setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n }) }

  function goToToday() {
    const t = new Date()
    setCurrentMonth(t.getMonth())
    setCurrentYear(t.getFullYear())
    setWeekStart(getWeekStart(t))
    setSelectedDay(t)
  }

  function getNavLabel() {
    if (view === 'Monthly') return `${MONTH_NAMES[currentMonth]} ${currentYear}`
    if (view === 'Weekly') {
      const end = new Date(weekStart); end.setDate(end.getDate() + 6)
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return selectedDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  function handlePrev() {
    if (view === 'Monthly') prevMonth()
    else if (view === 'Weekly') prevWeek()
    else prevDay()
  }
  function handleNext() {
    if (view === 'Monthly') nextMonth()
    else if (view === 'Weekly') nextWeek()
    else nextDay()
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {Object.entries(slotStates).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: val.color }} />
            <span className="text-sm text-zinc-400">{val.label}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-0.5 bg-surface-800 rounded-lg p-0.5 self-start">
          {(isSelectionMode ? ['Monthly', 'Weekly'] : VIEWS).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === v ? 'bg-surface-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={goToToday} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5 rounded-md hover:bg-surface-700 transition-colors">
            Today
          </button>
          <div className="flex items-center gap-1 flex-1 sm:flex-none">
            <button onClick={handlePrev} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-700 text-zinc-400 hover:text-zinc-200 transition-colors text-sm">‹</button>
            <span className="text-sm font-medium text-zinc-300 flex-1 sm:min-w-[160px] text-center">{getNavLabel()}</span>
            <button onClick={handleNext} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-700 text-zinc-400 hover:text-zinc-200 transition-colors text-sm">›</button>
          </div>
        </div>
      </div>

      {/* View content */}
      {view === 'Monthly' && (
        <MonthlyView
          year={currentYear} month={currentMonth}
          slots={slots} calendarEvents={calendarEvents} connectedCalendars={connectedCalendars}
          prefixRules={prefixRules} onDayClick={handleDayClick} isOwner={isOwner}
          slotStates={slotStates} businessHours={businessHours}
          selectedDates={selectedDates} isSelectionMode={isSelectionMode}
          dateRequests={dateRequests} sharedAvailability={sharedAvailability}
        />
      )}

      {view === 'Weekly' && (
        <WeeklyView
          weekStart={weekStart}
          slots={slots} calendarEvents={calendarEvents} connectedCalendars={connectedCalendars}
          prefixRules={prefixRules} onDayClick={handleDayClick} isOwner={isOwner}
          slotStates={slotStates} businessHours={businessHours}
          selectedDates={selectedDates} isSelectionMode={isSelectionMode}
        />
      )}

      {view === 'Daily' && (
        <DailyView
          date={selectedDay}
          slots={slots} calendarEvents={calendarEvents} connectedCalendars={connectedCalendars}
          availabilityRules={availabilityRules} prefixRules={prefixRules} isOwner={isOwner}
          slotStates={slotStates} businessHours={businessHours}
          dateRequests={dateRequests} sharedAvailability={sharedAvailability}
        />
      )}

      {/* Slot picker for granular selection */}
      {isSelectionMode && guestSlotSelection && slotPickerDate && (
        <div className="mt-3 bg-surface-800 border border-surface-700 rounded-xl p-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-zinc-300">
              {new Date(slotPickerDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <button onClick={() => setSlotPickerDate(null)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Close</button>
          </div>
          <div className="space-y-1.5">
            {slots.map(slot => {
              const isChecked = (selectedSlotMap[slotPickerDate] || []).includes(slot.id)
              const derived = deriveSlotState(new Date(slotPickerDate + 'T00:00:00'), slot, calendarEvents, connectedCalendars, prefixRules, businessHours)
              const stateColor = slotStates[derived.state]?.color || '#22c55e'
              return (
                <label key={slot.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isChecked ? 'bg-accent/10 border border-accent/20' : 'hover:bg-surface-700 border border-transparent'
                  }`}>
                  <input type="checkbox" checked={isChecked}
                    onChange={() => toggleSlotForDate(slotPickerDate, slot.id)}
                    className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-700 text-accent focus:ring-accent/30 cursor-pointer" />
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stateColor }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-200">{slot.name}</span>
                    <span className="text-xs text-zinc-500 ml-2">{slot.startTime} – {slot.endTime}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600">{slotStates[derived.state]?.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Selection bar for guests */}
      {isSelectionMode && selectedDates.length > 0 && (
        <div className="sticky bottom-0 mt-4 bg-surface-900 border border-accent/20 rounded-xl px-5 py-4 shadow-lg shadow-black/20 safe-bottom-sm animate-fadeIn">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[...selectedDates].sort().map(ds => {
              const d = new Date(ds + 'T00:00:00')
              return (
                <button key={ds} onClick={() => toggleDate(ds)}
                  className="flex items-center gap-1 bg-accent/15 text-accent text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full hover:bg-accent/25 transition-colors">
                  {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  <span className="text-accent/60 hover:text-accent ml-0.5">×</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">
              {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button onClick={clearSelection} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Clear all</button>
              <Button size="sm" onClick={() => setShowRequestModal(true)}>Send Request →</Button>
            </div>
          </div>
        </div>
      )}

      {/* Request modal */}
      <DateRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        selectedDates={selectedDates}
        guestName={guestName}
        onSubmit={handleRequestSubmit}
      />
    </div>
  )
}

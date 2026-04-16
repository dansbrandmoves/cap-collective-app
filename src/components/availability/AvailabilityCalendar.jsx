import { useState } from 'react'
import { MonthlyView } from './MonthlyView'
import { WeeklyView } from './WeeklyView'
import { DailyView } from './DailyView'
import { DateRequestModal } from './DateRequestModal'
import { useApp } from '../../contexts/AppContext'
import { getWeekStart, dateToStr } from '../../utils/availability'
import { Button } from '../ui/Button'

const VIEWS = ['Monthly', 'Weekly', 'Daily']

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function AvailabilityCalendar({
  slots, calendarEvents, connectedCalendars, availabilityRules = [], prefixRules = [],
  isOwner = false, slotStates: slotStatesProp, groupId, guestName, onRequestSubmit,
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
  const [showRequestModal, setShowRequestModal] = useState(false)
  const isSelectionMode = !isOwner && !!groupId

  function handleDayClick(date) {
    if (isSelectionMode) {
      toggleDate(dateToStr(date))
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
            <span className="text-xs text-zinc-400">{val.label}</span>
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
          slotStates={slotStates}
          selectedDates={selectedDates} isSelectionMode={isSelectionMode}
        />
      )}

      {view === 'Weekly' && (
        <WeeklyView
          weekStart={weekStart}
          slots={slots} calendarEvents={calendarEvents} connectedCalendars={connectedCalendars}
          prefixRules={prefixRules} onDayClick={handleDayClick} isOwner={isOwner}
          slotStates={slotStates}
          selectedDates={selectedDates} isSelectionMode={isSelectionMode}
        />
      )}

      {view === 'Daily' && (
        <DailyView
          date={selectedDay}
          slots={slots} calendarEvents={calendarEvents} connectedCalendars={connectedCalendars}
          availabilityRules={availabilityRules} prefixRules={prefixRules} isOwner={isOwner}
          slotStates={slotStates}
        />
      )}

      {/* Selection bar for guests */}
      {isSelectionMode && selectedDates.length > 0 && (
        <div className="sticky bottom-0 mt-4 bg-surface-900 border border-surface-700 rounded-xl px-5 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-zinc-300">
            {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={clearSelection}>Clear</Button>
            <Button size="sm" onClick={() => setShowRequestModal(true)}>Request These Dates</Button>
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

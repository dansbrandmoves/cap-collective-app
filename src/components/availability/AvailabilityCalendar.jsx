import { useState, useMemo, useEffect } from 'react'
import { MonthlyView } from './MonthlyView'
import { WeeklyView } from './WeeklyView'
import { DailyView } from './DailyView'
import { DateRequestModal } from './DateRequestModal'
import { useApp } from '../../contexts/AppContext'
import { getWeekStart, dateToStr, deriveSlotState } from '../../utils/availability'
import { Button } from '../ui/Button'
import { CalendarPlus, X, Check } from 'lucide-react'

const VIEWS = ['Monthly', 'Weekly', 'Daily']

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function AvailabilityCalendar({
  slots, calendarEvents, connectedCalendars, availabilityRules = [], prefixRules = [],
  isOwner = false, slotStates: slotStatesProp, groupId, guestName, onRequestSubmit,
  dateRequests = [], sharedAvailability = [], businessHours = null, guestSlotSelection = false,
  guestEvents = null,
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
  const [inspectedDate, setInspectedDate] = useState(null) // owner inspecting a day for overlap + scheduling
  const isSelectionMode = !isOwner && !!groupId
  const isOwnerRoomContext = isOwner && !!groupId

  function handleDayClick(date) {
    if (isSelectionMode) {
      const ds = dateToStr(date)
      if (guestSlotSelection) {
        // Toggle slot picker for this date
        setSlotPickerDate(prev => prev === ds ? null : ds)
      } else {
        toggleDate(ds)
      }
    } else if (isOwnerRoomContext) {
      // Owner viewing a room's calendar — open the day inspector panel
      setInspectedDate(dateToStr(date))
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
      <div className="flex items-center gap-x-5 gap-y-2 mb-5 flex-wrap">
        {Object.entries(slotStates).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full ring-2 ring-surface-900" style={{ backgroundColor: val.color }} />
            <span className="text-[13px] text-zinc-400">{val.label}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.04] rounded-xl p-1 self-start">
          {(isSelectionMode ? (guestSlotSelection ? VIEWS : ['Monthly', 'Weekly']) : VIEWS).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ease-ios ${
                view === v
                  ? 'bg-surface-700 text-zinc-100 shadow-ring-sm'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={goToToday}
            className="min-h-[36px] text-[13px] font-medium text-zinc-400 hover:text-zinc-100 px-3 rounded-lg hover:bg-white/5 transition-colors">
            Today
          </button>
          <div className="flex items-center gap-1 flex-1 sm:flex-none">
            <button onClick={handlePrev}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors">
              <span className="text-lg leading-none">‹</span>
            </button>
            <span className="text-[13px] font-medium text-zinc-200 flex-1 sm:min-w-[180px] text-center tracking-tight">{getNavLabel()}</span>
            <button onClick={handleNext}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors">
              <span className="text-lg leading-none">›</span>
            </button>
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
          guestEvents={guestEvents}
        />
      )}

      {view === 'Weekly' && (
        <WeeklyView
          weekStart={weekStart}
          slots={slots} calendarEvents={calendarEvents} connectedCalendars={connectedCalendars}
          prefixRules={prefixRules} onDayClick={handleDayClick} isOwner={isOwner}
          slotStates={slotStates} businessHours={businessHours}
          selectedDates={selectedDates} isSelectionMode={isSelectionMode}
          dateRequests={dateRequests} sharedAvailability={sharedAvailability}
          guestSlotSelection={guestSlotSelection}
          selectedSlotMap={selectedSlotMap}
          toggleSlotForDate={toggleSlotForDate}
          guestEvents={guestEvents}
        />
      )}

      {view === 'Daily' && (
        <DailyView
          date={selectedDay}
          slots={slots} calendarEvents={calendarEvents} connectedCalendars={connectedCalendars}
          availabilityRules={availabilityRules} prefixRules={prefixRules} isOwner={isOwner}
          slotStates={slotStates} businessHours={businessHours}
          dateRequests={dateRequests} sharedAvailability={sharedAvailability}
          isSelectionMode={isSelectionMode}
          guestSlotSelection={guestSlotSelection}
          selectedSlotMap={selectedSlotMap}
          toggleSlotForDate={toggleSlotForDate}
          guestEvents={guestEvents}
        />
      )}

      {/* Slot picker side panel */}
      {isSelectionMode && guestSlotSelection && slotPickerDate && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSlotPickerDate(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-surface-900 border-l border-surface-700 z-50 flex flex-col animate-slideIn shadow-2xl shadow-black/40">
            <div className="px-5 py-4 border-b border-surface-700 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {new Date(slotPickerDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
                <p className="text-xs text-zinc-500">
                  {new Date(slotPickerDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setSlotPickerDate(null)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Done</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              <p className="text-xs text-zinc-600 mb-3">Select the time slots that work for you.</p>
              {slots.map(slot => {
                const isChecked = (selectedSlotMap[slotPickerDate] || []).includes(slot.id)
                const derived = deriveSlotState(new Date(slotPickerDate + 'T00:00:00'), slot, calendarEvents, connectedCalendars, prefixRules, businessHours)
                const stateColor = slotStates[derived.state]?.color || '#22c55e'
                const isAvailable = derived.state === 'available'
                return (
                  <button key={slot.id} onClick={() => toggleSlotForDate(slotPickerDate, slot.id)}
                    className={`w-full text-left rounded-xl px-4 py-3 transition-all border ${
                      isChecked
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-surface-800 border-surface-700 hover:border-surface-500'
                    }`}
                    style={{ borderLeftColor: stateColor, borderLeftWidth: '3px' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${isChecked ? 'text-zinc-100' : 'text-zinc-300'}`}>{slot.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{slot.startTime} – {slot.endTime}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${isAvailable ? 'text-green-400' : 'text-zinc-600'}`}>
                          {slotStates[derived.state]?.label}
                        </span>
                        {isChecked && (
                          <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            {selectedDates.length > 0 && (
              <div className="border-t border-surface-700 px-4 py-4 safe-bottom bg-surface-900/95 backdrop-blur">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">
                    {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''} ready
                  </span>
                  <button onClick={() => setSlotPickerDate(null)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
                    + another day
                  </button>
                </div>
                <Button
                  onClick={() => { setSlotPickerDate(null); setShowRequestModal(true) }}
                  className="w-full justify-center">
                  Send Request →
                </Button>
              </div>
            )}
          </div>
        </>
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
        selectedSlotMap={selectedSlotMap}
        guestName={guestName}
        onSubmit={handleRequestSubmit}
      />

      {/* Day inspector panel — owner taps a day to see who's free + schedule */}
      {inspectedDate && isOwnerRoomContext && (
        <DayInspectorPanel
          dateStr={inspectedDate}
          groupId={groupId}
          slots={slots}
          dateRequests={dateRequests.filter(r => r.dates?.includes(inspectedDate) && r.status !== 'declined' && r.status !== 'archived')}
          sharedAvailability={sharedAvailability.filter(a => a.date === inspectedDate && a.is_available)}
          onClose={() => setInspectedDate(null)}
        />
      )}
    </div>
  )
}

/* ── Day Inspector: owner-only panel with overlap + Schedule in Google Calendar ── */
function DayInspectorPanel({ dateStr, groupId, slots = [], dateRequests, sharedAvailability, onClose }) {
  const { getMembersForGroup } = useApp()
  const members = useMemo(() => getMembersForGroup(groupId || ''), [getMembersForGroup, groupId])

  const dateObj = useMemo(() => new Date(dateStr + 'T00:00:00'), [dateStr])

  // Guest data for this day: name + email (from their request or from group_members).
  // Only people who said they're free THIS DAY — not everyone in the group.
  const guestData = useMemo(() => {
    const set = new Set()
    dateRequests.forEach(r => { if (r.requester_name) set.add(r.requester_name) })
    sharedAvailability.forEach(a => { if (a.guest_name) set.add(a.guest_name) })
    return [...set].map(name => {
      const fromRequest = dateRequests.find(r => r.requester_name === name)?.requester_email
      const fromMember = members.find(m => m.name === name)?.email
      const email = (fromRequest || fromMember || '').trim()
      return { name, email: email || null }
    })
  }, [dateRequests, sharedAvailability, members])

  // Selected names (to include as attendees) — default to everyone with an email
  const [selectedNames, setSelectedNames] = useState(() =>
    new Set(guestData.filter(g => g.email).map(g => g.name))
  )

  // Keep selection in sync if the guest list grows live (new person shares availability
  // while the panel is open). Auto-include new people with emails; preserve existing choices.
  const guestNamesKey = guestData.map(g => g.name).sort().join('|')
  useEffect(() => {
    setSelectedNames(prev => {
      const next = new Set(prev)
      guestData.forEach(g => {
        if (g.email && !next.has(g.name) && !prev.has(g.name)) next.add(g.name)
      })
      // Drop anyone no longer in the list (e.g. request was archived)
      const allNames = new Set(guestData.map(g => g.name))
      ;[...next].forEach(n => { if (!allNames.has(n)) next.delete(n) })
      return next
    })
  }, [guestNamesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleGuest(name) {
    setSelectedNames(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Slot-level overlap: which slots does each guest say they're free for?
  // A guest with a slot_map entry for this date → only those slot IDs count.
  // A guest with no slot_map (date-only request) → counts as free for every slot.
  const slotOverlap = useMemo(() => {
    if (!slots || slots.length === 0) return { rows: [], anySlotData: false }
    let anySlotData = false
    const perSlot = slots.map(slot => {
      const free = new Set()
      dateRequests.forEach(r => {
        const slotIdsForDate = r.slot_map?.[dateStr]
        if (Array.isArray(slotIdsForDate)) {
          anySlotData = true
          if (slotIdsForDate.includes(slot.id)) free.add(r.requester_name)
        } else {
          if (r.requester_name) free.add(r.requester_name)
        }
      })
      sharedAvailability.forEach(a => { if (a.guest_name) free.add(a.guest_name) })
      free.delete(undefined); free.delete(null); free.delete('')
      return { slot, freeCount: free.size, freeNames: [...free] }
    })
    return { rows: perSlot, anySlotData }
  }, [slots, dateRequests, sharedAvailability, dateStr])

  const selectedEmails = useMemo(
    () => guestData.filter(g => g.email && selectedNames.has(g.name)).map(g => g.email),
    [guestData, selectedNames]
  )

  function handleSchedule() {
    // Default a 1-hour slot at 2pm local — owner can adjust inside Google Calendar
    const datePart = dateStr.replace(/-/g, '')
    const start = `${datePart}T140000`
    const end = `${datePart}T150000`

    const selectedList = guestData.filter(g => selectedNames.has(g.name)).map(g => g.name)
    const title = selectedList.length === 1
      ? `Meeting with ${selectedList[0]}`
      : selectedList.length > 1
      ? `Meeting · ${selectedList.slice(0, 2).join(' & ')}${selectedList.length > 2 ? ` +${selectedList.length - 2}` : ''}`
      : 'Meeting'

    const detailsLines = ['Scheduled via Coordie.']
    if (selectedList.length > 0) {
      detailsLines.push('')
      detailsLines.push(`Indicated free for ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: ${selectedList.join(', ')}.`)
    }

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${start}/${end}`,
      details: detailsLines.join('\n'),
    })
    if (selectedEmails.length > 0) {
      params.set('add', selectedEmails.join(','))
    }

    window.open(
      `https://calendar.google.com/calendar/render?${params.toString()}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Panel: bottom sheet on mobile, right drawer on desktop */}
      <div className="fixed z-50 bg-surface-900 border-white/[0.06] shadow-[0_-12px_40px_-8px_rgb(0_0_0/0.6)]
        inset-x-0 bottom-0 rounded-t-[20px] border-t
        md:inset-y-0 md:right-0 md:top-0 md:bottom-0 md:left-auto md:w-[400px] md:rounded-none md:border-l md:border-t-0
        flex flex-col max-h-[88vh] md:max-h-none animate-slideUp md:animate-slideIn safe-bottom">

        {/* Mobile grab handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.05]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-1.5">
              {dateObj.toLocaleDateString('en-US', { weekday: 'long' })}
            </p>
            <h3 className="text-[26px] font-semibold text-zinc-50 tracking-tight leading-tight">
              {dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors -mr-2 flex-shrink-0"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {guestData.length > 0 ? (
            <>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="inline-flex items-center justify-center rounded-full bg-accent text-white text-[13px] font-bold min-w-[26px] h-[26px] px-1.5">
                  {guestData.length}
                </span>
                <p className="text-[15px] text-zinc-300">
                  {guestData.length === 1 ? 'person is free' : 'people are free'}
                </p>
              </div>
              {guestData.some(g => g.email) && (
                <p className="text-[12px] text-zinc-500 mb-3 leading-relaxed">
                  Tap anyone to include or exclude from the invite.
                </p>
              )}
              <div className="space-y-1.5 mb-6">
                {guestData.map(({ name, email }) => {
                  const selected = selectedNames.has(name)
                  const hasEmail = !!email
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={hasEmail ? () => toggleGuest(name) : undefined}
                      disabled={!hasEmail}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 ease-ios text-left ${
                        !hasEmail
                          ? 'bg-white/[0.02] border-white/[0.04] opacity-60 cursor-default'
                          : selected
                          ? 'bg-accent/10 border-accent/30 hover:bg-accent/15'
                          : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 border ${
                        selected
                          ? 'bg-accent/20 border-accent/35 text-accent'
                          : 'bg-white/[0.04] border-white/10 text-zinc-400'
                      }`}>
                        {name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-zinc-100 truncate leading-tight">{name}</p>
                        {hasEmail ? (
                          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{email}</p>
                        ) : (
                          <p className="text-[11px] text-zinc-600 mt-0.5">No email &mdash; add manually in GCal</p>
                        )}
                      </div>
                      {hasEmail && (
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ease-ios ${
                          selected
                            ? 'bg-accent text-white'
                            : 'border border-white/20 bg-transparent'
                        }`}>
                          {selected && <Check size={12} strokeWidth={2.5} />}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {slotOverlap.anySlotData && slotOverlap.rows.length > 0 && (
                <div className="mb-2">
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">By time slot</p>
                  <div className="space-y-1.5">
                    {slotOverlap.rows.map(({ slot, freeCount, freeNames }) => {
                      const total = guestData.length
                      const pct = total > 0 ? Math.round((freeCount / total) * 100) : 0
                      const isBest = freeCount === total && freeCount > 0
                      const isNone = freeCount === 0
                      return (
                        <div
                          key={slot.id}
                          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-colors ${
                            isBest
                              ? 'bg-accent/10 border-accent/30'
                              : isNone
                              ? 'bg-white/[0.02] border-white/[0.04] opacity-60'
                              : 'bg-white/[0.03] border-white/[0.05]'
                          }`}
                          title={freeNames.length > 0 ? `Free: ${freeNames.join(', ')}` : 'No one free'}
                        >
                          <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: slot.color || '#8b5cf6' }} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium truncate leading-tight ${isBest ? 'text-zinc-50' : 'text-zinc-200'}`}>{slot.name}</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">{slot.startTime}–{slot.endTime}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${isBest ? 'bg-accent' : 'bg-accent/50'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-[12px] font-semibold tabular-nums w-10 text-right ${isBest ? 'text-accent' : isNone ? 'text-zinc-600' : 'text-zinc-300'}`}>
                              {freeCount}/{total}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center mx-auto mb-4">
                <CalendarPlus size={18} strokeWidth={1.5} className="text-zinc-500" />
              </div>
              <p className="text-[15px] font-medium text-zinc-200 mb-1">Nothing shared yet</p>
              <p className="text-sm text-zinc-500 leading-relaxed max-w-xs mx-auto">
                No one&rsquo;s indicated they&rsquo;re free on this day. You can still schedule it.
              </p>
            </div>
          )}
        </div>

        {/* Primary action */}
        <div className="px-6 py-5 border-t border-white/[0.05]">
          <button
            onClick={handleSchedule}
            className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold transition-all duration-200 ease-ios shadow-[0_8px_24px_-8px_rgb(139_92_246/0.55)]"
          >
            <CalendarPlus size={16} strokeWidth={2} />
            Schedule in Google Calendar
          </button>
          {guestData.length > 0 && (
            <p className="text-[12px] text-zinc-500 mt-3 text-center leading-relaxed">
              {selectedEmails.length === 0 ? (
                <>No attendees selected &mdash; opens a blank event for this day.</>
              ) : selectedEmails.length === 1 ? (
                <>Opens Google Calendar with 1 attendee pre-filled.</>
              ) : (
                <>Opens Google Calendar with {selectedEmails.length} attendees pre-filled.</>
              )}
            </p>
          )}
        </div>
      </div>
    </>
  )
}

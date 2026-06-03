import { useState, useMemo, useEffect } from 'react'
import { MonthlyView } from './MonthlyView'
import { WeeklyView } from './WeeklyView'
import { DailyView } from './DailyView'
import { DateRequestModal } from './DateRequestModal'
import { useApp } from '../../contexts/AppContext'
import { getWeekStart, dateToStr, deriveSlotState, eventOverlapsSlot } from '../../utils/availability'
import { slotOverlapsWindow } from '../../utils/timeWindows'
import { OWNER_LABEL } from '../../hooks/useProjectPeople'
import { SlotRow } from './SlotRow'
import { Button } from '../ui/Button'
import { CalendarPlus, X, Check } from 'lucide-react'

const VIEWS = ['Monthly', 'Weekly', 'Daily']

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// "14:00" → "2:00 PM"
function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`
}

export function AvailabilityCalendar({
  slots, calendarEvents, connectedCalendars, availabilityRules = [], prefixRules = [],
  isOwner = false, slotStates: slotStatesProp, roomId, guestName, onRequestSubmit,
  dateRequests = [], sharedAvailability = [], businessHours = null, guestSlotSelection = false,
  guestEvents = null, ownerName = null, role: roleProp = null,
}) {
  const { slotStates: contextSlotStates } = useApp()
  const slotStates = slotStatesProp || contextSlotStates

  // Single source of truth for the calendar's audience/capabilities. Callers may pass
  // `role` explicitly; until every caller is migrated we derive it from the legacy
  // isOwner/roomId props so behavior is identical. (Convergence step A1.)
  //   pm-group      → owner inspecting one group's calendar (schedule/lock, day inspector)
  //   member-select → guest picking days/slots to share
  //   readonly      → standalone display (e.g. Default Availability preview)
  // ('pm-aggregate' is wired in a later step for the project overview grid.)
  const role = roleProp || (isOwner ? (roomId ? 'pm-group' : 'readonly') : (roomId ? 'member-select' : 'readonly'))
  const isSelectionMode = role === 'member-select'
  const isOwnerRoomContext = role === 'pm-group'

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
    if (!onRequestSubmit || !roomId) return false
    const success = await onRequestSubmit(roomId, data)
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
    <div className="lg:flex lg:gap-5 lg:items-start">
      <div className="flex-1 min-w-0">
      {/* Best days strip — owner room view only, when guests have connected */}
      {isOwnerRoomContext && (
        <BestDaysStrip
          slots={slots}
          calendarEvents={calendarEvents}
          connectedCalendars={connectedCalendars}
          prefixRules={prefixRules}
          businessHours={businessHours}
          dateRequests={dateRequests}
          sharedAvailability={sharedAvailability}
          onDaySelect={setInspectedDate}
        />
      )}

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
          <div className="fixed inset-0 bg-black/40 z-40 sm:hidden" onClick={() => setSlotPickerDate(null)} />
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
                const pickerDateObj = new Date(slotPickerDate + 'T00:00:00')
                const derived = deriveSlotState(pickerDateObj, slot, calendarEvents, connectedCalendars, prefixRules, businessHours)
                const stateColor = slotStates[derived.state]?.color || '#22c55e'
                const isAvailable = derived.state === 'available'
                const isGuestBusy = guestEvents !== null &&
                  guestEvents.some(ev => eventOverlapsSlot(pickerDateObj, slot, { ...ev, calendarId: 'primary' }))
                return (
                  <button key={slot.id} onClick={() => toggleSlotForDate(slotPickerDate, slot.id)}
                    className={`w-full text-left rounded-xl px-4 py-3 transition-all border ${
                      isChecked
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-surface-800 border-surface-700 hover:border-surface-500'
                    } ${isGuestBusy && !isChecked ? 'opacity-40' : ''}`}
                    style={{ borderLeftColor: stateColor, borderLeftWidth: '3px' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${isChecked ? 'text-zinc-100' : 'text-zinc-300'}`}>{slot.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{slot.startTime} – {slot.endTime}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isGuestBusy && !isChecked ? (
                          <span
                            className="flex items-center gap-1 text-[10px]"
                            style={{ color: slotStates.booked?.color || '#f59e0b' }}
                          >
                            <span
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: slotStates.booked?.color || '#f59e0b' }}
                            />
                            you're busy
                          </span>
                        ) : (
                          <span className={`text-[10px] ${isAvailable ? 'text-green-400' : 'text-zinc-600'}`}>
                            {slotStates[derived.state]?.label}
                          </span>
                        )}
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
                  Send my free days →
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
              <Button size="sm" onClick={() => setShowRequestModal(true)}>Send my free days →</Button>
            </div>
          </div>
        </div>
      )}
      </div>{/* /main column */}

      {/* Request modal — true overlay (commit action); fixed, so its place in the row is moot */}
      <DateRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        selectedDates={selectedDates}
        selectedSlotMap={selectedSlotMap}
        guestName={guestName}
        ownerName={ownerName}
        onSubmit={handleRequestSubmit}
      />

      {/* Day inspector panel — owner taps a day to see who's free + schedule */}
      {inspectedDate && isOwnerRoomContext && (
        <DayInspectorPanel
          dateStr={inspectedDate}
          roomId={roomId}
          slots={slots}
          dateRequests={dateRequests.filter(r => r.dates?.includes(inspectedDate) && r.status !== 'declined' && r.status !== 'archived')}
          sharedAvailability={sharedAvailability.filter(a => a.date === inspectedDate && a.is_available)}
          onClose={() => setInspectedDate(null)}
        />
      )}
    </div>
  )
}

/* ── Best Days Strip: top days where owner is free AND the most guests are available ── */
function BestDaysStrip({ slots, calendarEvents, connectedCalendars, prefixRules, businessHours,
  dateRequests, sharedAvailability, onDaySelect }) {

  const totalGuests = useMemo(() => {
    const names = new Set([
      ...dateRequests.filter(r => r.status !== 'declined' && r.status !== 'archived').map(r => r.requester_name),
      ...sharedAvailability.filter(a => a.is_available).map(a => a.guest_name),
    ])
    names.delete(undefined); names.delete(null); names.delete('')
    return names.size
  }, [dateRequests, sharedAvailability])

  const bestDays = useMemo(() => {
    if (totalGuests === 0) return []
    const today = new Date()
    const days = []
    for (let i = 0; i < 60; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const ds = dateToStr(date)

      // Owner must have at least one available slot
      const ownerFree = slots.some(slot => {
        const { state } = deriveSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules, businessHours)
        return state === 'available'
      })
      if (!ownerFree) continue

      const freeGuests = new Set([
        ...dateRequests.filter(r => r.dates?.includes(ds) && r.status !== 'declined' && r.status !== 'archived').map(r => r.requester_name),
        ...sharedAvailability.filter(a => a.date === ds && a.is_available).map(a => a.guest_name),
      ])
      freeGuests.delete(undefined); freeGuests.delete(null); freeGuests.delete('')

      if (freeGuests.size > 0) days.push({ date, ds, count: freeGuests.size })
    }
    return days.sort((a, b) => b.count - a.count).slice(0, 3)
  }, [slots, calendarEvents, connectedCalendars, prefixRules, businessHours, dateRequests, sharedAvailability, totalGuests])

  if (bestDays.length === 0) return null

  return (
    <div className="mb-5 bg-surface-800/40 border border-white/[0.06] rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Best days</span>
        <span className="text-[11px] text-zinc-600">· {totalGuests} {totalGuests === 1 ? 'person' : 'people'} connected</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {bestDays.map(({ date, ds, count }) => (
          <button key={ds} onClick={() => onDaySelect(ds)}
            className="text-left bg-surface-900 hover:bg-surface-800 border border-white/[0.06] hover:border-white/[0.14] rounded-lg px-3 py-2 transition-all duration-150 ease-ios">
            <p className="text-[13px] font-semibold text-zinc-100 tracking-tight">
              {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[11px] text-green-400 mt-0.5">{count}/{totalGuests} free</p>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Day Inspector: owner-only panel with overlap + Schedule in Google Calendar ──
 * Single-room by default. Pass `roomIds` (array) to inspect a whole project — the
 * caller combines every group's date-filtered requests/availability and we pull
 * member emails from all of those rooms. `actionLabel` renames the primary button. */
export function DayInspectorPanel({ dateStr, roomId, roomIds, slots = [], dateRequests, sharedAvailability, onClose, actionLabel = 'Schedule meeting', ownerLabel = OWNER_LABEL, ownerEmail: ownerEmailProp, windowFilter = null, totalKnown = null }) {
  const { getMembersForRoom, timezone, user } = useApp()
  // Owner's email: explicit override (guest view) wins; else the signed-in owner.
  const ownerEmail = ((ownerEmailProp ?? user?.email) || '').trim() || null
  const memberRoomIds = useMemo(
    () => (roomIds && roomIds.length ? roomIds : (roomId ? [roomId] : [])),
    [roomIds, roomId]
  )
  const members = useMemo(
    () => memberRoomIds.flatMap(id => getMembersForRoom(id)),
    [getMembersForRoom, memberRoomIds]
  )

  // Esc closes the panel — it has no dimming backdrop on desktop to click away on.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const dateObj = useMemo(() => new Date(dateStr + 'T00:00:00'), [dateStr])

  // Guest data for this day: name + email (from their request or from group_members).
  // Only people who said they're free THIS DAY.
  const guestData = useMemo(() => {
    const set = new Set()
    dateRequests.forEach(r => { if (r.requester_name) set.add(r.requester_name) })
    sharedAvailability.forEach(a => { if (a.guest_name) set.add(a.guest_name) })
    return [...set].map(name => {
      // The owner ("You") — use their account email from auth.
      if (name === ownerLabel) return { name, email: ownerEmail }
      const fromRequest = dateRequests.find(r => r.requester_name === name)?.requester_email
      const fromMember = members.find(m => m.name === name)?.email
      const email = (fromRequest || fromMember || '').trim()
      return { name, email: email || null }
    })
  }, [dateRequests, sharedAvailability, members, ownerEmail])

  // Group members who HAVEN'T said they're free — still inviteable if this is
  // the most convenient day and they didn't respond.
  const otherMembers = useMemo(() => {
    const responded = new Set(guestData.map(g => g.name))
    return members
      .filter(m => m.name && !responded.has(m.name))
      .map(m => ({ name: m.name, email: (m.email || '').trim() || null }))
  }, [guestData, members])

  // Unified email lookup so selectedNames can reference either group
  const emailByName = useMemo(() => {
    const map = new Map()
    guestData.forEach(g => { if (g.email) map.set(g.name, g.email) })
    otherMembers.forEach(m => { if (m.email && !map.has(m.name)) map.set(m.name, m.email) })
    return map
  }, [guestData, otherMembers])

  // Selected names (to include as attendees) — default to everyone who said
  // they're free AND has an email. Non-responders are opt-in.
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
    () => [...selectedNames].map(n => emailByName.get(n)).filter(Boolean),
    [selectedNames, emailByName]
  )

  // Slot picker expansion state
  const [showSlotPicker, setShowSlotPicker] = useState(false)

  // Best slots: top 3 by free count (when guests exist), else top 3 slots for quick-schedule.
  // Filtered to the chosen time-of-day window when one is active.
  const bestSlots = useMemo(() => {
    if (!slotOverlap.rows.length) return []
    const windowed = windowFilter
      ? slotOverlap.rows.filter(({ slot }) => slotOverlapsWindow(slot, windowFilter))
      : slotOverlap.rows
    const source = windowed.length > 0 ? windowed : slotOverlap.rows
    const sorted = [...source].sort((a, b) => b.freeCount - a.freeCount)
    const withFree = sorted.filter(r => r.freeCount > 0)
    return (withFree.length > 0 ? withFree : sorted).slice(0, 3)
  }, [slotOverlap, windowFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scheduling form state ──
  // Default title from who's selected; user can override.
  const defaultTitle = useMemo(() => {
    // Title names the OTHER people — you don't title a meeting after yourself.
    const list = [...selectedNames].filter(n => n !== ownerLabel)
    if (list.length === 1) return `Meeting with ${list[0]}`
    if (list.length > 1) return `Meeting · ${list.slice(0, 2).join(' & ')}${list.length > 2 ? ` +${list.length - 2}` : ''}`
    return 'Meeting'
  }, [selectedNames])
  const [title, setTitle] = useState(defaultTitle)
  const [titleDirty, setTitleDirty] = useState(false)
  useEffect(() => { if (!titleDirty) setTitle(defaultTitle) }, [defaultTitle, titleDirty])

  // Prefill the time window from the best-overlap slot, else 2–3pm.
  const bestSlot = useMemo(() => {
    if (!slotOverlap.rows.length) return null
    return [...slotOverlap.rows].sort((a, b) => b.freeCount - a.freeCount)[0]?.slot || null
  }, [slotOverlap])
  const [startTime, setStartTime] = useState(bestSlot?.startTime || '14:00')
  const [endTime, setEndTime] = useState(bestSlot?.endTime || '15:00')
  // Two-click flow: tapping a slot SELECTS it (sets the time); the Schedule
  // button below is what actually opens Google Calendar.
  const [selectedSlotId, setSelectedSlotId] = useState(bestSlot?.id || null)
  useEffect(() => {
    if (bestSlot) { setStartTime(bestSlot.startTime); setEndTime(bestSlot.endTime); setSelectedSlotId(bestSlot.id) }
  }, [bestSlot?.startTime, bestSlot?.endTime, bestSlot?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectSlot(slot) {
    setSelectedSlotId(slot.id)
    setStartTime(slot.startTime)
    setEndTime(slot.endTime)
  }

  function buildDescription() {
    const detailsLines = ['Scheduled via Coordie.']
    const selectedList = [...selectedNames]
    const respondedSet = new Set(guestData.map(g => g.name))
    const confirmedInvitees = selectedList.filter(n => respondedSet.has(n))
    const otherInvitees = selectedList.filter(n => !respondedSet.has(n))
    if (confirmedInvitees.length > 0) {
      detailsLines.push('')
      detailsLines.push(`Confirmed free for ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: ${confirmedInvitees.join(', ')}.`)
    }
    if (otherInvitees.length > 0) {
      if (confirmedInvitees.length === 0) detailsLines.push('')
      detailsLines.push(`Also invited: ${otherInvitees.join(', ')}.`)
    }
    return detailsLines.join('\n')
  }

  // Native in-app creation (createCalendarEvent + create_event edge action) is
  // parked until Google re-verification of the calendar.events scope. For now
  // "Schedule meeting" opens a prefilled Google Calendar tab (no write scope).
  // To re-enable native: call createCalendarEvent(...) here + flip startGoogleAuth
  // to OWNER_SCOPES (see googleCalendar.js).
  function handleCreate(slotOverride = null) {
    openGCalTemplate(slotOverride)
  }

  // Open a prefilled Google Calendar template in a new tab (no write scope).
  function openGCalTemplate(slot = null) {
    const datePart = dateStr.replace(/-/g, '')
    const st = (slot ? slot.startTime : startTime).replace(':', '')
    const en = (slot ? slot.endTime : endTime).replace(':', '')
    const dates = `${datePart}T${st}00/${datePart}T${en}00`
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title.trim() || 'Meeting',
      dates,
      details: buildDescription(),
    })
    if (selectedEmails.length > 0) params.set('add', selectedEmails.join(','))
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      {/* Backdrop — small screens only (the panel is a bottom sheet there). On lg+ the
          panel is an in-flow right column beside the calendar, so no backdrop. */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn lg:hidden"
        onClick={onClose}
      />

      {/* Panel: bottom sheet on small screens; on lg+ a real flush sidebar — full
          height, anchored to the right edge with a left divider (no floating card). */}
      <div className="bg-surface-900 flex flex-col safe-bottom
        fixed inset-x-0 bottom-0 z-50 max-h-[88vh] rounded-t-[20px] border-t border-white/[0.06] shadow-[0_-12px_40px_-8px_rgb(0_0_0/0.6)] animate-slideUp
        lg:static lg:inset-auto lg:z-auto lg:h-full lg:max-h-full lg:w-[380px] lg:shrink-0 lg:rounded-none lg:border-0 lg:border-l lg:border-white/[0.07] lg:shadow-none lg:animate-none">

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
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6">

          {/* ── Best times for everyone ── */}
          {bestSlots.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
                {guestData.length > 0 ? 'Best times for everyone' : 'Quick schedule'}
              </p>
              <div className="space-y-2">
                {bestSlots.map(({ slot, freeCount, freeNames }) => {
                  const total = totalKnown !== null ? totalKnown : guestData.length
                  const isSelected = selectedSlotId === slot.id
                  return (
                    <SlotRow
                      key={slot.id}
                      state={isSelected ? 'selected' : 'available'}
                      barColor={slot.color || '#5e9c8c'}
                      name={slot.name}
                      time={`${slot.startTime} – ${slot.endTime}`}
                      onClick={() => selectSlot(slot)}
                      hint={freeNames.length > 0 ? `Free: ${freeNames.join(', ')}` : undefined}
                      trailing={
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          {total > 0 && (
                            <span className={`text-[13px] font-bold tabular-nums ${isSelected ? 'text-accent' : 'text-zinc-400'}`}>
                              {freeCount}/{total}
                            </span>
                          )}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150 ${
                            isSelected ? 'bg-accent text-white' : 'border border-white/20'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={2.5} />}
                          </div>
                        </div>
                      }
                    />
                  )
                })}
              </div>

              {/* Pick a different time — expands remaining slots (best slots already shown above) */}
              {slotOverlap.rows.length > bestSlots.length && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowSlotPicker(s => !s)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all duration-150"
                  >
                    <span>Pick a different time</span>
                    <span className="text-zinc-600 transition-transform duration-200" style={{ display: 'inline-block', transform: showSlotPicker ? 'rotate(180deg)' : 'rotate(0deg)' }}>↓</span>
                  </button>

                  {showSlotPicker && (
                    <div className="mt-2 space-y-1.5 animate-fadeIn">
                      {slotOverlap.rows.filter(r => !bestSlots.some(b => b.slot.id === r.slot.id)).map(({ slot, freeCount, freeNames }) => {
                        const total = totalKnown !== null ? totalKnown : guestData.length
                        const isBusy = total > 0 && freeCount === 0
                        const isAll = total > 0 && freeCount === total
                        const isSelected = selectedSlotId === slot.id
                        return (
                          <SlotRow
                            key={slot.id}
                            state={isSelected ? 'selected' : isBusy ? 'busy' : 'available'}
                            barColor={isBusy ? '#52525b' : (slot.color || '#5e9c8c')}
                            name={slot.name}
                            time={`${slot.startTime} – ${slot.endTime}`}
                            onClick={() => selectSlot(slot)}
                            hint={freeNames.length > 0 ? `Free: ${freeNames.join(', ')}` : undefined}
                            trailing={total > 0 ? (
                              isBusy ? (
                                <span className="flex items-center gap-1 text-[10px] text-zinc-700 flex-shrink-0">
                                  <span className="w-1 h-1 rounded-full bg-zinc-700" /> busy
                                </span>
                              ) : (
                                <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${isAll ? 'text-accent' : 'text-zinc-400'}`}>
                                  {freeCount}/{total}
                                </span>
                              )
                            ) : null}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── People who are free ── */}
          {guestData.length > 0 && (
            <>
              <div className="flex items-baseline gap-2 mb-4 mt-1">
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
            </>
          )}

          {/* Also invite: group members who haven't said they're free. */}
          {otherMembers.length > 0 && (
            <div className="mb-6">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-1.5">Also invite</p>
              <p className="text-[12px] text-zinc-500 mb-3 leading-relaxed">
                Group members who haven&rsquo;t confirmed — still worth inviting if this works.
              </p>
              <div className="space-y-1.5">
                {otherMembers.map(({ name, email }) => {
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
                          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 border ${
                        selected
                          ? 'bg-accent/20 border-accent/35 text-accent'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-500'
                      }`}>
                        {name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-zinc-200 truncate leading-tight">{name}</p>
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
            </div>
          )}

          {bestSlots.length === 0 && guestData.length === 0 && otherMembers.length === 0 && (
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

        {/* Schedule form — title + one-tap schedule. Time comes from the best-times
            cards above; no manual time picker (kept lean). */}
        <div className="px-6 py-5 border-t border-white/[0.05] space-y-3">
          {/* Title */}
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setTitleDirty(true) }}
            placeholder="Meeting title"
            className="w-full bg-surface-800 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[14px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all"
          />

          <button
            onClick={() => handleCreate()}
            className="w-full min-h-touch flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-[15px] font-semibold transition-all duration-200 ease-ios shadow-[0_8px_24px_-8px_rgb(94_156_140/0.55)]"
          >
            <CalendarPlus size={16} strokeWidth={2} />
            {actionLabel}
          </button>
          <p className="text-[12px] text-zinc-500 text-center leading-relaxed">
            {fmtTime(startTime)} – {fmtTime(endTime)} · opens Google Calendar prefilled{selectedEmails.length > 0 ? ` · ${selectedEmails.length} ${selectedEmails.length === 1 ? 'attendee' : 'attendees'}` : ''}
          </p>
        </div>
      </div>
    </>
  )
}

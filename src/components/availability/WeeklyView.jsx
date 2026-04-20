import { useMemo } from 'react'
import { deriveAvailabilityMatrix, getWeekDays, dateToStr, DEFAULT_SLOT_STATES, eventOverlapsSlot } from '../../utils/availability'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeeklyView({
  weekStart, slots, calendarEvents, connectedCalendars, prefixRules = [],
  onDayClick, isOwner, slotStates = DEFAULT_SLOT_STATES,
  selectedDates = [], isSelectionMode = false, businessHours = null,
  dateRequests = [], sharedAvailability = [],
  guestSlotSelection = false, selectedSlotMap = {}, toggleSlotForDate = null,
  guestEvents = null,
}) {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart])
  const matrix = useMemo(
    () => deriveAvailabilityMatrix(days, slots, calendarEvents, connectedCalendars, prefixRules, businessHours),
    [days, slots, calendarEvents, connectedCalendars, prefixRules, businessHours]
  )

  const todayStr = dateToStr(new Date())

  // Day-level overlap for column headers
  function getDayOverlap(ds) {
    const guests = new Set([
      ...dateRequests
        .filter(r => r.dates?.includes(ds) && r.status !== 'declined' && r.status !== 'archived')
        .map(r => r.requester_name),
      ...sharedAvailability
        .filter(a => a.date === ds && a.is_available)
        .map(a => a.guest_name),
    ])
    guests.delete(undefined); guests.delete(null); guests.delete('')
    return guests
  }

  // Slot-level overlap: back-compat — date-only requests count for all slots
  function getSlotOverlap(ds, slotId) {
    const guests = new Set()
    dateRequests
      .filter(r => r.dates?.includes(ds) && r.status !== 'declined' && r.status !== 'archived')
      .forEach(r => {
        const slotIds = r.slot_map?.[ds]
        if (Array.isArray(slotIds)) {
          if (slotIds.includes(slotId)) guests.add(r.requester_name)
        } else {
          if (r.requester_name) guests.add(r.requester_name)
        }
      })
    sharedAvailability
      .filter(a => a.date === ds && a.is_available)
      .forEach(a => { if (a.guest_name) guests.add(a.guest_name) })
    guests.delete(undefined); guests.delete(null); guests.delete('')
    return guests
  }

  // Per-day: does this day have any slot-level (not day-only) request data?
  function dayHasSlotData(ds) {
    return dateRequests.some(
      r => r.dates?.includes(ds) && r.status !== 'declined' && r.status !== 'archived' && r.slot_map?.[ds] != null
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-16 sm:w-28 text-left pb-3 pr-1 sm:pr-3">
              <span className="text-xs text-zinc-600 font-medium hidden sm:inline">Slot</span>
            </th>
            {days.map((day, i) => {
              const ds = dateToStr(day)
              const isToday = ds === todayStr
              const isSelected = selectedDates.includes(ds)
              const overlapGuests = getDayOverlap(ds)
              const overlapCount = overlapGuests.size
              const hasSlotData = dayHasSlotData(ds)
              return (
                <th key={i} className="pb-3 px-0.5 sm:px-1 text-center min-w-[40px] sm:min-w-[80px]">
                  <button
                    onClick={() => onDayClick(day)}
                    aria-label={overlapCount > 0
                      ? `${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. ${overlapCount} ${overlapCount === 1 ? 'request' : 'requests'}: ${[...overlapGuests].join(', ')}`
                      : day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    className={`group/weekday relative text-center w-full rounded-lg py-1 sm:py-1.5 px-1 sm:px-2 transition-colors hover:bg-surface-700
                      ${isToday ? 'text-accent' : 'text-zinc-400'}
                      ${isSelected ? 'ring-2 ring-accent bg-accent/10' : ''}
                    `}
                  >
                    <div className="text-xs font-medium">
                      <span className="hidden sm:inline">{DAY_LABELS[i]}</span>
                      <span className="sm:hidden">{DAY_LABELS[i][0]}</span>
                    </div>
                    <div className={`text-base sm:text-lg font-semibold leading-none mt-0.5 ${
                      isSelected ? 'text-accent' : isToday ? 'text-accent' : 'text-zinc-200'
                    }`}>
                      {day.getDate()}
                    </div>
                    {/* Fixed-height dot row — reserves space so all columns stay the same height */}
                    <div className="h-[10px] mt-1 flex items-center justify-center">
                      {overlapCount > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_-1px_rgba(139,92,246,0.8)]" />
                      )}
                    </div>

                    {/* Hover card with requester names */}
                    {overlapCount > 0 && (
                      <div className="hidden sm:block pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 opacity-0 group-hover/weekday:opacity-100 transition-opacity duration-150 ease-ios">
                        <div className="bg-surface-950 border border-white/10 shadow-lift rounded-lg px-3 py-2 min-w-[140px] max-w-[220px] text-left">
                          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-1.5 whitespace-nowrap">
                            {isOwner ? `${overlapCount} ${overlapCount === 1 ? 'request' : 'requests'}` : `${overlapCount} ${overlapCount === 1 ? 'person' : 'people'} free`}
                          </p>
                          <ul className="space-y-0.5">
                            {[...overlapGuests].slice(0, 6).map(name => (
                              <li key={name} className="text-xs text-zinc-200 truncate">{name}</li>
                            ))}
                            {overlapGuests.size > 6 && (
                              <li className="text-[11px] text-zinc-500 pt-0.5">+{overlapGuests.size - 6} more</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {slots.map(slot => (
            <tr key={slot.id} className="border-t border-surface-700">
              <td className="py-2 sm:py-3 pr-1 sm:pr-3">
                <div className="text-xs font-medium text-zinc-400 leading-tight">{slot.name}</div>
                <div className="text-xs text-zinc-600 hidden sm:block">{slot.startTime}–{slot.endTime}</div>
              </td>
              {days.map((day, i) => {
                const ds = dateToStr(day)
                const { state } = matrix[ds]?.[slot.id] ?? { state: slot.defaultState }
                const meta = slotStates[state] || DEFAULT_SLOT_STATES[state]
                const isToday = ds === todayStr

                // Guest: is this slot selected?
                const isChecked = isSelectionMode && guestSlotSelection && (selectedSlotMap[ds] || []).includes(slot.id)

                // Owner: how many guests want this slot?
                const slotGuests = isOwner ? getSlotOverlap(ds, slot.id) : null
                const slotCount = slotGuests?.size ?? 0

                // Guest: is THIS user busy in their personal calendar during this slot?
                const isGuestBusy = guestEvents !== null &&
                  guestEvents.some(ev => eventOverlapsSlot(day, slot, { ...ev, calendarId: 'primary' }))

                return (
                  <td key={i} className="py-1 sm:py-1.5 px-0.5 sm:px-1">
                    <button
                      onClick={() => {
                        if (isSelectionMode && guestSlotSelection && toggleSlotForDate) {
                          toggleSlotForDate(ds, slot.id)
                        } else {
                          onDayClick(day)
                        }
                      }}
                      aria-label={
                        isGuestBusy ? `You're busy: ${meta.label}` :
                        isOwner && slotCount > 0
                          ? `${slotCount} free: ${[...slotGuests].join(', ')}`
                          : meta.label
                      }
                      className={`group/slot relative w-full rounded-lg py-2 sm:py-3 flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all
                        hover:opacity-90
                        ${isToday ? 'ring-1 ring-accent' : ''}
                        ${isChecked ? 'ring-2 ring-accent' : ''}
                        ${isGuestBusy && !isChecked ? 'grayscale opacity-50' : ''}
                      `}
                      style={{
                        backgroundColor: isChecked ? '#8b5cf633' : meta.color + '22',
                        border: isChecked ? '1px solid #8b5cf660' : `1px solid ${meta.color}44`,
                      }}
                    >
                      {isGuestBusy && !isChecked && (
                        <span
                          className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: slotStates.booked?.color || '#f59e0b' }}
                        />
                      )}
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isChecked ? '#8b5cf6' : meta.color }} />
                      <span className="text-xs font-medium hidden sm:inline" style={{ color: isChecked ? '#8b5cf6' : meta.color }}>
                        {isChecked ? '✓' : meta.label}
                      </span>
                      {/* Owner: per-slot interest indicator — calm dot on both mobile and desktop */}
                      {isOwner && slotCount > 0 && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_-1px_rgba(139,92,246,0.8)]" />
                      )}

                      {/* Desktop hover card with requester names */}
                      {isOwner && slotCount > 0 && (
                        <div className="hidden sm:block pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 opacity-0 group-hover/slot:opacity-100 transition-opacity duration-150 ease-ios">
                          <div className="bg-surface-950 border border-white/10 shadow-lift rounded-lg px-3 py-2 min-w-[140px] max-w-[220px] text-left">
                            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-1.5 whitespace-nowrap">
                              {slotCount} {slotCount === 1 ? 'request' : 'requests'}
                            </p>
                            <ul className="space-y-0.5">
                              {[...slotGuests].slice(0, 6).map(name => (
                                <li key={name} className="text-xs text-zinc-200 truncate">{name}</li>
                              ))}
                              {slotGuests.size > 6 && (
                                <li className="text-[11px] text-zinc-500 pt-0.5">+{slotGuests.size - 6} more</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

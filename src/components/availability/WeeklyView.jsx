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
                    className={`relative text-center w-full rounded-lg py-1 sm:py-1.5 px-1 sm:px-2 transition-colors hover:bg-surface-700
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
                    {/* Fixed-height badge row — always reserves space so all columns stay the same height */}
                    <div className="h-[18px] mt-1 flex items-center justify-center">
                      {overlapCount > 0 && (
                        <div
                          className={`flex items-center justify-center rounded-full font-semibold shadow-[0_2px_8px_-2px_rgba(139,92,246,0.6)] ${
                            overlapCount >= 2
                              ? 'bg-accent text-white min-w-[18px] h-[18px] px-1 text-[10px]'
                              : 'bg-accent/90 text-white min-w-[16px] h-4 px-1 text-[10px]'
                          }`}
                          title={isOwner ? `${overlapCount} ${overlapCount === 1 ? 'person' : 'people'} free: ${[...overlapGuests].join(', ')}` : `${overlapCount} ${overlapCount === 1 ? 'person' : 'people'} available`}
                        >
                          {overlapCount}
                        </div>
                      )}
                    </div>
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
                      title={
                        isGuestBusy ? `You're busy: ${meta.label}` :
                        isOwner && slotCount > 0
                          ? `${slotCount} free: ${[...slotGuests].join(', ')}`
                          : meta.label
                      }
                      className={`relative w-full rounded-lg py-2 sm:py-3 flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all
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
                        <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-zinc-400" title="You're busy" />
                      )}
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isChecked ? '#8b5cf6' : meta.color }} />
                      <span className="text-xs font-medium hidden sm:inline" style={{ color: isChecked ? '#8b5cf6' : meta.color }}>
                        {isChecked ? '✓' : meta.label}
                      </span>
                      {/* Owner: per-slot interest indicator — dot on mobile, count badge on desktop */}
                      {isOwner && slotCount > 0 && (
                        <>
                          <span className="sm:hidden absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent/75" />
                          <span className="hidden sm:flex absolute top-0.5 right-0.5 text-[9px] font-bold text-white bg-accent rounded-full leading-none px-1 min-w-[14px] h-[14px] items-center justify-center shadow-[0_1px_4px_rgba(139,92,246,0.5)]">
                            {slotCount}
                          </span>
                        </>
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

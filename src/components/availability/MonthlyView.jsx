import { useMemo } from 'react'
import { deriveAvailabilityMatrix, getMonthGrid, dateToStr, DEFAULT_SLOT_STATES, eventOverlapsSlot } from '../../utils/availability'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthlyView({
  year, month, slots, calendarEvents, connectedCalendars, prefixRules = [],
  onDayClick, isOwner, slotStates = DEFAULT_SLOT_STATES,
  selectedDates = [], isSelectionMode = false,
  dateRequests = [], sharedAvailability = [], businessHours = null,
  guestEvents = null,
}) {
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const dates = useMemo(() => grid.map(d => d.date), [grid])
  const matrix = useMemo(
    () => deriveAvailabilityMatrix(dates, slots, calendarEvents, connectedCalendars, prefixRules, businessHours),
    [dates, slots, calendarEvents, connectedCalendars, prefixRules, businessHours]
  )

  // Days where the guest has at least one slot that's free in their personal calendar
  const guestFreeDays = useMemo(() => {
    if (!guestEvents) return null
    const out = new Set()
    for (const date of dates) {
      const free = slots.some(s =>
        !guestEvents.some(ev => eventOverlapsSlot(date, s, { ...ev, calendarId: 'primary' }))
      )
      if (free) out.add(dateToStr(date))
    }
    return out
  }, [guestEvents, dates, slots])

  const todayStr = dateToStr(new Date())

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-zinc-600 py-2">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }, i) => {
          const ds = dateToStr(date)
          const dayMatrix = matrix[ds] ?? {}
          const isToday = ds === todayStr
          const isSelected = selectedDates.includes(ds)

          // Unique guests who indicated they're free this day — both mechanisms
          const overlapGuests = new Set([
            ...dateRequests
              .filter(r => r.dates?.includes(ds) && r.status !== 'declined' && r.status !== 'archived')
              .map(r => r.requester_name),
            ...sharedAvailability
              .filter(a => a.date === ds && a.is_available)
              .map(a => a.guest_name),
          ])
          overlapGuests.delete(undefined)
          overlapGuests.delete(null)
          overlapGuests.delete('')
          const overlapCount = overlapGuests.size

          // Cell tint intensifies with overlap — the "heat" of overlap is immediately readable
          const overlapBg =
            overlapCount >= 3 ? 'bg-accent/[0.14] ring-1 ring-accent/30 shadow-[0_0_0_1px_rgba(139,92,246,0.15)]' :
            overlapCount === 2 ? 'bg-accent/[0.09] ring-1 ring-accent/20' :
            overlapCount === 1 ? 'bg-accent/[0.05]' :
            'bg-surface-800'

          return (
            <button
              key={i}
              onClick={() => onDayClick(date)}
              disabled={!inMonth}
              className={`relative min-h-[56px] sm:min-h-[72px] rounded-lg p-1.5 sm:p-2 text-left transition-all duration-200 ease-ios flex flex-col
                ${inMonth ? 'hover:ring-1 hover:ring-white/20 cursor-pointer' : 'opacity-20 cursor-default'}
                ${isSelected ? 'ring-2 ring-accent bg-accent/20' : overlapBg}
                ${isToday && !isSelected ? 'ring-1 ring-accent/60' : ''}
              `}
            >
              {/* Overlap count badge — the primary signal */}
              {inMonth && overlapCount > 0 && !isSelected && (
                <div
                  className={`absolute top-1 right-1 z-10 flex items-center justify-center rounded-full font-semibold tracking-tight shadow-[0_2px_8px_-2px_rgba(139,92,246,0.6)] ${
                    overlapCount >= 2
                      ? 'bg-accent text-white min-w-[18px] h-[18px] px-1 text-[10px] sm:text-[11px]'
                      : 'bg-accent/90 text-white min-w-[16px] h-4 px-1 text-[10px]'
                  }`}
                  title={`${overlapCount} ${overlapCount === 1 ? 'person' : 'people'} free: ${[...overlapGuests].join(', ')}`}
                >
                  {overlapCount}
                </div>
              )}

              <span className={`text-xs font-medium mb-1 flex items-center gap-1 ${
                isSelected ? 'text-white' :
                overlapCount > 0 ? 'text-zinc-50 font-semibold' :
                isToday ? 'text-accent' :
                inMonth ? 'text-zinc-300' :
                'text-zinc-600'
              }`}>
                {date.getDate()}
                {inMonth && guestFreeDays?.has(ds) && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="You have free time this day" />
                )}
              </span>

              {inMonth && (
                <div className="flex flex-col gap-0.5 flex-1">
                  {slots.length <= 4 ? (
                    /* Named slots — individual bars */
                    slots.map(slot => {
                      const state = dayMatrix[slot.id]?.state ?? slot.defaultState
                      const meta = slotStates[state] || DEFAULT_SLOT_STATES[state]
                      const slotGuestBusy = guestEvents !== null &&
                        guestEvents.some(ev => eventOverlapsSlot(date, slot, { ...ev, calendarId: 'primary' }))
                      return (
                        <div
                          key={slot.id}
                          className={`h-3 sm:h-4 rounded-sm flex-shrink-0 ${slotGuestBusy ? 'opacity-20' : 'opacity-80'}`}
                          style={{ backgroundColor: meta.color }}
                          title={slotGuestBusy ? `${slot.name}: you're busy` : `${slot.name}: ${meta.label}`}
                        />
                      )
                    })
                  ) : (
                    /* Many time blocks — compact stacked stripes */
                    <div className="flex flex-col flex-1 rounded-sm overflow-hidden">
                      {slots.map(slot => {
                        const state = dayMatrix[slot.id]?.state ?? slot.defaultState
                        const meta = slotStates[state] || DEFAULT_SLOT_STATES[state]
                        const slotGuestBusy = guestEvents !== null &&
                          guestEvents.some(ev => eventOverlapsSlot(date, slot, { ...ev, calendarId: 'primary' }))
                        return (
                          <div key={slot.id} className={`flex-1 min-h-0 ${slotGuestBusy ? 'opacity-20' : ''}`}
                            style={{ backgroundColor: meta.color }}
                            title={slotGuestBusy ? `${slot.name}: you're busy` : `${slot.name}: ${meta.label}`} />
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

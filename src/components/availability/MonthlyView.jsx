import { useMemo } from 'react'
import { deriveAvailabilityMatrix, getMonthGrid, dateToStr, DEFAULT_SLOT_STATES } from '../../utils/availability'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthlyView({
  year, month, slots, calendarEvents, connectedCalendars, prefixRules = [],
  onDayClick, isOwner, slotStates = DEFAULT_SLOT_STATES,
  selectedDates = [], isSelectionMode = false,
  dateRequests = [], sharedAvailability = [], businessHours = null,
}) {
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const dates = useMemo(() => grid.map(d => d.date), [grid])
  const matrix = useMemo(
    () => deriveAvailabilityMatrix(dates, slots, calendarEvents, connectedCalendars, prefixRules, businessHours),
    [dates, slots, calendarEvents, connectedCalendars, prefixRules, businessHours]
  )

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

          return (
            <button
              key={i}
              onClick={() => onDayClick(date)}
              disabled={!inMonth}
              className={`min-h-[48px] sm:min-h-[72px] rounded-lg p-1 sm:p-1.5 text-left transition-all flex flex-col
                ${inMonth ? 'hover:ring-1 hover:ring-zinc-500 cursor-pointer' : 'opacity-20 cursor-default'}
                ${isToday ? 'ring-1 ring-accent' : 'bg-surface-800'}
                ${isSelected ? 'ring-2 ring-accent bg-accent/10' : ''}
              `}
            >
              <span className={`text-xs font-medium mb-1 ${
                isSelected ? 'text-accent' : isToday ? 'text-accent' : inMonth ? 'text-zinc-300' : 'text-zinc-600'
              }`}>
                {date.getDate()}
              </span>
              {inMonth && (
                <div className="flex flex-col gap-0.5 flex-1">
                  {slots.length <= 4 ? (
                    /* Named slots — show individual bars */
                    slots.map(slot => {
                      const state = dayMatrix[slot.id]?.state ?? slot.defaultState
                      const meta = slotStates[state] || DEFAULT_SLOT_STATES[state]
                      return (
                        <div
                          key={slot.id}
                          className="h-3 sm:h-4 rounded-sm flex-shrink-0 opacity-80"
                          style={{ backgroundColor: meta.color }}
                          title={`${slot.name}: ${meta.label}`}
                        />
                      )
                    })
                  ) : (
                    /* Many time blocks — compact stacked stripes with phase dividers */
                    (() => {
                      return (
                        <div className="flex flex-col flex-1 rounded-sm overflow-hidden">
                          {slots.map(slot => {
                            const state = dayMatrix[slot.id]?.state ?? slot.defaultState
                            const meta = slotStates[state] || DEFAULT_SLOT_STATES[state]
                            return (
                              <div key={slot.id} className="flex-1 min-h-0"
                                style={{ backgroundColor: meta.color }}
                                title={`${slot.name}: ${meta.label}`} />
                            )
                          })}
                        </div>
                      )
                    })()
                  )}
                  {/* Overlay: date requests + shared availability */}
                  {(() => {
                    const reqCount = dateRequests.filter(r => r.dates?.includes(ds) && r.status !== 'declined').length
                    const availForDay = sharedAvailability.filter(a => a.date === ds && a.is_available)
                    const totalGuests = new Set(sharedAvailability.filter(a => a.date === ds).map(a => a.guest_name)).size
                    const freeCount = new Set(availForDay.map(a => a.guest_name)).size
                    return (reqCount > 0 || freeCount > 0) ? (
                      <div className="flex items-center gap-1 mt-auto pt-0.5">
                        {reqCount > 0 && (
                          <span className="text-[8px] sm:text-[9px] font-medium text-amber-400" title={`${reqCount} date request${reqCount !== 1 ? 's' : ''}`}>
                            {reqCount} req
                          </span>
                        )}
                        {freeCount > 0 && (
                          <span className={`text-[8px] sm:text-[9px] font-medium ${freeCount === totalGuests ? 'text-green-400' : 'text-zinc-500'}`}
                            title={`${freeCount} of ${totalGuests} people are free`}>
                            {freeCount}/{totalGuests}
                          </span>
                        )}
                      </div>
                    ) : null
                  })()}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

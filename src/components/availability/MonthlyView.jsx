import { useMemo } from 'react'
import { SLOT_STATES, deriveAvailabilityMatrix, getMonthGrid, dateToStr } from '../../utils/availability'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthlyView({ year, month, slots, calendarEvents, connectedCalendars, prefixRules = [], onDayClick, isOwner }) {
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])

  const dates = useMemo(() => grid.map(d => d.date), [grid])
  const matrix = useMemo(
    () => deriveAvailabilityMatrix(dates, slots, calendarEvents, connectedCalendars, prefixRules),
    [dates, slots, calendarEvents, connectedCalendars, prefixRules]
  )

  const todayStr = dateToStr(new Date())

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-zinc-600 py-2">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }, i) => {
          const ds = dateToStr(date)
          const dayMatrix = matrix[ds] ?? {}
          const isToday = ds === todayStr

          // Collect unique states for this day's slots
          const states = slots.map(s => dayMatrix[s.id]?.state ?? s.defaultState)
          const hasBlocked = states.includes('blocked')
          const hasHold = states.includes('hold')
          const hasBooked = states.includes('booked')

          return (
            <button
              key={i}
              onClick={() => onDayClick(date)}
              disabled={!inMonth}
              className={`min-h-[72px] rounded-lg p-1.5 text-left transition-all flex flex-col
                ${inMonth ? 'hover:ring-1 hover:ring-zinc-500 cursor-pointer' : 'opacity-20 cursor-default'}
                ${isToday ? 'ring-1 ring-accent' : 'bg-surface-800'}
              `}
            >
              <span className={`text-xs font-medium mb-1 ${isToday ? 'text-accent' : inMonth ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {date.getDate()}
              </span>
              {inMonth && (
                <div className="flex flex-col gap-0.5 flex-1">
                  {slots.map(slot => {
                    const state = dayMatrix[slot.id]?.state ?? slot.defaultState
                    const meta = SLOT_STATES[state]
                    return (
                      <div
                        key={slot.id}
                        className={`h-2 rounded-sm flex-shrink-0 opacity-80`}
                        style={{ backgroundColor: meta.color }}
                        title={`${slot.name}: ${meta.label}`}
                      />
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

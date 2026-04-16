import { useMemo } from 'react'
import { deriveAvailabilityMatrix, getMonthGrid, dateToStr, DEFAULT_SLOT_STATES } from '../../utils/availability'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthlyView({
  year, month, slots, calendarEvents, connectedCalendars, prefixRules = [],
  onDayClick, isOwner, slotStates = DEFAULT_SLOT_STATES,
  selectedDates = [], isSelectionMode = false,
}) {
  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const dates = useMemo(() => grid.map(d => d.date), [grid])
  const matrix = useMemo(
    () => deriveAvailabilityMatrix(dates, slots, calendarEvents, connectedCalendars, prefixRules),
    [dates, slots, calendarEvents, connectedCalendars, prefixRules]
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
                  {slots.map(slot => {
                    const state = dayMatrix[slot.id]?.state ?? slot.defaultState
                    const meta = slotStates[state] || DEFAULT_SLOT_STATES[state]
                    return (
                      <div
                        key={slot.id}
                        className="h-2 rounded-sm flex-shrink-0 opacity-80"
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

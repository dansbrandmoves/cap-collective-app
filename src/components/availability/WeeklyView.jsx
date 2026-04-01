import { useMemo } from 'react'
import { SLOT_STATES, deriveAvailabilityMatrix, getWeekDays, dateToStr } from '../../utils/availability'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeeklyView({ weekStart, slots, calendarEvents, connectedCalendars, prefixRules = [], onDayClick, isOwner }) {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart])

  const matrix = useMemo(
    () => deriveAvailabilityMatrix(days, slots, calendarEvents, connectedCalendars, prefixRules),
    [days, slots, calendarEvents, connectedCalendars, prefixRules]
  )

  const todayStr = dateToStr(new Date())

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {/* Slot label column */}
            <th className="w-16 sm:w-28 text-left pb-3 pr-1 sm:pr-3">
              <span className="text-xs text-zinc-600 font-medium hidden sm:inline">Slot</span>
            </th>
            {days.map((day, i) => {
              const ds = dateToStr(day)
              const isToday = ds === todayStr
              return (
                <th key={i} className="pb-3 px-0.5 sm:px-1 text-center min-w-[40px] sm:min-w-[80px]">
                  <button
                    onClick={() => onDayClick(day)}
                    className={`text-center w-full rounded-lg py-1 sm:py-1.5 px-1 sm:px-2 transition-colors hover:bg-surface-700 ${isToday ? 'text-accent' : 'text-zinc-400'}`}
                  >
                    <div className="text-xs font-medium">
                      <span className="hidden sm:inline">{DAY_LABELS[i]}</span>
                      <span className="sm:hidden">{DAY_LABELS[i][0]}</span>
                    </div>
                    <div className={`text-base sm:text-lg font-semibold leading-none mt-0.5 ${isToday ? 'text-accent' : 'text-zinc-200'}`}>
                      {day.getDate()}
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
                const { state, drivingEvent } = matrix[ds]?.[slot.id] ?? { state: slot.defaultState, drivingEvent: null }
                const meta = SLOT_STATES[state]
                const isToday = ds === todayStr

                return (
                  <td key={i} className="py-1 sm:py-1.5 px-0.5 sm:px-1">
                    <button
                      onClick={() => onDayClick(day)}
                      title={drivingEvent ? `${meta.label} — ${drivingEvent.title}` : meta.label}
                      className={`w-full rounded-lg py-2 sm:py-3 flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all
                        hover:opacity-90 ${isToday ? 'ring-1 ring-accent' : ''}
                      `}
                      style={{ backgroundColor: meta.color + '22', border: `1px solid ${meta.color}44` }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span className="text-xs font-medium hidden sm:inline" style={{ color: meta.color }}>{meta.label}</span>
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

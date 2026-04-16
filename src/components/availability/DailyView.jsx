import { useMemo } from 'react'
import { deriveSlotState, dateToStr, DEFAULT_SLOT_STATES } from '../../utils/availability'
import { Badge } from '../ui/Badge'

const STATE_BADGE = {
  available: 'ghost',
  hold: 'yellow',
  booked: 'default',
  blocked: 'red',
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function DailyView({ date, slots, calendarEvents, connectedCalendars, availabilityRules, prefixRules = [], isOwner, slotStates = DEFAULT_SLOT_STATES }) {
  const slotResults = useMemo(() =>
    slots.map(slot => ({
      slot,
      ...deriveSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules),
    })),
    [date, slots, calendarEvents, connectedCalendars, prefixRules]
  )

  const ds = dateToStr(date)
  const isToday = ds === dateToStr(new Date())

  const privateRule = isOwner
    ? availabilityRules.find(r => r.date === ds)
    : null

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h3 className={`text-lg font-semibold ${isToday ? 'text-accent' : 'text-zinc-100'}`}>
          {formatDate(date)}
        </h3>
        {isToday && <Badge variant="accent">Today</Badge>}
      </div>

      <div className="space-y-3">
        {slotResults.map(({ slot, state, drivingEvent }) => {
          const meta = slotStates[state] || DEFAULT_SLOT_STATES[state]
          return (
            <div
              key={slot.id}
              className="bg-surface-800 border border-surface-700 rounded-xl px-5 py-4"
              style={{ borderLeftColor: meta.color, borderLeftWidth: '3px' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{slot.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{slot.startTime} – {slot.endTime}</p>
                </div>
                <Badge variant={STATE_BADGE[state]}>{meta.label}</Badge>
              </div>

              {/* Event details removed — daily view only shows slot status */}
            </div>
          )
        })}
      </div>

      {isOwner && privateRule && (
        <div className="mt-4 bg-surface-950 border border-accent/20 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs">🔒</span>
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Private Note</p>
          </div>
          <p className="text-sm text-zinc-400 italic">{privateRule.privateNote}</p>
        </div>
      )}

      {slotResults.every(r => !r.drivingEvent) && (
        <p className="text-xs text-zinc-600 mt-4">No calendar events found for this day.</p>
      )}
    </div>
  )
}

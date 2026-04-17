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

export function DailyView({ date, slots, calendarEvents, connectedCalendars, availabilityRules, prefixRules = [], isOwner, slotStates = DEFAULT_SLOT_STATES, dateRequests = [], sharedAvailability = [] }) {
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

      {/* Date requests for this day */}
      {(() => {
        const dayReqs = dateRequests.filter(r => r.dates?.includes(ds) && r.status !== 'declined')
        if (!dayReqs.length) return null
        return (
          <div className="mt-5">
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Date Requests</p>
            <div className="space-y-1.5">
              {dayReqs.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-surface-800 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-surface-700 flex items-center justify-center text-[10px] font-semibold text-zinc-300 flex-shrink-0">
                      {r.requester_name?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-zinc-200 truncate">{r.requester_name}</span>
                  </div>
                  <Badge variant={r.status === 'pending' ? 'yellow' : 'green'} className="text-[10px]">{r.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Shared availability for this day */}
      {(() => {
        const dayAvail = sharedAvailability.filter(a => a.date === ds)
        if (!dayAvail.length) return null
        const guests = [...new Set(dayAvail.map(a => a.guest_name))]
        return (
          <div className="mt-5">
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Team Availability</p>
            <div className="space-y-1.5">
              {guests.map(name => {
                const isFree = dayAvail.find(a => a.guest_name === name)?.is_available
                return (
                  <div key={name} className="flex items-center justify-between bg-surface-800 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-surface-700 flex items-center justify-center text-[10px] font-semibold text-zinc-300 flex-shrink-0">
                        {name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-zinc-200 truncate">{name}</span>
                    </div>
                    <span className={`text-xs font-medium ${isFree ? 'text-green-400' : 'text-zinc-600'}`}>
                      {isFree ? 'Free' : 'Busy'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {isOwner && privateRule && (
        <div className="mt-4 bg-surface-950 border border-accent/20 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-600">●</span>
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

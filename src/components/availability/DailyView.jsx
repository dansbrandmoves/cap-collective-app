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

export function DailyView({
  date, slots, calendarEvents, connectedCalendars, availabilityRules, prefixRules = [],
  isOwner, slotStates = DEFAULT_SLOT_STATES, dateRequests = [], sharedAvailability = [],
  businessHours = null,
}) {
  const ds = dateToStr(date)
  const isToday = ds === dateToStr(new Date())

  const slotResults = useMemo(() =>
    slots.map(slot => ({
      slot,
      ...deriveSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules, businessHours),
    })),
    [date, slots, calendarEvents, connectedCalendars, prefixRules, businessHours]
  )

  // Filter to active requests for this day
  const dayRequests = useMemo(() =>
    dateRequests.filter(r => r.dates?.includes(ds) && r.status !== 'declined' && r.status !== 'archived'),
    [dateRequests, ds]
  )

  const dayAvailability = useMemo(() =>
    sharedAvailability.filter(a => a.date === ds && a.is_available),
    [sharedAvailability, ds]
  )

  // Per-slot free list: back-compat with date-only requests (no slot_map = free for all slots)
  function getFreeForSlot(slotId) {
    const names = new Set()
    dayRequests.forEach(r => {
      const slotIds = r.slot_map?.[ds]
      if (Array.isArray(slotIds)) {
        if (slotIds.includes(slotId)) names.add(r.requester_name)
      } else {
        if (r.requester_name) names.add(r.requester_name)
      }
    })
    dayAvailability.forEach(a => { if (a.guest_name) names.add(a.guest_name) })
    names.delete(undefined); names.delete(null); names.delete('')
    return [...names]
  }

  const hasAnyGuests = dayRequests.length > 0 || dayAvailability.length > 0
  const privateRule = isOwner ? availabilityRules.find(r => r.date === ds) : null

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h3 className={`text-lg font-semibold ${isToday ? 'text-accent' : 'text-zinc-100'}`}>
          {formatDate(date)}
        </h3>
        {isToday && <Badge variant="accent">Today</Badge>}
        {hasAnyGuests && (
          <span className="text-xs font-medium text-zinc-500">
            {(() => {
              const allNames = new Set([
                ...dayRequests.map(r => r.requester_name),
                ...dayAvailability.map(a => a.guest_name),
              ])
              allNames.delete(undefined); allNames.delete(null); allNames.delete('')
              const n = allNames.size
              return `${n} ${n === 1 ? 'person' : 'people'} available`
            })()}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {slotResults.map(({ slot, state, drivingEvent }) => {
          const meta = slotStates[state] || DEFAULT_SLOT_STATES[state]
          const freeGuests = getFreeForSlot(slot.id)
          const MAX_SHOWN = 5

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

              {/* Driving event */}
              {drivingEvent && (
                <p className="text-xs text-zinc-600 mt-2 truncate">
                  <span className="text-zinc-500">↳</span> {drivingEvent.title}
                </p>
              )}

              {/* Per-slot guest availability */}
              {freeGuests.length > 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
                  <div className="flex items-center -space-x-1.5">
                    {freeGuests.slice(0, MAX_SHOWN).map(name => (
                      <div
                        key={name}
                        title={name}
                        className="w-6 h-6 rounded-full bg-accent/20 border-2 border-surface-800 flex items-center justify-center text-[9px] font-bold text-accent flex-shrink-0"
                      >
                        {name[0]?.toUpperCase()}
                      </div>
                    ))}
                    {freeGuests.length > MAX_SHOWN && (
                      <div className="w-6 h-6 rounded-full bg-surface-700 border-2 border-surface-800 flex items-center justify-center text-[9px] font-semibold text-zinc-400 flex-shrink-0">
                        +{freeGuests.length - MAX_SHOWN}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {freeGuests.length === 1
                      ? `${freeGuests[0]} is free`
                      : `${freeGuests.slice(0, 2).join(' & ')}${freeGuests.length > 2 ? ` +${freeGuests.length - 2}` : ''} free`}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isOwner && privateRule && (
        <div className="mt-4 bg-surface-950 border border-accent/20 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-600">●</span>
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Private Note</p>
          </div>
          <p className="text-sm text-zinc-400 italic">{privateRule.privateNote}</p>
        </div>
      )}

      {!hasAnyGuests && slotResults.every(r => !r.drivingEvent) && (
        <p className="text-xs text-zinc-600 mt-4">No calendar events or guest availability for this day.</p>
      )}
    </div>
  )
}

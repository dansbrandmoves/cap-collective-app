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
            overlapCount >= 3 ? 'bg-accent/[0.14] ring-1 ring-accent/30 shadow-[0_0_0_1px_rgba(94,156,140,0.15)]' :
            overlapCount === 2 ? 'bg-accent/[0.09] ring-1 ring-accent/20' :
            overlapCount === 1 ? 'bg-accent/[0.05]' :
            'bg-surface-800'

          return (
            <button
              key={i}
              onClick={() => onDayClick(date)}
              disabled={!inMonth}
              aria-label={overlapCount > 0
                ? `${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. ${overlapCount} ${overlapCount === 1 ? 'request' : 'requests'}: ${[...overlapGuests].join(', ')}`
                : date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              className={`group/day relative min-h-[56px] sm:min-h-[72px] rounded-lg p-1.5 sm:p-2 text-left transition-all duration-200 ease-ios flex flex-col
                ${inMonth ? 'hover:ring-1 hover:ring-white/20 cursor-pointer' : 'opacity-20 cursor-default'}
                ${isSelected ? 'ring-2 ring-accent bg-accent/20' : overlapBg}
                ${isToday && !isSelected ? 'ring-1 ring-accent/60' : ''}
              `}
            >
              {/* Request indicator — a calm dot. Count lives in the header chip;
                  hover the cell for names, click to manage. */}
              {inMonth && overlapCount > 0 && !isSelected && (
                <>
                  <div className="absolute top-1.5 right-1.5 z-10 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_-1px_rgba(94,156,140,0.7)]" />

                  {/* Custom hover card — replaces the native browser tooltip.
                      Desktop-only; mobile users use the click flow. */}
                  <div className="hidden sm:block pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 opacity-0 group-hover/day:opacity-100 transition-opacity duration-150 ease-ios">
                    <div className="bg-surface-950 border border-white/10 shadow-lift rounded-lg px-3 py-2 min-w-[140px] max-w-[220px]">
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
                      <p className="text-[10px] text-zinc-600 mt-1.5 pt-1.5 border-t border-white/[0.06]">Click to manage</p>
                    </div>
                  </div>
                </>
              )}

              <span className={`text-xs font-medium mb-1 flex items-center gap-1.5 ${
                isSelected ? 'text-white' :
                overlapCount > 0 ? 'text-zinc-50 font-semibold' :
                isToday ? 'text-accent' :
                inMonth ? 'text-zinc-300' :
                'text-zinc-600'
              }`}>
                <span>{date.getDate()}</span>
              </span>

              {/* One calm availability meter per day — never a stripe-per-slot barcode.
                  A single muted bar; its fill = how much of the day is open. Detail
                  (which slots) lives in the day/week view. */}
              {inMonth && (() => {
                let availCount = 0
                for (const slot of slots) {
                  const st = dayMatrix[slot.id]?.state ?? slot.defaultState
                  if (st !== 'available') continue
                  const guestBusy = guestEvents !== null &&
                    guestEvents.some(ev => eventOverlapsSlot(date, slot, { ...ev, calendarId: 'primary' }))
                  if (!guestBusy) availCount++
                }
                const total = slots.length || 1
                const frac = availCount / total
                return (
                  <div className="mt-auto h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
                    {availCount > 0 && (
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.round(frac * 100)}%`, opacity: 0.45 + 0.35 * frac }}
                        title={`${availCount} of ${total} ${total === 1 ? 'slot' : 'slots'} open`}
                      />
                    )}
                  </div>
                )
              })()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

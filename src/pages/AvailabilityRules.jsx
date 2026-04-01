import { useApp } from '../contexts/AppContext'
import { Badge } from '../components/ui/Badge'
import { SlotEditor } from '../components/availability/SlotEditor'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'

const TIER_META = {
  available: { label: 'Available',                badge: 'ghost' },
  hold:      { label: 'Penciled',                 badge: 'yellow' },
  booked:    { label: 'Not Typically Considered', badge: 'default' },
  blocked:   { label: 'Not Available',            badge: 'red' },
}

export function AvailabilityRules() {
  const { availabilityRules, productions, slots, calendarEvents, connectedCalendars, prefixRules } = useApp()

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Owner Only</p>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Availability Rules</h1>
        <p className="text-sm text-zinc-500">
          Define your time slots, set availability, and preview what groups will see.
        </p>
      </div>

      {/* Slot Editor */}
      <div className="mb-10">
        <SlotEditor />
      </div>

      {/* Full calendar preview */}
      <div className="mb-10">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">Calendar Preview (owner view)</p>
        <div className="bg-surface-900 border border-surface-700 rounded-xl p-6">
          <AvailabilityCalendar
            slots={slots}
            calendarEvents={calendarEvents}
            connectedCalendars={connectedCalendars}
            availabilityRules={availabilityRules}
            prefixRules={prefixRules}
            isOwner={true}
          />
        </div>
      </div>

      {/* Production overrides */}
      <div>
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Production Overrides</p>
        {availabilityRules.length === 0 ? (
          <p className="text-sm text-zinc-600">No overrides set.</p>
        ) : (
          <div className="space-y-2">
            {availabilityRules.map(rule => {
              const prod = productions.find(p => p.id === rule.productionId)
              const meta = TIER_META[rule.tier]
              return (
                <div key={rule.id} className="bg-surface-900 border border-surface-700 rounded-xl px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm text-zinc-200">{rule.label}</p>
                      <p className="text-xs text-zinc-500">{rule.date} · {prod?.name ?? 'Unknown production'}</p>
                    </div>
                    <Badge variant={meta?.badge ?? 'ghost'}>{meta?.label ?? rule.tier}</Badge>
                  </div>
                  {rule.privateNote && (
                    <div className="flex items-start gap-2 bg-surface-800 rounded-lg px-3 py-2 mt-2">
                      <span className="text-xs mt-0.5">🔒</span>
                      <p className="text-xs text-zinc-500 italic">{rule.privateNote}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

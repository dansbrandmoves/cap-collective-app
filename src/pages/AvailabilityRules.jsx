import { useApp } from '../contexts/AppContext'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'

const TIER_META = {
  available: { label: 'Available', badge: 'green' },
  hold: { label: 'Hold', badge: 'purple' },
  booked: { label: 'Booked', badge: 'yellow' },
  blocked: { label: 'Blocked', badge: 'red' },
}

export function AvailabilityRules() {
  const { availabilityRules, productions, calendarEvents } = useApp()

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Owner Only</p>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Availability Rules</h1>
        <p className="text-sm text-zinc-500">
          Set your availability per production. Rules layer on top of your connected calendar data.
        </p>
      </div>

      {/* Calendar events */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Calendar Events (stubbed)</p>
        <div className="space-y-2">
          {calendarEvents.map(event => {
            const meta = TIER_META[event.tier]
            return (
              <div key={event.id} className="bg-surface-900 border border-surface-700 rounded-xl px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: event.color }} />
                  <div>
                    <p className="text-sm text-zinc-200">{event.title}</p>
                    <p className="text-xs text-zinc-500">{event.start} → {event.end}</p>
                  </div>
                </div>
                <Badge variant={meta?.badge ?? 'ghost'}>{meta?.label ?? event.tier}</Badge>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-production rules */}
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

import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

const STUB_CALENDARS = [
  { id: 'cal-a', name: 'CAP A — Production', email: 'christian@capcollective.com', role: 'governs', lastSync: '2 min ago', color: '#f59e0b' },
  { id: 'cal-b', name: 'CAP B — Holds', email: 'christian@capcollective.com', role: 'governs', lastSync: '2 min ago', color: '#6366f1' },
  { id: 'cal-c', name: 'Personal', email: 'christian@personal.com', role: 'informational', lastSync: '2 min ago', color: '#ef4444' },
  { id: 'cal-d', name: 'X Schedule', email: 'christian@capcollective.com', role: 'ignored', lastSync: '2 min ago', color: '#6b7280' },
]

const ROLE_META = {
  governs: { label: 'Governs availability', badge: 'green', desc: 'Events on this calendar affect what groups see.' },
  informational: { label: 'Informational only', badge: 'yellow', desc: 'Visible to you in your private layer only.' },
  ignored: { label: 'Ignored', badge: 'ghost', desc: 'Connected but excluded from all calculations.' },
}

export function CalendarSettings() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Owner Only</p>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Calendar Settings</h1>
        <p className="text-sm text-zinc-500">
          Control what the app knows. Each calendar has a role — governs availability, informational only, or ignored.
        </p>
      </div>

      {/* Connect button */}
      <div className="bg-surface-900 border border-dashed border-surface-600 rounded-xl px-6 py-5 flex items-center justify-between mb-6">
        <div>
          <p className="text-sm font-medium text-zinc-300">Connect Google Calendar</p>
          <p className="text-xs text-zinc-500 mt-0.5">OAuth integration — coming in next build.</p>
        </div>
        <Button variant="secondary" disabled>Connect →</Button>
      </div>

      {/* Connected calendars */}
      <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Connected Calendars (stubbed)</p>
      <div className="space-y-3">
        {STUB_CALENDARS.map(cal => {
          const role = ROLE_META[cal.role]
          return (
            <div key={cal.id} className="bg-surface-900 border border-surface-700 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: cal.color }} />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{cal.name}</p>
                    <p className="text-xs text-zinc-500">{cal.email} · Last synced {cal.lastSync}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={role.badge}>{role.label}</Badge>
                  <button className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">change</button>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-2 ml-6">{role.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Sync controls */}
      <div className="mt-8 flex items-center justify-between px-5 py-4 bg-surface-900 border border-surface-700 rounded-xl">
        <div>
          <p className="text-sm text-zinc-300">Manual sync</p>
          <p className="text-xs text-zinc-500 mt-0.5">Pull latest events from all connected calendars.</p>
        </div>
        <Button variant="secondary" size="sm">Refresh now</Button>
      </div>
    </div>
  )
}

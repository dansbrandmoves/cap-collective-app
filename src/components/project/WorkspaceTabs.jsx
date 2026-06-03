// The Schedule / Tasks / Board tab switcher, shared by the owner project view
// (ProductionView) and the guest/member room view (RoomView) so they never drift.
// Floats over the content on lg (so the calendar + canvas bleed to the top edge);
// in flow on smaller screens. Outer padding differs per host → pass via `className`.
const TABS = [['schedule', 'Schedule'], ['tasks', 'Tasks'], ['board', 'Board']]

export function WorkspaceTabs({ active, onChange, taskCount = 0, className = '' }) {
  return (
    <div className={`relative z-20 lg:absolute lg:inset-x-0 lg:top-0 lg:pointer-events-none flex-shrink-0 ${className}`}>
      <div className="inline-flex items-center gap-0.5 bg-surface-900/80 lg:backdrop-blur-md border border-white/[0.05] rounded-xl p-1 pointer-events-auto">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => onChange(key)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ease-ios ${
              active === key ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400 hover:text-zinc-100'
            }`}>
            {label}
            {key === 'tasks' && taskCount > 0 && (
              <span className="ml-1.5 text-[11px] text-zinc-500 tabular-nums">{taskCount}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// Shared slot row — the single source of truth for how a selectable time slot
// looks across the app: the project Day Inspector AND the guest booking flow.
// Keeps the two experiences visually identical (Arro teal, same states).
//
// state: 'available' | 'selected' | 'busy'
//   available → bright, hoverable
//   selected  → teal fill
//   busy      → dimmed (someone's not free / time is taken)

const TONE = {
  available: 'border-white/10 text-zinc-200 hover:border-accent/40 hover:bg-white/[0.03]',
  selected:  'bg-accent/10 border-accent/45 text-zinc-50',
  busy:      'border-white/[0.05] text-zinc-600 opacity-50 hover:opacity-70',
}

export function SlotRow({
  state = 'available', onClick, hint,
  barColor,            // optional left color bar (project slots)
  name, time,          // primary label + time range/sub
  center = false,      // center the label (booking flow shows just a time)
  trailing,            // optional trailing node (count, check, busy badge)
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`group w-full min-h-touch flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-150 ease-ios active:scale-[0.99] ${TONE[state]} ${center ? 'justify-center text-center' : ''}`}
    >
      {barColor && !center && (
        <div className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: barColor }} />
      )}
      <div className={`min-w-0 ${center ? '' : 'flex-1'}`}>
        <p className={`text-[14px] font-medium leading-tight truncate ${state === 'selected' ? 'text-zinc-50' : ''}`}>{name}</p>
        {time && !center && <p className="text-[12px] text-zinc-500 mt-0.5">{time}</p>}
      </div>
      {trailing}
    </button>
  )
}

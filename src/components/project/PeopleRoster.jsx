import { useState } from 'react'
import { Users, CalendarDays, Check, UserPlus, Copy, X } from 'lucide-react'

// The roster UI — lives in the project left panel. Add people, tap to
// include/exclude (which drives the calendar), copy each person's invite link,
// remove. Driven entirely by the useProjectPeople hook passed in from the parent.
export function PeopleRoster({
  people, excluded, totalPeople, includedCount,
  togglePerson, addPerson, removePerson, inviteLink, canAdd,
}) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [copiedToken, setCopiedToken] = useState(null)

  function submit(e) {
    e?.preventDefault()
    const name = newName.trim()
    if (!name) return
    addPerson(name)
    setNewName('')
    setAdding(false)
  }

  function copy(token) {
    const link = inviteLink(token)
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(t => (t === token ? null : t)), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Users size={14} strokeWidth={1.75} className="text-zinc-500" />
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">People</p>
        </div>
        {totalPeople > 1 && (
          <span className="text-[11px] text-zinc-600">{includedCount} of {totalPeople}</span>
        )}
      </div>

      {totalPeople > 1 && (
        <p className="text-[11px] text-zinc-600 leading-relaxed mb-2.5">
          Tap to include or exclude from the calendar.
        </p>
      )}

      <div className="space-y-0.5">
        {people.map(({ name, sources, memberId, inviteToken, isOwner }) => {
          const inc = !excluded.has(name)
          const viaCalendar = sources.includes('calendar')
          const responded = sources.length > 0
          return (
            <div
              key={name}
              className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                inc ? 'hover:bg-white/[0.04]' : 'opacity-50 hover:bg-white/[0.03]'
              }`}
            >
              <button
                onClick={() => togglePerson(name)}
                title={isOwner ? 'Your calendar' : (responded ? (viaCalendar ? 'Shared via Google Calendar' : 'Tapped their free days') : 'Hasn’t responded yet')}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 ${inc ? 'bg-accent text-white' : 'border border-white/20'}`}>
                  {inc && <Check size={10} strokeWidth={3} />}
                </span>
                <span className={`text-[13px] truncate ${inc ? 'text-zinc-100' : 'text-zinc-500'}`}>{name}</span>
                {(viaCalendar || isOwner) && <CalendarDays size={11} strokeWidth={2} className={`flex-shrink-0 ${inc ? 'text-accent/80' : 'text-zinc-600'}`} />}
                {isOwner
                  ? <span className="text-[10px] text-zinc-600 flex-shrink-0">you</span>
                  : (!responded && <span className="text-[10px] text-zinc-600 italic flex-shrink-0">invited</span>)}
              </button>
              {inviteToken && (
                <button onClick={() => copy(inviteToken)} title="Copy invite link"
                  className="text-zinc-600 hover:text-accent transition-colors flex-shrink-0">
                  {copiedToken === inviteToken ? <Check size={12} strokeWidth={3} className="text-green-400" /> : <Copy size={12} strokeWidth={2} />}
                </button>
              )}
              {memberId && (
                <button onClick={() => removePerson(memberId)} title="Remove person"
                  className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                  <X size={12} strokeWidth={2.5} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {adding ? (
        <form onSubmit={submit} className="flex items-center gap-1.5 mt-2">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
            placeholder="Name"
            className="flex-1 min-w-0 bg-surface-800 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all"
          />
          <button type="submit" disabled={!newName.trim()}
            className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg bg-accent text-white disabled:opacity-40 transition-opacity flex-shrink-0">Add</button>
          <button type="button" onClick={() => { setAdding(false); setNewName('') }}
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 flex-shrink-0"><X size={14} /></button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={!canAdd}
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:text-accent/80 transition-colors disabled:opacity-40"
        >
          <UserPlus size={14} strokeWidth={2} /> Add person
        </button>
      )}
    </div>
  )
}

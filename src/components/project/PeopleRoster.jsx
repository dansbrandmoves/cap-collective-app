import { useState } from 'react'
import { Users, Check, UserPlus, Copy, X } from 'lucide-react'
import { ConfirmDialog } from '../ui/ConfirmDialog'

// The roster UI — lives in the project left panel. Add people (opens the Add
// People modal), tap to include/exclude (which drives the calendar), copy each
// person's invite link, remove. Driven by the useProjectPeople hook + parent.
export function PeopleRoster({
  people, excluded, totalPeople, includedCount,
  togglePerson, removePerson, inviteLink, canAdd, onAdd,
  canManage = true, ownerDisplayName,
}) {
  const [copiedToken, setCopiedToken] = useState(null)
  const [confirmPerson, setConfirmPerson] = useState(null)

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
          const person = { name, memberId }
          const inc = !excluded.has(name)
          const viaCalendar = sources.includes('calendar')
          const responded = sources.length > 0
          const display = isOwner ? (ownerDisplayName || name) : name
          const sub = isOwner ? 'Coordinator · you' : (!responded ? 'invited' : null)
          return (
            <div
              key={name}
              className={`group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors ${
                inc ? 'hover:bg-white/[0.04]' : 'opacity-60 hover:bg-white/[0.03]'
              }`}
            >
              {/* avatar + name (left) — tapping toggles include/exclude */}
              <button
                onClick={() => togglePerson(name)}
                title={isOwner ? 'You (Coordinator)' : (responded ? (viaCalendar ? 'Shared their calendar' : 'Tapped their free days') : 'Hasn’t shared their calendar yet — include or exclude as you like')}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${inc ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-zinc-500'}`}>
                  {display[0]?.toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13px] truncate ${inc ? 'text-zinc-100' : 'text-zinc-500'}`}>{display}</span>
                  {sub && <span className={`block text-[11px] truncate text-zinc-600 ${sub === 'invited' ? 'italic' : ''}`}>{sub}</span>}
                </span>
              </button>
              {/* Personal invite link — only useful until their calendar is synced. */}
              {inviteToken && !viaCalendar && (
                <button onClick={() => copy(inviteToken)} title="Copy invite link"
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-accent transition-all flex-shrink-0">
                  {copiedToken === inviteToken ? <Check size={13} strokeWidth={3} className="text-green-400" /> : <Copy size={13} strokeWidth={2} />}
                </button>
              )}
              {/* Owner-only: remove someone from the project */}
              {!isOwner && canManage && (
                <button onClick={() => setConfirmPerson(person)} title="Remove from project"
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all flex-shrink-0">
                  <X size={13} strokeWidth={2.5} />
                </button>
              )}
              {/* checkbox (right) */}
              <button onClick={() => togglePerson(name)} title={inc ? 'Counted in availability' : 'Excluded'}
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${inc ? 'bg-accent border-accent text-white' : 'border-white/15 text-transparent hover:border-white/30'}`}>
                <Check size={12} strokeWidth={3} />
              </button>
            </div>
          )
        })}
      </div>

      {canManage && (
        <button
          onClick={onAdd}
          disabled={!canAdd}
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:text-accent/80 transition-colors disabled:opacity-40"
        >
          <UserPlus size={14} strokeWidth={2} /> Add person
        </button>
      )}

      <ConfirmDialog
        isOpen={!!confirmPerson}
        onClose={() => setConfirmPerson(null)}
        onConfirm={() => { removePerson(confirmPerson); setConfirmPerson(null) }}
        title="Remove person"
        body={<>Remove <span className="font-semibold text-zinc-100">{confirmPerson?.name}</span> from this project? Their shared availability will be deleted too.</>}
        warning="This can't be undone — they'd need to share their availability again."
        confirmLabel="Remove"
      />
    </div>
  )
}

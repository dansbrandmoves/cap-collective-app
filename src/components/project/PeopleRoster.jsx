import { useState } from 'react'
import { Users, Check, UserPlus } from 'lucide-react'
import { PersonModal } from './PersonModal'

// The roster UI — lives in the project left panel. Tap a person to open their
// detail card (info + next steps); use the checkmark to include/exclude from the
// calendar. Add people via the Add People modal. Driven by useProjectPeople.
export function PeopleRoster({
  people, excluded, totalPeople, includedCount,
  togglePerson, removePerson, inviteLink, sendInvite, canAdd, onAdd,
  canManage = true, ownerDisplayName, ownerPhoto,
}) {
  const [openPerson, setOpenPerson] = useState(null)

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

      <div className="space-y-0.5">
        {people.map((person) => {
          const { name, sources, isOwner } = person
          const inc = !excluded.has(name)
          const responded = sources.length > 0
          const display = isOwner ? (ownerDisplayName || name) : name
          const photo = isOwner ? ownerPhoto : null
          const sub = isOwner ? 'Coordinator · you' : (!responded ? 'invited' : null)
          return (
            <div
              key={name}
              className={`group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors ${
                inc ? 'hover:bg-white/[0.04]' : 'opacity-60 hover:bg-white/[0.03]'
              }`}
            >
              {/* avatar + name → open person detail */}
              <button
                onClick={() => setOpenPerson(person)}
                title="View details"
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              >
                <span className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                  {photo ? (
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className={`w-full h-full flex items-center justify-center text-[11px] font-bold ${inc ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-zinc-500'}`}>
                      {display[0]?.toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13px] truncate ${inc ? 'text-zinc-100' : 'text-zinc-500'}`}>{display}</span>
                  {sub && <span className={`block text-[11px] truncate text-zinc-600 ${sub === 'invited' ? 'italic' : ''}`}>{sub}</span>}
                </span>
              </button>
              {/* checkbox (right) — include/exclude */}
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

      <PersonModal
        person={openPerson}
        isOpen={!!openPerson}
        onClose={() => setOpenPerson(null)}
        included={openPerson ? !excluded.has(openPerson.name) : false}
        onToggleInclude={togglePerson}
        inviteLink={inviteLink}
        onSendInvite={sendInvite}
        onRemove={removePerson}
        canManage={canManage}
        ownerDisplayName={ownerDisplayName}
        ownerPhoto={ownerPhoto}
      />
    </div>
  )
}

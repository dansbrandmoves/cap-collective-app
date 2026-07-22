import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Mail, Copy, Check, Link2, Send, Trash2, CalendarCheck, CalendarClock, UserPlus } from 'lucide-react'

// Tap a person's avatar in the roster → this. Basic info + the obvious next steps
// (email them, copy/send their invite link, include/exclude, remove). Availability
// only — no booking here.
function statusFor(person) {
  if (person.isOwner) return { label: 'Coordinator · you', Icon: CalendarCheck }
  if (person.sources?.includes('calendar')) return { label: 'Shared their calendar', Icon: CalendarCheck }
  if (person.sources?.includes('tapped')) return { label: 'Tapped their free days', Icon: CalendarClock }
  return { label: 'Invited · no availability yet', Icon: UserPlus }
}

export function PersonModal({
  person, isOpen, onClose, included, onToggleInclude,
  inviteLink, onSendInvite, onRemove, canManage = false,
  ownerDisplayName, ownerPhoto,
}) {
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  if (!person) return null

  const display = person.isOwner ? (ownerDisplayName || person.name) : person.name
  const photo = person.isOwner ? ownerPhoto : null
  const { label: statusLabel, Icon: StatusIcon } = statusFor(person)
  const link = person.inviteToken ? inviteLink?.(person.inviteToken) : null
  const showInvite = !!person.inviteToken && !person.sources?.includes('calendar')

  function copyLink() {
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  async function sendInvite() {
    setSending(true)
    const ok = await onSendInvite?.(person)
    setSending(false)
    if (ok) { setSent(true); setTimeout(() => setSent(false), 2500) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title="Person">
      {/* Identity */}
      <div className="flex items-center gap-3.5 mb-5">
        <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-accent/20 text-accent flex items-center justify-center text-xl font-bold">
              {display?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[18px] font-semibold text-zinc-100 truncate">{display}</p>
          <p className="flex items-center gap-1.5 text-[12px] text-zinc-500">
            <StatusIcon size={13} strokeWidth={1.75} /> {statusLabel}
          </p>
        </div>
      </div>

      {/* Contact */}
      {person.email && (
        <div className="flex items-center justify-between gap-2 bg-surface-950 border border-white/[0.06] rounded-xl px-3 py-2.5 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Mail size={14} strokeWidth={1.75} className="text-zinc-500 flex-shrink-0" />
            <span className="text-[13px] text-zinc-300 truncate">{person.email}</span>
          </div>
          <a href={`mailto:${person.email}`} className="text-[12px] font-medium text-accent hover:text-accent/80 flex-shrink-0">Email</a>
        </div>
      )}

      {/* Include toggle */}
      {!person.isOwner && (
        <button
          onClick={() => onToggleInclude?.(person.name)}
          className="w-full flex items-center justify-between gap-2 bg-surface-950 border border-white/[0.06] rounded-xl px-3 py-2.5 mb-4 hover:bg-white/[0.02] transition-colors"
        >
          <span className="text-[13px] text-zinc-300">Counted in availability</span>
          <span className={`w-9 h-5 rounded-full relative transition-colors ${included ? 'bg-accent' : 'bg-white/15'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${included ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>
      )}

      {/* Next steps */}
      <div className="space-y-1.5">
        {showInvite && link && (
          <button onClick={copyLink} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-zinc-200 hover:bg-white/[0.04] transition-colors">
            {copied ? <Check size={15} className="text-green-400" /> : <Link2 size={15} strokeWidth={1.75} className="text-zinc-400" />}
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>
        )}
        {showInvite && person.email && (
          <button onClick={sendInvite} disabled={sending || sent} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-zinc-200 hover:bg-white/[0.04] transition-colors disabled:opacity-60">
            {sent ? <Check size={15} className="text-green-400" /> : <Send size={15} strokeWidth={1.75} className="text-zinc-400" />}
            {sent ? 'Invite sent' : sending ? 'Sending…' : 'Email invite link'}
          </button>
        )}
        {canManage && !person.isOwner && (
          <button onClick={() => setConfirmRemove(true)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-red-400 hover:bg-red-500/[0.08] transition-colors">
            <Trash2 size={15} strokeWidth={1.75} /> Remove from project
          </button>
        )}
        {person.isOwner && (
          <p className="text-[12px] text-zinc-600 px-1 pt-1">This is you. Manage your photo and details in your Account.</p>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => { setConfirmRemove(false); onClose?.(); onRemove?.(person) }}
        title="Remove person"
        body={<>Remove <span className="font-semibold text-zinc-100">{person.name}</span> from this project? Their shared availability will be deleted too.</>}
        warning="This can't be undone. They'd need to share their availability again."
        confirmLabel="Remove"
      />
    </Modal>
  )
}

import { useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { CheckCircle2, Plus } from 'lucide-react'

export function DateRequestModal({ isOpen, onClose, selectedDates, selectedSlotMap, guestName, ownerName, onSubmit }) {
  // typedName is only used when the guest has to enter their name (open_link guest on a fresh device)
  // When guestName prop is provided (room already identifies the guest), we skip the input and use the prop directly.
  // Deriving `finalName` this way avoids a classic prop-to-state sync bug where guestName arrives
  // after mount and the button stays disabled because local state was initialized empty.
  const [typedName, setTypedName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const who = ownerName ? ownerName.split(' ')[0] : 'The team'

  const finalName = (guestName || typedName).trim()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!finalName || selectedDates.length === 0) return
    setSubmitting(true)
    const success = await onSubmit({
      requesterName: finalName,
      requesterEmail: email.trim(),
      dates: selectedDates,
      message: message.trim(),
      slotMap: selectedSlotMap && Object.keys(selectedSlotMap).length > 0 ? selectedSlotMap : null,
    })
    setSubmitting(false)
    if (success) {
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setMessage('')
        onClose()
      }, 2000)
    }
  }

  const sortedDates = [...selectedDates].sort()

  function formatDate(ds) {
    const d = new Date(ds + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="">
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-400" />
          </div>
          <p className="text-lg font-semibold text-zinc-100 mb-1">Got it!</p>
          <p className="text-sm text-zinc-500">
            {who} can see you're free on{' '}
            <span className="text-zinc-300">
              {sortedDates.slice(0, 3).map(formatDate).join(', ')}
              {sortedDates.length > 3 ? ` +${sortedDates.length - 3} more` : ''}
            </span>.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share your free days">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-zinc-400 -mt-1">
          {who} will see you're free on these {sortedDates.length === 1 ? 'day' : 'days'} and pick one that works:
        </p>

        {/* Selected dates */}
        <div className="flex flex-wrap gap-1.5">
          {sortedDates.map(ds => (
            <span key={ds} className="bg-accent/15 text-accent text-xs font-medium px-2.5 py-1 rounded-full">
              {formatDate(ds)}
            </span>
          ))}
        </div>

        {/* Name */}
        {!guestName && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Your Name</label>
            <input
              type="text" value={typedName} onChange={e => setTypedName(e.target.value)}
              placeholder="Your name" autoFocus
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent"
            />
          </div>
        )}

        {/* Optional details — tucked away so the default path is just "send" */}
        {!showDetails ? (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            Add an email or note
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email <span className="text-zinc-700">(optional)</span></label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Note <span className="text-zinc-700">(optional)</span></label>
              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Anything you'd like them to know..."
                rows={2}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!finalName || submitting}>
            {submitting ? 'Sending...' : 'Send my free days'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

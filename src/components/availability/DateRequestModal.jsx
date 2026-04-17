import { useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { CheckCircle2 } from 'lucide-react'

export function DateRequestModal({ isOpen, onClose, selectedDates, guestName, onSubmit }) {
  const [name, setName] = useState(guestName || '')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || selectedDates.length === 0) return
    setSubmitting(true)
    const success = await onSubmit({
      requesterName: name.trim(),
      requesterEmail: email.trim(),
      dates: selectedDates,
      message: message.trim(),
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
          <p className="text-lg font-semibold text-zinc-100 mb-1">Request sent</p>
          <p className="text-sm text-zinc-500">
            {sortedDates.length} date{sortedDates.length !== 1 ? 's' : ''} requested. You'll hear back soon.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Dates">
      <form onSubmit={handleSubmit} className="space-y-4">
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
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your name" autoFocus
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent"
            />
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email <span className="text-zinc-700">(optional)</span></label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Message <span className="text-zinc-700">(optional)</span></label>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Anything you'd like them to know..."
            rows={2}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim() || submitting}>
            {submitting ? 'Sending...' : 'Send Request'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

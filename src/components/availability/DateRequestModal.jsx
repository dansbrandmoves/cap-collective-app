import { useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

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
      }, 1500)
    }
  }

  const sortedDates = [...selectedDates].sort()

  function formatDate(ds) {
    const d = new Date(ds + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Request Sent">
        <div className="text-center py-6">
          <div className="text-3xl mb-3">✓</div>
          <p className="text-sm text-zinc-300">Your date request has been sent.</p>
          <p className="text-xs text-zinc-500 mt-1">You'll hear back soon.</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Dates">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selected dates */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2">Selected Dates</label>
          <div className="flex flex-wrap gap-1.5">
            {sortedDates.map(ds => (
              <span key={ds} className="bg-accent/20 text-accent text-xs font-medium px-2.5 py-1 rounded-full">
                {formatDate(ds)}
              </span>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Message (optional)</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Any details about your request..."
            rows={3}
            className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
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

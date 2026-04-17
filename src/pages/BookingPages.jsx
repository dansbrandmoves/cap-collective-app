import { useState, useEffect } from 'react'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { UpgradeModal } from '../components/ui/UpgradeModal'
import { CalendarCheck, Plus, Copy, Check, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

const DURATIONS = [15, 30, 45, 60]
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function BookingPageCard({ page, onToggle, onDelete, onFetchBookings }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [bookings, setBookings] = useState(null)
  const [loadingBookings, setLoadingBookings] = useState(false)

  const link = `${window.location.origin}/book/${page.slug}`

  function copyLink() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function toggleExpand() {
    if (!expanded && bookings === null) {
      setLoadingBookings(true)
      const data = await onFetchBookings(page.id)
      setBookings(data)
      setLoadingBookings(false)
    }
    setExpanded(!expanded)
  }

  const days = (page.available_days || [1,2,3,4,5]).map(d => DAY_LABELS[d]).join(', ')
  const hours = page.available_hours || { start: '09:00', end: '17:00' }

  function formatTime(t) {
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`
  }

  return (
    <div className={`bg-surface-900 border rounded-xl overflow-hidden transition-all ${page.is_active ? 'border-surface-700' : 'border-surface-800 opacity-60'}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold text-zinc-100">{page.name}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={copyLink}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-700 transition-colors"
              title="Copy booking link"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-700 transition-colors"
              title="Open booking page"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {page.description && <p className="text-sm text-zinc-500 mb-3 line-clamp-2">{page.description}</p>}

        <div className="flex items-center gap-2 mb-3">
          <Badge variant="ghost">{page.duration_minutes} min</Badge>
          <Badge variant="ghost">{formatTime(hours.start)} – {formatTime(hours.end)}</Badge>
          <Badge variant="ghost">{days}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(page.id, !page.is_active)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                page.is_active
                  ? 'border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/20'
                  : 'border-surface-600 text-zinc-500 bg-surface-800 hover:bg-surface-700'
              }`}
            >
              {page.is_active ? 'Active' : 'Inactive'}
            </button>
            <button
              onClick={() => { if (confirm('Delete this booking page and all its bookings?')) onDelete(page.id) }}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <button onClick={toggleExpand} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            Bookings {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-surface-800 px-5 py-3 bg-surface-950/50">
          {loadingBookings ? (
            <p className="text-xs text-zinc-600 py-2">Loading bookings...</p>
          ) : !bookings?.length ? (
            <p className="text-xs text-zinc-600 py-2">No bookings yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {bookings.map(b => (
                <div key={b.id} className="flex items-center justify-between text-sm py-1.5">
                  <div>
                    <span className="text-zinc-200">{b.guest_name}</span>
                    {b.guest_email && <span className="text-zinc-600 ml-2 text-xs">{b.guest_email}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      {new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-xs text-zinc-500">{formatTime(b.start_time)} – {formatTime(b.end_time)}</span>
                    <Badge variant={b.status === 'confirmed' ? 'green' : 'red'} className="text-[10px]">
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BookingPages() {
  const {
    bookingPages, createBookingPage, updateBookingPage, deleteBookingPage,
    fetchBookingsForPage, loading, canAddBookingPage, isProPlan, FREE_BOOKING_PAGE_LIMIT,
  } = useApp()

  const [showModal, setShowModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    durationMinutes: 30,
    startHour: '09:00',
    endHour: '17:00',
    days: [1, 2, 3, 4, 5],
  })

  function openNew() {
    if (!canAddBookingPage()) { setShowUpgrade(true); return }
    setShowModal(true)
  }

  function toggleDay(d) {
    setForm(f => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d].sort(),
    }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name) return
    await createBookingPage({
      name: form.name,
      description: form.description,
      durationMinutes: form.durationMinutes,
      availableHours: { start: form.startHour, end: form.endHour },
      availableDays: form.days,
    })
    setShowModal(false)
    setForm({ name: '', description: '', durationMinutes: 30, startHour: '09:00', endHour: '17:00', days: [1, 2, 3, 4, 5] })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-zinc-500">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Booking Pages</h1>
          <p className="text-sm text-zinc-500 mt-1">Create shareable links so people can book time with you.</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={14} strokeWidth={2} className="mr-1.5" />
          New Page
        </Button>
      </div>

      {!isProPlan && bookingPages.length >= FREE_BOOKING_PAGE_LIMIT && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-accent/8 border border-accent/20 rounded-xl px-4 py-3">
          <p className="text-sm text-zinc-400">
            Free plan includes <span className="text-zinc-200 font-medium">{FREE_BOOKING_PAGE_LIMIT} booking page</span>. Upgrade to add more.
          </p>
          <button onClick={() => setShowUpgrade(true)} className="flex-shrink-0 text-xs font-semibold text-accent hover:text-amber-400 transition-colors">
            Upgrade →
          </button>
        </div>
      )}

      {bookingPages.length === 0 ? (
        <div className="border border-dashed border-surface-600 rounded-2xl p-12 sm:p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center mx-auto mb-5">
            <CalendarCheck size={20} strokeWidth={1.5} className="text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-300 mb-1">No booking pages yet</p>
          <p className="text-sm text-zinc-600 mb-6">Create a booking page and share the link so people can schedule time with you.</p>
          <Button onClick={openNew}>
            <Plus size={14} strokeWidth={2} className="mr-1.5" />
            Create booking page
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {bookingPages.map(p => (
            <BookingPageCard
              key={p.id}
              page={p}
              onToggle={(id, active) => updateBookingPage(id, { is_active: active })}
              onDelete={deleteBookingPage}
              onFetchBookings={fetchBookingsForPage}
            />
          ))}
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          reason={`Free plan includes ${FREE_BOOKING_PAGE_LIMIT} booking page. Upgrade to Pro to create unlimited booking pages.`}
        />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Booking Page">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Page Name</label>
            <input
              type="text"
              placeholder="e.g. 30-Minute Meeting"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description (optional)</label>
            <textarea
              placeholder="What is this meeting about?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, durationMinutes: d }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    form.durationMinutes === d
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-surface-600 text-zinc-400 bg-surface-700 hover:border-surface-500'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Time</label>
              <input
                type="time"
                value={form.startHour}
                onChange={e => setForm(f => ({ ...f, startHour: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Time</label>
              <input
                type="time"
                value={form.endHour}
                onChange={e => setForm(f => ({ ...f, endHour: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Available Days</label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    form.days.includes(i)
                      ? 'bg-accent/15 border border-accent/30 text-accent'
                      : 'bg-surface-700 border border-surface-600 text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.name || form.days.length === 0}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

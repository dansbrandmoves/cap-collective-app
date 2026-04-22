import { useState, useEffect } from 'react'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { UpgradeModal } from '../components/ui/UpgradeModal'
import { CalendarCheck, Plus, Copy, Check, Trash2, ChevronDown, ChevronUp, ExternalLink, Pencil, Clock, CalendarRange, Code2, X, ImagePlus } from 'lucide-react'
import { PageLoader } from '../components/ui/PageLoader'

const DURATIONS = [15, 30, 45, 60]
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function BookingPageCard({ page, onToggle, onDelete, onEdit, onFetchBookings, onUpdateBookingStatus, onDeleteBooking, onUploadLogo, onRemoveLogo }) {
  const [copied, setCopied] = useState(false)
  const [embedCopied, setEmbedCopied] = useState(false)
  const [showEmbed, setShowEmbed] = useState(false)
  const [embedHideLogo, setEmbedHideLogo] = useState(false)
  const [embedHideDesc, setEmbedHideDesc] = useState(false)
  const [embedTheme, setEmbedTheme] = useState('dark')
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: page.name,
    description: page.description || '',
    durationMinutes: page.duration_minutes,
    startHour: page.available_hours?.start || '09:00',
    endHour: page.available_hours?.end || '17:00',
    days: page.available_days || [1, 2, 3, 4, 5],
    requiredFields: page.required_fields || { name: true, email: true, message: false },
  })
  const [bookings, setBookings] = useState(null)
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  const link = `${window.location.origin}/book/${page.slug}`
  const embedParams = [embedHideLogo && 'logo=0', embedHideDesc && 'desc=0', embedTheme === 'light' && 'theme=light'].filter(Boolean).join('&')
  const embedSrc = embedParams ? `${link}?${embedParams}` : link
  const embedCode = `<iframe src="${embedSrc}" width="100%" height="800" style="border:none;border-radius:12px;" allowtransparency="true" loading="lazy"></iframe>`

  function copyLink() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode)
    setEmbedCopied(true)
    setTimeout(() => setEmbedCopied(false), 2000)
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

  const selectedDays = page.available_days || [1, 2, 3, 4, 5]

  return (
    <div className={`bg-surface-900 border rounded-2xl overflow-hidden shadow-sm shadow-black/10 transition-all duration-200 ease-ios hover:border-white/10 hover:shadow-lift ${page.is_active ? 'border-white/[0.06]' : 'border-white/[0.04] opacity-60'}`}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-[17px] font-semibold text-zinc-100 leading-snug tracking-tight min-w-0 flex-1">{page.name}</h3>
          <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1.5">
            <button onClick={() => setEditing(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              title="Edit booking page">
              <Pencil size={14} strokeWidth={1.75} />
            </button>
            <button onClick={() => setShowEmbed(v => !v)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${showEmbed ? 'text-accent bg-accent/10' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'}`}
              title="Embed on website">
              <Code2 size={14} strokeWidth={1.75} />
            </button>
            <button onClick={copyLink}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              title="Copy booking link">
              {copied ? <Check size={15} strokeWidth={2} className="text-green-400" /> : <Copy size={14} strokeWidth={1.75} />}
            </button>
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              title="Open booking page">
              <ExternalLink size={14} strokeWidth={1.75} />
            </a>
          </div>
        </div>

        {page.description && <p className="text-sm text-zinc-400 mb-4 line-clamp-2 leading-relaxed">{page.description}</p>}

        {/* Metadata — stacks vertical on mobile, flows horizontal on sm+ */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1.5 mb-5">
          <div className="flex items-center gap-1.5 text-[13px] text-zinc-400">
            <Clock size={13} strokeWidth={1.75} className="text-zinc-500" />
            {page.duration_minutes} min
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-zinc-400">
            <CalendarRange size={13} strokeWidth={1.75} className="text-zinc-500" />
            {formatTime(hours.start)} – {formatTime(hours.end)}
          </div>
          <div className="flex items-center gap-1">
            {DAY_LABELS.map((label, i) => (
              <span key={i}
                className={`w-5 h-5 flex items-center justify-center text-[10px] font-semibold rounded ${
                  selectedDays.includes(i)
                    ? 'bg-accent/15 text-accent'
                    : 'bg-white/[0.03] text-zinc-700'
                }`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(page.id, !page.is_active)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                page.is_active
                  ? 'border-green-500/25 text-green-400 bg-green-500/[0.08] hover:bg-green-500/15'
                  : 'border-white/10 text-zinc-500 bg-white/[0.03] hover:bg-white/5'
              }`}
            >
              {page.is_active ? 'Active' : 'Inactive'}
            </button>
            <button
              onClick={() => { if (confirm('Delete this booking page and all its bookings?')) onDelete(page.id) }}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          </div>
          <button onClick={toggleExpand} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1.5">
            Bookings {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {showEmbed && (
        <div className="border-t border-surface-800 px-5 py-4 bg-surface-950/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em]">Embed on your website</p>
            <p className="text-[11px] text-zinc-600">Paste into any page's HTML</p>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={embedHideLogo} onChange={e => setEmbedHideLogo(e.target.checked)}
                  className="w-3 h-3 rounded border-surface-600 bg-surface-700 text-accent focus:ring-accent/30" />
                <span className="text-[11px] text-zinc-400">Hide logo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={embedHideDesc} onChange={e => setEmbedHideDesc(e.target.checked)}
                  className="w-3 h-3 rounded border-surface-600 bg-surface-700 text-accent focus:ring-accent/30" />
                <span className="text-[11px] text-zinc-400">Hide description</span>
              </label>
            </div>
            <div className="flex items-center gap-1 bg-surface-800 border border-white/[0.06] rounded-lg p-0.5">
              {['dark', 'light'].map(t => (
                <button key={t} onClick={() => setEmbedTheme(t)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${
                    embedTheme === t
                      ? 'bg-surface-600 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <pre className="bg-surface-900 border border-white/[0.06] rounded-lg px-4 py-3 text-[11px] text-zinc-400 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
            <button
              onClick={copyEmbed}
              className="absolute top-2 right-2 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-surface-800 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 hover:border-white/10 transition-colors"
            >
              {embedCopied ? <><Check size={11} strokeWidth={2} className="text-green-400" /> Copied</> : <><Copy size={11} strokeWidth={1.75} /> Copy</>}
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 mt-2">Set <code className="text-zinc-500">height</code> to match your design. 700px works well for most layouts.</p>
        </div>
      )}

      {expanded && (
        <div className="border-t border-surface-800 px-5 py-3 bg-surface-950/50">
          {loadingBookings ? (
            <p className="text-xs text-zinc-600 py-2">Loading bookings...</p>
          ) : !bookings?.length ? (
            <p className="text-xs text-zinc-600 py-2">No bookings yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {bookings.map(b => (
                <div key={b.id} className="flex items-center justify-between text-sm py-1.5 group/booking">
                  <div className="min-w-0">
                    <span className="text-zinc-200">{b.guest_name}</span>
                    {b.guest_email && <span className="text-zinc-600 ml-2 text-xs">{b.guest_email}</span>}
                    {b.message && <p className="text-xs text-zinc-500 italic mt-0.5 truncate">"{b.message}"</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-zinc-500">
                      {new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-xs text-zinc-500">{formatTime(b.start_time)} – {formatTime(b.end_time)}</span>
                    <Badge variant={b.status === 'confirmed' ? 'green' : b.status === 'cancelled' ? 'red' : 'ghost'} className="text-[10px]">
                      {b.status}
                    </Badge>
                    <div className="hidden group-hover/booking:flex items-center gap-1">
                      {b.status === 'confirmed' && (
                        <button onClick={async () => {
                          await onUpdateBookingStatus(b.id, 'cancelled')
                          setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'cancelled' } : x))
                        }} className="text-[10px] text-zinc-600 hover:text-amber-400 transition-colors px-1">Cancel</button>
                      )}
                      <button onClick={async () => {
                        await onDeleteBooking(b.id)
                        setBookings(prev => prev.filter(x => x.id !== b.id))
                      }} className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors px-1">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={editing} onClose={() => setEditing(false)} title="Edit Booking Page">
        <form onSubmit={async (e) => {
          e.preventDefault()
          if (!editForm.name) return
          await onEdit(page.id, {
            name: editForm.name,
            description: editForm.description,
            duration_minutes: editForm.durationMinutes,
            available_hours: { start: editForm.startHour, end: editForm.endHour },
            available_days: editForm.days,
            required_fields: editForm.requiredFields,
          })
          setEditing(false)
        }} className="space-y-4">

          {/* Logo */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Logo</label>
            <div className="flex items-center gap-3">
              {page.logo_url ? (
                <div className={`rounded-lg px-3 py-2 inline-flex flex-shrink-0 ${page.logo_is_dark ? 'bg-[#f0f0f0]' : 'bg-[#1a1a1e] border border-white/10'}`}>
                  <img src={page.logo_url} alt="" className="max-h-6 max-w-[100px] object-contain" />
                </div>
              ) : (
                <div className="w-14 h-10 rounded-lg bg-surface-700 border border-dashed border-white/10 flex items-center justify-center flex-shrink-0">
                  <ImagePlus size={14} strokeWidth={1.5} className="text-zinc-600" />
                </div>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <label className={`cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : ''} border-white/10 text-zinc-300 hover:text-zinc-100 hover:border-white/20 bg-white/[0.03]`}>
                  {logoUploading ? 'Uploading…' : page.logo_url ? 'Replace' : 'Upload logo'}
                  <input type="file" accept="image/*" className="hidden" disabled={logoUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setLogoUploading(true)
                      await onUploadLogo(page.id, file)
                      setLogoUploading(false)
                      e.target.value = ''
                    }} />
                </label>
                {page.logo_url && (
                  <button type="button" onClick={() => onRemoveLogo(page.id)}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                    Remove
                  </button>
                )}
              </div>
            </div>
            {page.logo_url && (
              <div className="flex items-center gap-2 mt-3">
                <button type="button"
                  onClick={() => onEdit(page.id, { logo_is_dark: true })}
                  className={`rounded-lg px-3 py-2 flex items-center justify-center bg-[#f0f0f0] transition-all ${page.logo_is_dark !== false ? 'ring-2 ring-accent' : 'opacity-40 hover:opacity-70'}`}>
                  <img src={page.logo_url} alt="" className="max-h-6 max-w-[80px] object-contain" />
                </button>
                <button type="button"
                  onClick={() => onEdit(page.id, { logo_is_dark: false })}
                  className={`rounded-lg px-3 py-2 flex items-center justify-center bg-[#1a1a1e] border border-white/10 transition-all ${page.logo_is_dark === false ? 'ring-2 ring-accent' : 'opacity-40 hover:opacity-70'}`}>
                  <img src={page.logo_url} alt="" className="max-h-6 max-w-[80px] object-contain" />
                </button>
                <p className="text-[11px] text-zinc-600 ml-1">Pick which background your logo needs</p>
              </div>
            )}
            {!page.logo_url && <p className="text-[11px] text-zinc-600 mt-1.5">PNG or SVG recommended.</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Page Name</label>
            <input type="text" value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description (optional)</label>
            <textarea value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button key={d} type="button" onClick={() => setEditForm(f => ({ ...f, durationMinutes: d }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    editForm.durationMinutes === d
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-surface-600 text-zinc-400 bg-surface-700 hover:border-surface-500'
                  }`}>{d} min</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Time</label>
              <input type="time" value={editForm.startHour}
                onChange={e => setEditForm(f => ({ ...f, startHour: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Time</label>
              <input type="time" value={editForm.endHour}
                onChange={e => setEditForm(f => ({ ...f, endHour: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Available Days</label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button key={i} type="button"
                  onClick={() => setEditForm(f => ({
                    ...f, days: f.days.includes(i) ? f.days.filter(x => x !== i) : [...f.days, i].sort(),
                  }))}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    editForm.days.includes(i)
                      ? 'bg-accent/15 border border-accent/30 text-accent'
                      : 'bg-surface-700 border border-surface-600 text-zinc-600 hover:text-zinc-400'
                  }`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Required Fields</label>
            <div className="space-y-2">
              {[
                { key: 'name', label: 'Name', locked: true },
                { key: 'email', label: 'Email' },
                { key: 'message', label: 'Message' },
              ].map(({ key, label, locked }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={editForm.requiredFields[key]}
                    disabled={locked}
                    onChange={() => !locked && setEditForm(f => ({
                      ...f, requiredFields: { ...f.requiredFields, [key]: !f.requiredFields[key] },
                    }))}
                    className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-700 text-accent focus:ring-accent/30 disabled:opacity-50" />
                  <span className={`text-sm ${locked ? 'text-zinc-500' : 'text-zinc-300'}`}>
                    {label}{locked ? ' (always required)' : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" disabled={!editForm.name || editForm.days.length === 0}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export function BookingPages() {
  const {
    bookingPages, createBookingPage, updateBookingPage, deleteBookingPage,
    uploadBookingPageLogo, removeBookingPageLogo,
    fetchBookingsForPage, updateBookingStatus, deleteBooking,
    loading, canAddBookingPage, isProPlan, FREE_BOOKING_PAGE_LIMIT,
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
    requiredFields: { name: true, email: true, message: false },
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
      requiredFields: form.requiredFields,
    })
    setShowModal(false)
    setForm({ name: '', description: '', durationMinutes: 30, startHour: '09:00', endHour: '17:00', days: [1, 2, 3, 4, 5], requiredFields: { name: true, email: true, message: false } })
  }

  if (loading) return <PageLoader />


  return (
    <div className="px-5 sm:px-8 lg:px-14 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10 sm:mb-12">
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15]">Booking Pages</h1>
          <p className="text-[15px] text-zinc-400 mt-2 leading-relaxed">Create shareable links so people can book time with you.</p>
        </div>
        <Button onClick={openNew} className="flex-shrink-0 self-start">
          <Plus size={14} strokeWidth={2} className="mr-1.5" />
          New Page
        </Button>
      </div>

      {!isProPlan && bookingPages.length >= FREE_BOOKING_PAGE_LIMIT && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-accent/8 border border-accent/20 rounded-xl px-4 py-3">
          <p className="text-sm text-zinc-400">
            Free plan includes <span className="text-zinc-200 font-medium">{FREE_BOOKING_PAGE_LIMIT} booking page{FREE_BOOKING_PAGE_LIMIT !== 1 ? 's' : ''}</span>. Upgrade to add more.
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
        <div className="grid gap-4 lg:grid-cols-2">
          {bookingPages.map(p => (
            <BookingPageCard
              key={p.id}
              page={p}
              onToggle={(id, active) => updateBookingPage(id, { is_active: active })}
              onDelete={deleteBookingPage}
              onEdit={updateBookingPage}
              onFetchBookings={fetchBookingsForPage}
              onUpdateBookingStatus={updateBookingStatus}
              onDeleteBooking={deleteBooking}
              onUploadLogo={uploadBookingPageLogo}
              onRemoveLogo={removeBookingPageLogo}
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

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Required Fields</label>
            <div className="space-y-2">
              {[
                { key: 'name', label: 'Name', locked: true },
                { key: 'email', label: 'Email' },
                { key: 'message', label: 'Message' },
              ].map(({ key, label, locked }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiredFields[key]}
                    disabled={locked}
                    onChange={() => !locked && setForm(f => ({
                      ...f,
                      requiredFields: { ...f.requiredFields, [key]: !f.requiredFields[key] },
                    }))}
                    className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-700 text-accent focus:ring-accent/30 disabled:opacity-50"
                  />
                  <span className={`text-sm ${locked ? 'text-zinc-500' : 'text-zinc-300'}`}>
                    {label}{locked ? ' (always required)' : ''}
                  </span>
                </label>
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

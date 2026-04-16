import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'

function formatDateRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts = { month: 'short', day: 'numeric' }
  if (s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString('en-US', opts)} – ${e.getDate()}, ${e.getFullYear()}`
  }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}, ${e.getFullYear()}`
}

function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'In progress'
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
}

function ProjectCard({ production }) {
  const navigate = useNavigate()
  const countdown = daysUntil(production.startDate)

  return (
    <div
      onClick={() => navigate(`/production/${production.id}`)}
      className="bg-surface-900 border border-surface-700 rounded-xl p-5 cursor-pointer hover:border-surface-500 hover:bg-surface-800 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-zinc-100 leading-snug group-hover:text-white">
          {production.name}
        </h3>
      </div>

      <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{production.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="ghost">{formatDateRange(production.startDate, production.endDate)}</Badge>
          <Badge variant={countdown === 'Today' || countdown === 'Tomorrow' ? 'yellow' : countdown === 'In progress' ? 'green' : 'ghost'}>
            {countdown}
          </Badge>
        </div>
        <span className="text-xs text-zinc-600">{production.groups.length} group{production.groups.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { productions, createProduction, loading, connectedCalendars, slots } = useApp()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' })

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name || !form.startDate || !form.endDate) return
    const id = await createProduction(form)
    setShowModal(false)
    setForm({ name: '', description: '', startDate: '', endDate: '' })
    navigate(`/production/${id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Loading...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
        </div>
        <Button onClick={() => setShowModal(true)}>+ New Project</Button>
      </div>

      {/* Setup prompt for new users */}
      {connectedCalendars.length === 0 && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl px-6 py-5 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-100 mb-1">Welcome to Coordie!</p>
            <p className="text-sm text-zinc-400">Connect your Google Calendar and set up your time slots to get started.</p>
          </div>
          <Button size="sm" onClick={() => navigate('/calendars')}>Set Up →</Button>
        </div>
      )}

      {productions.length === 0 ? (
        <div className="border border-dashed border-surface-600 rounded-xl p-12 text-center">
          <p className="text-zinc-500 mb-4">No projects yet.</p>
          <Button onClick={() => setShowModal(true)}>Create your first project</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {productions.map(p => (
            <ProjectCard key={p.id} production={p} />
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Project">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Project Name</label>
            <input
              type="text"
              placeholder="e.g. Pacific Coast Lifestyle Campaign"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description (optional)</label>
            <textarea
              placeholder="Brief description of the project..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.name || !form.startDate || !form.endDate}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { UpgradeModal } from '../components/ui/UpgradeModal'
import { FolderOpen, Plus } from 'lucide-react'

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
  const countdown = production.startDate ? daysUntil(production.startDate) : null

  return (
    <div
      onClick={() => navigate(`/production/${production.id}`)}
      className="bg-surface-900 border border-surface-700 rounded-xl p-5 sm:p-6 cursor-pointer shadow-sm shadow-black/10 hover:border-surface-500 hover:bg-surface-800/80 hover:shadow-lg hover:shadow-black/20 transition-all duration-150 group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-zinc-100 leading-snug group-hover:text-white">
          {production.name}
        </h3>
      </div>

      {production.description && <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{production.description}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {production.startDate && production.endDate && (
            <Badge variant="ghost">{formatDateRange(production.startDate, production.endDate)}</Badge>
          )}
          {countdown && (
            <Badge variant={countdown === 'Today' || countdown === 'Tomorrow' ? 'yellow' : countdown === 'In progress' ? 'green' : 'ghost'}>
              {countdown}
            </Badge>
          )}
        </div>
        <span className="text-xs text-zinc-600">{production.groups.length} group{production.groups.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { productions, createProduction, loading, canAddProject, isProPlan, FREE_PROJECT_LIMIT } = useApp()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' })

  function openNewProject() {
    if (!canAddProject()) { setShowUpgrade(true); return }
    setShowModal(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name) return
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
    <div className="px-5 sm:px-8 lg:px-16 py-6 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-zinc-100">Projects</h1>
          <p className="text-sm text-zinc-500 mt-1">Your active productions, all in one place.</p>
        </div>
        <Button onClick={openNewProject} className="flex-shrink-0 self-start">
          <Plus size={14} strokeWidth={2} className="mr-1.5" />
          New Project
        </Button>
      </div>

      {/* Free tier limit notice */}
      {!isProPlan && productions.length >= FREE_PROJECT_LIMIT && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-accent/8 border border-accent/20 rounded-xl px-4 py-3">
          <p className="text-sm text-zinc-400">
            Free plan includes <span className="text-zinc-200 font-medium">{FREE_PROJECT_LIMIT} project</span>. Upgrade to add more.
          </p>
          <button
            onClick={() => setShowUpgrade(true)}
            className="flex-shrink-0 text-xs font-semibold text-accent hover:text-amber-400 transition-colors"
          >
            Upgrade →
          </button>
        </div>
      )}

      {productions.length === 0 ? (
        <div className="border border-dashed border-surface-600 rounded-2xl p-12 sm:p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center mx-auto mb-5">
            <FolderOpen size={20} strokeWidth={1.5} className="text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-300 mb-1">No projects yet</p>
          <p className="text-sm text-zinc-600 mb-6">Create your first project to get started.</p>
          <Button onClick={openNewProject}>
            <Plus size={14} strokeWidth={2} className="mr-1.5" />
            Create project
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productions.map(p => (
            <ProjectCard key={p.id} production={p} />
          ))}
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          reason={`Free plan includes ${FREE_PROJECT_LIMIT} project. Upgrade to Pro to create unlimited projects.`}
        />
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
            <Button type="submit" disabled={!form.name}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

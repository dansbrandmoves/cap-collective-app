import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { UpgradeModal } from '../components/ui/UpgradeModal'
import { FolderOpen, Plus, CalendarDays, Users, Pencil, ArrowRight, Trash2 } from 'lucide-react'
import { PageLoader } from '../components/ui/PageLoader'

function formatDateRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts = { month: 'short', day: 'numeric' }
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: 'In progress', style: 'text-green-400 bg-green-500/10 border-green-500/20' }
  if (diff === 0) return { label: 'Today', style: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
  if (diff === 1) return { label: 'Tomorrow', style: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
  return { label: `In ${diff} days`, style: 'text-zinc-400 bg-white/[0.04] border-white/10' }
}

function ProjectCard({ production, onUpdate, onDelete }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editForm, setEditForm] = useState({
    name: production.name,
    description: production.description || '',
    startDate: production.startDate || '',
    endDate: production.endDate || '',
  })

  const countdown = production.startDate ? daysUntil(production.startDate) : null
  const totalRooms = production.rooms?.length ?? 0

  async function handleSave(e) {
    e.preventDefault()
    if (!editForm.name.trim()) return
    await onUpdate(production.id, {
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      startDate: editForm.startDate || null,
      endDate: editForm.endDate || null,
    })
    setEditing(false)
  }

  return (
    <>
      <div className="bg-surface-900 border border-white/[0.06] rounded-2xl overflow-hidden shadow-sm shadow-black/10 hover:border-white/10 hover:shadow-lift transition-all duration-200 ease-ios">
        <div className="p-5 sm:p-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3
              onClick={() => navigate(`/project/${production.id}`)}
              className="text-[17px] font-semibold text-zinc-100 leading-snug tracking-tight cursor-pointer hover:text-white transition-colors"
            >
              {production.name}
            </h3>
            <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1.5">
              <button
                onClick={() => setEditing(true)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                title="Edit project"
              >
                <Pencil size={14} strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete project"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
              <button
                onClick={() => navigate(`/project/${production.id}`)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                title="Open project"
              >
                <ArrowRight size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Description */}
          {production.description && (
            <p className="text-sm text-zinc-400 mb-4 line-clamp-2 leading-relaxed">{production.description}</p>
          )}

          {/* Metadata */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1.5 mb-5">
            {production.startDate && production.endDate && (
              <div className="flex items-center gap-1.5 text-[13px] text-zinc-400">
                <CalendarDays size={13} strokeWidth={1.75} className="text-zinc-500" />
                {formatDateRange(production.startDate, production.endDate)}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[13px] text-zinc-400">
              <Users size={13} strokeWidth={1.75} className="text-zinc-500" />
              {totalRooms} {totalRooms === 1 ? 'room' : 'rooms'}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            {countdown ? (
              <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${countdown.style}`}>
                {countdown.label}
              </span>
            ) : <span />}
            <button
              onClick={() => navigate(`/project/${production.id}`)}
              className="text-[13px] font-medium text-zinc-500 hover:text-zinc-200 transition-colors flex items-center gap-1"
            >
              Open project <ArrowRight size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <Modal isOpen={editing} onClose={() => setEditing(false)} title="Edit Project">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Project Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description (optional)</label>
            <textarea
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Date</label>
              <input
                type="date"
                value={editForm.startDate}
                onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Date</label>
              <input
                type="date"
                value={editForm.endDate}
                onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" disabled={!editForm.name.trim()}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Project">
        <p className="text-sm text-zinc-400 mb-6">
          Delete <span className="text-zinc-100 font-medium">"{production.name}"</span>? This removes all rooms and data. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { onDelete(production.id); setConfirmDelete(false) }}>Delete</Button>
        </div>
      </Modal>
    </>
  )
}

export function Dashboard() {
  const { productions, createProduction, updateProduction, deleteProduction, loading, canAddProject, isProPlan, FREE_PROJECT_LIMIT } = useApp()
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
    navigate(`/project/${id}`)
  }

  if (loading) return <PageLoader />

  return (
    <div className="px-5 sm:px-8 lg:px-14 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10 sm:mb-12">
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15]">Projects</h1>
          <p className="text-[15px] text-zinc-400 mt-2 leading-relaxed">Your active productions, all in one place.</p>
        </div>
        <Button onClick={openNewProject} className="flex-shrink-0 self-start">
          <Plus size={14} strokeWidth={2} className="mr-1.5" />
          New Project
        </Button>
      </div>

      {!isProPlan && productions.length >= FREE_PROJECT_LIMIT && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-accent/8 border border-accent/20 rounded-xl px-4 py-3">
          <p className="text-sm text-zinc-400">
            Free plan includes <span className="text-zinc-200 font-medium">{FREE_PROJECT_LIMIT} project{FREE_PROJECT_LIMIT !== 1 ? 's' : ''}</span>. Upgrade to add more.
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
        <div className="grid gap-4 sm:grid-cols-2">
          {productions.map(p => (
            <ProjectCard
              key={p.id}
              production={p}
              onUpdate={updateProduction}
              onDelete={deleteProduction}
            />
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

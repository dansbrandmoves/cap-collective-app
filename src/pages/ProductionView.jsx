import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { UpgradeModal } from '../components/ui/UpgradeModal'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'
import { supabase } from '../utils/supabase'
import { Lock, Settings, Menu, X } from 'lucide-react'

export function ProductionView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getProduction, updateProduction, updateProductionNotes, deleteProduction, createRoom, updateRoomName, deleteRoom, effectiveSlots, calendarEvents, connectedCalendars, availabilityRules, prefixRules, slotStates, canAddRoom, isProPlan, FREE_ROOM_LIMIT, pendingRequestCounts } = useApp()

  const production = getProduction(id)
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [mobileShowSidebar, setMobileShowSidebar] = useState(false)
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [showEditProject, setShowEditProject] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', startDate: '', endDate: '' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState(null)
  const [editRoomName, setEditRoomName] = useState('')
  const [deletingRoomId, setDeletingRoomId] = useState(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  // Auto-select room with pending requests on first load
  useEffect(() => {
    if (!production || activeRoomId) return
    const roomWithPending = production.rooms.find(r => (pendingRequestCounts[r.id] || 0) > 0)
    if (roomWithPending) setActiveRoomId(roomWithPending.id)
  }, [production, pendingRequestCounts]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!production) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950">
        <div className="text-center">
          <p className="text-zinc-400 mb-2">Project not found</p>
          <Link to="/" className="text-sm text-accent hover:underline">Back to projects</Link>
        </div>
      </div>
    )
  }

  function openAddRoom() {
    if (!canAddRoom(id)) { setShowUpgrade(true); return }
    setShowNewRoom(true)
  }

  function handleCreateRoom(e) {
    e.preventDefault()
    if (!newRoomName.trim()) return
    const rid = createRoom(id, newRoomName.trim())
    setNewRoomName('')
    setShowNewRoom(false)
    setActiveRoomId(rid)
  }

  function handleNotesBlur() {
    updateProductionNotes(id, notesValue)
    setEditingNotes(false)
  }

  function startEditingNotes() {
    setNotesValue(production.ownerNotes)
    setEditingNotes(true)
  }

  function openEditProject() {
    setEditForm({ name: production.name, description: production.description || '', startDate: production.startDate || '', endDate: production.endDate || '' })
    setShowEditProject(true)
  }

  async function handleEditProject(e) {
    e.preventDefault()
    if (!editForm.name) return
    await updateProduction(id, editForm)
    setShowEditProject(false)
  }

  async function handleDeleteProject() {
    await deleteProduction(id)
    navigate('/')
  }

  async function handleEditRoomName(roomId) {
    if (!editRoomName.trim()) return
    await updateRoomName(id, roomId, editRoomName.trim())
    setEditingRoomId(null)
  }

  async function handleDeleteRoom(roomId) {
    await deleteRoom(id, roomId)
    setDeletingRoomId(null)
    if (activeRoomId === roomId) setActiveRoomId(null)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {mobileShowSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-surface-900 border-r border-white/[0.06] flex flex-col
        md:relative md:z-auto md:translate-x-0
        transition-transform duration-300 ease-ios
        ${mobileShowSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Project header */}
        <div className="px-5 py-5 border-b border-white/[0.05]">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate('/')} className="text-[12px] text-zinc-500 hover:text-zinc-200 flex items-center gap-1 transition-colors">
              ← Projects
            </button>
            <button onClick={() => setMobileShowSidebar(false)} className="md:hidden text-zinc-500 hover:text-zinc-200 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-zinc-50 leading-snug tracking-tight">{production.name}</h2>
              {(production.startDate || production.endDate) && (
                <p className="text-xs text-zinc-500 mt-1">
                  {production.startDate && production.endDate
                    ? `${production.startDate} → ${production.endDate}`
                    : production.startDate || production.endDate}
                </p>
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={openEditProject} className="text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded px-2 py-1 transition-colors">Edit</button>
              <button onClick={() => setShowDeleteConfirm(true)} className="text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded px-2 py-1 transition-colors">Delete</button>
            </div>
          </div>
        </div>

        {/* Rooms list */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Rooms</p>
            <button onClick={openAddRoom} className="text-xs text-zinc-500 hover:text-accent transition-colors">+ New Room</button>
          </div>

          {production.rooms.length === 0 && (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-zinc-600 mb-3">No rooms yet.</p>
              <Button size="sm" variant="secondary" onClick={openAddRoom}>Create first room</Button>
            </div>
          )}

          {production.rooms.map(room => {
            const isActive = activeRoomId === room.id
            const isEditing = editingRoomId === room.id

            if (isEditing) {
              return (
                <div key={room.id} className="flex items-center gap-1 px-2 py-1 mb-0.5">
                  <input
                    type="text"
                    value={editRoomName}
                    onChange={e => setEditRoomName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditRoomName(room.id); if (e.key === 'Escape') setEditingRoomId(null) }}
                    autoFocus
                    className="flex-1 bg-surface-700 border border-surface-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                  />
                  <button onClick={() => handleEditRoomName(room.id)} className="text-xs text-accent px-1">Save</button>
                  <button onClick={() => setEditingRoomId(null)} className="text-xs text-zinc-600 px-1">Cancel</button>
                </div>
              )
            }

            return (
              <div key={room.id} className="mb-0.5">
                <div className={`flex items-center gap-1 rounded-lg group/item transition-colors ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                }`}>
                  <button
                    onClick={() => setActiveRoomId(isActive ? null : room.id)}
                    className={`flex-1 text-left px-3 py-2.5 text-[13px] transition-colors truncate ${
                      isActive ? 'text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {room.name}
                  </button>
                  {(pendingRequestCounts[room.id] || 0) > 0 && (
                    <span className="bg-accent text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mr-1">
                      {pendingRequestCounts[room.id]}
                    </span>
                  )}
                  <div className="hidden group-hover/item:flex items-center gap-0.5 pr-2">
                    <button onClick={() => { setEditingRoomId(room.id); setEditRoomName(room.name) }} className="text-xs text-zinc-600 hover:text-zinc-300 px-1 py-1 transition-colors">Edit</button>
                    <button onClick={() => setDeletingRoomId(room.id)} className="text-xs text-red-700 hover:text-red-400 px-1 py-1 transition-colors">Delete</button>
                  </div>
                </div>

                {/* Inline sharing panel */}
                {isActive && (
                  <RoomSidePanel
                    productionId={id}
                    room={room}
                    onNavigateToInbox={() => { navigate('/inbox'); setMobileShowSidebar(false) }}
                    onOpenRoom={() => { navigate(`/room/${room.openToken}`); setMobileShowSidebar(false) }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Private notes */}
        <div className="border-t border-white/[0.05] bg-surface-950 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock size={12} strokeWidth={1.75} className="text-zinc-600" />
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Private Notes</p>
          </div>
          {editingNotes ? (
            <textarea
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              onBlur={handleNotesBlur}
              autoFocus
              rows={5}
              className="w-full bg-surface-800 border border-accent/30 rounded-lg px-3 py-2 text-xs text-zinc-300 resize-none focus:outline-none focus:border-accent/60"
            />
          ) : (
            <div
              onClick={startEditingNotes}
              className="cursor-text rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors min-h-[52px] leading-relaxed"
            >
              {production.ownerNotes || <span className="text-zinc-700">Click to add private notes...</span>}
            </div>
          )}
        </div>
      </div>

      {/* Main area — always the calendar */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] bg-surface-900 flex-shrink-0">
          <button onClick={() => navigate('/')} className="text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0">
            ← Projects
          </button>
          <span className="text-sm font-medium text-zinc-100 flex-1 truncate">{production.name}</span>
          <button
            onClick={() => setMobileShowSidebar(true)}
            className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-100 transition-colors flex-shrink-0"
          >
            <Menu size={15} />
            <span>Rooms</span>
          </button>
        </div>

        <ProjectCalendar
          roomIds={production.rooms.map(r => r.id)}
          production={production}
          onUpdateProduction={updateProduction}
        />
      </div>

      {/* Add Room Modal */}
      <Modal isOpen={showNewRoom} onClose={() => setShowNewRoom(false)} title="New Room">
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Room Name</label>
            <input
              type="text"
              placeholder="e.g. Clients, Crew, Vendors..."
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              autoFocus
            />
            <p className="text-sm text-zinc-500 mt-1.5">Each room gets its own link and availability view.</p>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setShowNewRoom(false)}>Cancel</Button>
            <Button type="submit" disabled={!newRoomName.trim()}>Create Room</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal isOpen={showEditProject} onClose={() => setShowEditProject(false)} title="Edit Project">
        <form onSubmit={handleEditProject} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Project Name</label>
            <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description (optional)</label>
            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Date</label>
              <input type="date" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Date</label>
              <input type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowEditProject(false)}>Cancel</Button>
            <Button type="submit" disabled={!editForm.name}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Room Confirmation */}
      <Modal isOpen={!!deletingRoomId} onClose={() => setDeletingRoomId(null)} title="Delete Room">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">Are you sure you want to delete this room? This will also delete its notes, messages, and date requests.</p>
          <p className="text-sm text-red-400">This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeletingRoomId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDeleteRoom(deletingRoomId)}>Delete Room</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Project Confirmation */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Project">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            Are you sure you want to delete <strong>{production.name}</strong>? This will also delete all rooms, notes, and date requests inside it.
          </p>
          <p className="text-sm text-red-400">This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteProject}>Delete Project</Button>
          </div>
        </div>
      </Modal>

      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          reason={`Free plan includes ${FREE_ROOM_LIMIT} rooms per project. Upgrade to Pro for unlimited rooms.`}
        />
      )}
    </div>
  )
}

// Inline sidebar panel shown when a room is selected
function RoomSidePanel({ productionId, room, onNavigateToInbox, onOpenRoom }) {
  const { updateRoomAccessMode, addRoomMember, removeRoomMember, getMembersForRoom, getRoomLink, fetchDateRequests, updateDateRequestStatus } = useApp()
  const members = getMembersForRoom(room.id)
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetchDateRequests(room.id).then(reqs => {
      setPendingCount(reqs.filter(r => r.status === 'pending').length)
    })
  }, [room.id, fetchDateRequests])

  function copyLink(token) {
    navigator.clipboard.writeText(getRoomLink(token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleAddMember(e) {
    e.preventDefault()
    if (!memberName.trim()) return
    addRoomMember(room.id, { name: memberName.trim(), email: memberEmail.trim() })
    setMemberName('')
    setMemberEmail('')
    setShowAddMember(false)
  }

  const openToken = room.openToken

  return (
    <div className="mx-2 mb-2 bg-surface-800/60 border border-white/[0.05] rounded-xl p-3 space-y-3">
      {/* Access mode */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <button
            onClick={() => updateRoomAccessMode(room.id, 'open_link')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              room.accessMode === 'open_link' ? 'bg-accent text-white' : 'bg-surface-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >Open Link</button>
          <button
            onClick={() => updateRoomAccessMode(room.id, 'invite_only')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              room.accessMode === 'invite_only' ? 'bg-accent text-white' : 'bg-surface-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >Invite Only</button>
        </div>

        {room.accessMode === 'open_link' && openToken && (
          <div className="flex items-center gap-1.5">
            <code className="flex-1 bg-surface-900 rounded-md px-2 py-1.5 text-[10px] text-zinc-500 truncate min-w-0">
              {getRoomLink(openToken)}
            </code>
            <button
              onClick={() => copyLink(openToken)}
              className="flex-shrink-0 text-[11px] font-medium text-zinc-400 hover:text-zinc-100 bg-surface-700 hover:bg-surface-600 px-2 py-1.5 rounded-md transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        {room.accessMode === 'invite_only' && (
          <div className="space-y-1.5">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-surface-900 rounded-md px-2 py-1.5">
                <div className="w-5 h-5 rounded-full bg-surface-700 flex items-center justify-center text-[10px] font-semibold text-zinc-300 flex-shrink-0">
                  {m.name[0]}
                </div>
                <span className="flex-1 text-[11px] text-zinc-300 truncate min-w-0">{m.name}</span>
                <button
                  onClick={() => copyLink(m.inviteToken || m.invite_token)}
                  className="text-[10px] text-zinc-500 hover:text-accent transition-colors flex-shrink-0"
                >
                  {copied ? '✓' : 'Copy'}
                </button>
                <button
                  onClick={() => removeRoomMember(m.id)}
                  className="text-[10px] text-red-700 hover:text-red-400 transition-colors flex-shrink-0"
                >×</button>
              </div>
            ))}
            {showAddMember ? (
              <form onSubmit={handleAddMember} className="space-y-1.5">
                <input type="text" placeholder="Name" value={memberName} onChange={e => setMemberName(e.target.value)} autoFocus
                  className="w-full bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent" />
                <input type="email" placeholder="Email (optional)" value={memberEmail} onChange={e => setMemberEmail(e.target.value)}
                  className="w-full bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent" />
                <div className="flex gap-1.5">
                  <Button size="sm" type="submit" disabled={!memberName.trim()}>Add</Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowAddMember(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowAddMember(true)} className="text-[11px] text-accent hover:underline">+ Add person</button>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
        <button
          onClick={onNavigateToInbox}
          className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          {pendingCount > 0 ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}` : 'Inbox'}
        </button>
        <button
          onClick={onOpenRoom}
          className="text-[11px] font-medium text-accent hover:underline"
        >
          Open room →
        </button>
      </div>
    </div>
  )
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOUR_OPTIONS = (() => {
  const opts = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const period = h >= 12 ? 'PM' : 'AM'
      opts.push({ val, label: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}` })
    }
  }
  return opts
})()

function ProjectAvailabilityEditor({ config, onSave, onReset, onClose }) {
  const [mode, setMode] = useState(config.mode || 'blocks')
  const [dur, setDur] = useState(config.blockDuration || 30)
  const [slotSelection, setSlotSelection] = useState(config.guestSlotSelection || false)
  const [schedule, setSchedule] = useState(config.businessHours?.schedule || {
    0: null, 1: { start: '09:00', end: '17:00' }, 2: { start: '09:00', end: '17:00' },
    3: { start: '09:00', end: '17:00' }, 4: { start: '09:00', end: '17:00' },
    5: { start: '09:00', end: '17:00' }, 6: null,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={mode} onChange={e => setMode(e.target.value)}
          className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent">
          <option value="blocks">Time blocks</option>
          <option value="slots">Named slots</option>
        </select>
        {mode === 'blocks' && (
          <select value={dur} onChange={e => setDur(Number(e.target.value))}
            className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent">
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
          </select>
        )}
      </div>

      <div className="space-y-0">
        {DAY_NAMES.map((name, i) => {
          const day = schedule[i]
          const isActive = !!day
          return (
            <div key={i} className="flex items-center h-9 gap-2.5">
              <button onClick={() => setSchedule(s => ({ ...s, [i]: s[i] ? null : { start: '09:00', end: '17:00' } }))}
                className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${isActive ? 'bg-accent' : 'bg-surface-700'}`}>
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className={`w-8 text-xs font-medium ${isActive ? 'text-zinc-200' : 'text-zinc-600'}`}>{name.slice(0, 3)}</span>
              {isActive ? (
                <>
                  <select value={day.start} onChange={e => setSchedule(s => ({ ...s, [i]: { ...s[i], start: e.target.value } }))}
                    className="text-[11px] bg-surface-700 border border-surface-600 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-accent">
                    {HOUR_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                  <span className="text-[10px] text-zinc-600">–</span>
                  <select value={day.end} onChange={e => setSchedule(s => ({ ...s, [i]: { ...s[i], end: e.target.value } }))}
                    className="text-[11px] bg-surface-700 border border-surface-600 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-accent">
                    {HOUR_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                </>
              ) : (
                <span className="text-[11px] text-zinc-600">Off</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between py-2 border-t border-surface-700">
        <div>
          <p className="text-xs text-zinc-300">Guests select specific time slots</p>
          <p className="text-[10px] text-zinc-600">Off = guests pick whole days. On = guests pick individual slots.</p>
        </div>
        <button onClick={() => setSlotSelection(!slotSelection)}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${slotSelection ? 'bg-accent' : 'bg-surface-700'}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${slotSelection ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-surface-700">
        <button onClick={onReset} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Reset to global</button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => onSave({ mode, blockDuration: dur, businessHours: { schedule }, guestSlotSelection: slotSelection })}>Save</Button>
        </div>
      </div>
    </div>
  )
}

function ProjectCalendar({ roomIds, production, onUpdateProduction }) {
  const { effectiveSlots, calendarEvents, connectedCalendars, availabilityRules, prefixRules, slotStates, availabilityMode, blockDuration, businessHours } = useApp()
  const [dateRequests, setDateRequests] = useState([])
  const [sharedAvailability, setSharedAvailability] = useState([])
  const [showSettings, setShowSettings] = useState(false)

  const config = production.availabilityConfig || production.availability_config

  useEffect(() => {
    if (config) return
    const globalConfig = {
      mode: availabilityMode,
      blockDuration,
      businessHours,
      customSlots: availabilityMode === 'slots' ? effectiveSlots : undefined,
    }
    onUpdateProduction(production.id, { availability_config: globalConfig })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isCustom = !!config
  const projectSlots = useMemo(() => {
    if (!config) return effectiveSlots
    if (config.mode === 'slots') return config.customSlots || effectiveSlots
    const schedule = config.businessHours?.schedule || {}
    let earliest = '23:59', latest = '00:00'
    for (const day of Object.values(schedule)) {
      if (!day) continue
      if (day.start < earliest) earliest = day.start
      if (day.end > latest) latest = day.end
    }
    if (earliest >= latest) return effectiveSlots
    const dur = config.blockDuration || 30
    const generated = []
    let [h, m] = earliest.split(':').map(Number)
    const endMins = latest.split(':').map(Number).reduce((a, b, i) => a + (i === 0 ? b * 60 : b), 0)
    while (h * 60 + m + dur <= endMins) {
      const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const te = h * 60 + m + dur
      const end = `${String(Math.floor(te / 60)).padStart(2, '0')}:${String(te % 60).padStart(2, '0')}`
      const period = h >= 12 ? 'PM' : 'AM'
      generated.push({ id: `block-${start}`, name: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`, startTime: start, endTime: end, color: '#22c55e', defaultState: 'available' })
      m += dur
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60 }
    }
    return generated
  }, [config, effectiveSlots])

  useEffect(() => {
    if (!roomIds.length) return
    supabase.from('date_requests').select('*').in('room_id', roomIds)
      .then(({ data }) => setDateRequests(data || []))
    supabase.from('shared_availability').select('*').in('room_id', roomIds)
      .then(({ data }) => setSharedAvailability(data || []))
  }, [roomIds])

  function buildGlobalConfig() {
    return {
      mode: availabilityMode,
      blockDuration,
      businessHours,
      customSlots: availabilityMode === 'slots' ? effectiveSlots : undefined,
    }
  }

  function handleResetToGlobal() {
    onUpdateProduction(production.id, { availability_config: buildGlobalConfig() })
    setShowSettings(false)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 sm:px-8 py-4 border-b border-white/[0.05] flex items-center justify-between gap-3 flex-shrink-0">
        <h2 className="text-[18px] font-semibold text-zinc-50 tracking-tight">
          Availability
          {isCustom && (
            <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 align-middle">Custom</span>
          )}
        </h2>
        <button onClick={() => setShowSettings(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-colors"
          title="Availability settings for this project">
          <Settings size={15} strokeWidth={1.75} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8">
        <AvailabilityCalendar
          slots={projectSlots}
          calendarEvents={calendarEvents}
          connectedCalendars={connectedCalendars}
          availabilityRules={availabilityRules}
          prefixRules={prefixRules}
          isOwner={true}
          slotStates={slotStates}
          dateRequests={dateRequests}
          sharedAvailability={sharedAvailability}
          businessHours={isCustom ? config.businessHours : businessHours}
        />
      </div>

      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Project Availability">
        {isCustom ? (
          <ProjectAvailabilityEditor
            config={config}
            onSave={(updated) => {
              onUpdateProduction(production.id, { availability_config: updated })
              setShowSettings(false)
            }}
            onReset={handleResetToGlobal}
            onClose={() => setShowSettings(false)}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">This project uses your global availability settings. Customize to set different hours for this project.</p>
            <Button size="sm" onClick={() => {
              onUpdateProduction(production.id, { availability_config: buildGlobalConfig() })
              setShowSettings(false)
            }}>Customize for this project</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

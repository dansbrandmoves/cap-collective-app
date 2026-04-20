import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { UpgradeModal } from '../components/ui/UpgradeModal'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'
import { supabase } from '../utils/supabase'
import { Lock, Menu, X, Share2, ExternalLink, Check, Archive, XCircle, Eye, EyeOff } from 'lucide-react'

export function ProductionView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    getProduction, updateProduction, updateProductionNotes, deleteProduction,
    createRoom, updateRoomName, deleteRoom,
    effectiveSlots, calendarEvents, connectedCalendars, availabilityRules,
    prefixRules, slotStates, canAddRoom, FREE_ROOM_LIMIT, pendingRequestCounts,
    availabilityMode, blockDuration, businessHours,
  } = useApp()

  const production = getProduction(id)
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [mobileShowSidebar, setMobileShowSidebar] = useState(false)
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [showEditProject, setShowEditProject] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [renamingRoomId, setRenamingRoomId] = useState(null)
  const [deletingRoomId, setDeletingRoomId] = useState(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showShare, setShowShare] = useState(false)

  // Auto-select a room when productions load: prefer one with pending requests, else first
  useEffect(() => {
    if (!production || activeRoomId) return
    if (!production.rooms.length) return
    const roomWithPending = production.rooms.find(r => (pendingRequestCounts[r.id] || 0) > 0)
    setActiveRoomId((roomWithPending || production.rooms[0]).id)
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

  const activeRoom = production.rooms.find(r => r.id === activeRoomId) || null
  const renamingRoom = production.rooms.find(r => r.id === renamingRoomId) || null

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
    setMobileShowSidebar(false)
  }

  function handleNotesBlur() {
    updateProductionNotes(id, notesValue)
    setEditingNotes(false)
  }

  async function handleDeleteProject() {
    await deleteProduction(id)
    navigate('/')
  }

  async function handleDeleteRoom(roomId) {
    await deleteRoom(id, roomId)
    setDeletingRoomId(null)
    if (activeRoomId === roomId) {
      const remaining = production.rooms.filter(r => r.id !== roomId)
      setActiveRoomId(remaining[0]?.id || null)
    }
  }

  function handleSelectRoom(roomId) {
    setActiveRoomId(roomId)
    setMobileShowSidebar(false)
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
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-zinc-50 leading-snug tracking-tight truncate">{production.name}</h2>
              {(production.startDate || production.endDate) && (
                <p className="text-xs text-zinc-500 mt-1 truncate">
                  {production.startDate && production.endDate
                    ? `${production.startDate} → ${production.endDate}`
                    : production.startDate || production.endDate}
                </p>
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => setShowEditProject(true)} className="text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded px-2 py-1 transition-colors">Edit</button>
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
            const pending = pendingRequestCounts[room.id] || 0
            return (
              <div
                key={room.id}
                className={`flex items-center gap-1 rounded-lg mb-0.5 group/item transition-colors ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <button
                  onClick={() => handleSelectRoom(room.id)}
                  className={`flex-1 text-left px-3 py-2.5 text-[13px] transition-colors truncate ${
                    isActive ? 'text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {room.name}
                </button>
                {pending > 0 && (
                  <span className="bg-accent text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mr-1">
                    {pending}
                  </span>
                )}
                <div className="hidden group-hover/item:flex items-center gap-0.5 pr-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenamingRoomId(room.id) }}
                    className="text-xs text-zinc-600 hover:text-zinc-300 px-1 py-1 transition-colors"
                  >Rename</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingRoomId(room.id) }}
                    className="text-xs text-red-700 hover:text-red-400 px-1 py-1 transition-colors"
                  >Delete</button>
                </div>
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
              onClick={() => { setNotesValue(production.ownerNotes); setEditingNotes(true) }}
              className="cursor-text rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors min-h-[52px] leading-relaxed"
            >
              {production.ownerNotes || <span className="text-zinc-700">Click to add private notes...</span>}
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
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

        {activeRoom ? (
          <RoomCalendarPanel
            key={activeRoom.id}
            production={production}
            room={activeRoom}
            pendingCount={pendingRequestCounts[activeRoom.id] || 0}
            onShare={() => setShowShare(true)}
          />
        ) : (
          <EmptyState onCreate={openAddRoom} />
        )}
      </div>

      {/* Share Modal */}
      {activeRoom && (
        <ShareModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          room={activeRoom}
          pendingCount={pendingRequestCounts[activeRoom.id] || 0}
        />
      )}

      {/* New Room Modal */}
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
            <p className="text-sm text-zinc-500 mt-1.5">Each room gets its own shareable link.</p>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setShowNewRoom(false)}>Cancel</Button>
            <Button type="submit" disabled={!newRoomName.trim()}>Create Room</Button>
          </div>
        </form>
      </Modal>

      {/* Rename Room Modal */}
      {renamingRoom && (
        <RenameRoomModal
          room={renamingRoom}
          onClose={() => setRenamingRoomId(null)}
          onSave={async (name) => {
            await updateRoomName(id, renamingRoom.id, name)
            setRenamingRoomId(null)
          }}
        />
      )}

      {/* Edit Project Modal — includes availability settings */}
      <EditProjectModal
        isOpen={showEditProject}
        onClose={() => setShowEditProject(false)}
        production={production}
        onSave={async (updates) => {
          await updateProduction(id, updates)
          setShowEditProject(false)
        }}
        defaultAvailConfig={{
          mode: availabilityMode,
          blockDuration,
          businessHours,
          customSlots: availabilityMode === 'slots' ? effectiveSlots : undefined,
        }}
      />

      {/* Delete Room */}
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

      {/* Delete Project */}
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

function EmptyState({ onCreate }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-[15px] font-medium text-zinc-200 mb-1.5">No rooms yet</p>
        <p className="text-sm text-zinc-500 mb-5 leading-relaxed">Create a room to share availability with a group of people.</p>
        <Button onClick={onCreate}>Create a room</Button>
      </div>
    </div>
  )
}

function RoomCalendarPanel({ production, room, pendingCount, onShare }) {
  const { effectiveSlots, calendarEvents, connectedCalendars, availabilityRules, prefixRules, slotStates, businessHours, updateDateRequestStatus } = useApp()
  const [dateRequests, setDateRequests] = useState([])
  const [sharedAvailability, setSharedAvailability] = useState([])
  const [hiddenRequesters, setHiddenRequesters] = useState(() => new Set())
  const [showRequests, setShowRequests] = useState(false)

  const config = production.availabilityConfig || production.availability_config

  const pendingRequests = useMemo(
    () => dateRequests.filter(r => r.status === 'pending'),
    [dateRequests]
  )

  // Filter out hidden requesters for the calendar view
  const visibleDateRequests = useMemo(() => {
    if (hiddenRequesters.size === 0) return dateRequests
    return dateRequests.filter(r => !hiddenRequesters.has(r.requester_name))
  }, [dateRequests, hiddenRequesters])

  async function handleUpdateStatus(requestId, status) {
    const ok = await updateDateRequestStatus(requestId, status)
    if (ok) setDateRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r))
  }

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
    if (!room.id) return
    supabase.from('date_requests').select('*').eq('room_id', room.id)
      .then(({ data }) => setDateRequests(data || []))
    supabase.from('shared_availability').select('*').eq('room_id', room.id)
      .then(({ data }) => setSharedAvailability(data || []))
  }, [room.id])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 sm:px-8 py-4 border-b border-white/[0.05] flex items-center justify-between gap-3 flex-shrink-0">
        <div className="min-w-0 flex items-center gap-2.5">
          <h2 className="text-[18px] font-semibold text-zinc-50 tracking-tight truncate">{room.name}</h2>
          {pendingCount > 0 && (
            <button
              onClick={() => setShowRequests(true)}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors flex-shrink-0"
            >
              {pendingCount} pending
            </button>
          )}
        </div>
        <button
          onClick={onShare}
          className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-[13px] font-medium px-3.5 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <Share2 size={13} strokeWidth={2} />
          Share room
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
          dateRequests={visibleDateRequests}
          sharedAvailability={sharedAvailability}
          businessHours={config?.businessHours || businessHours}
        />
      </div>

      <PendingRequestsModal
        isOpen={showRequests}
        onClose={() => setShowRequests(false)}
        requests={pendingRequests}
        allRequests={dateRequests}
        hiddenRequesters={hiddenRequesters}
        onToggleRequester={(name) => setHiddenRequesters(prev => {
          const next = new Set(prev)
          if (next.has(name)) next.delete(name); else next.add(name)
          return next
        })}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  )
}

function PendingRequestsModal({ isOpen, onClose, requests, allRequests, hiddenRequesters, onToggleRequester, onUpdateStatus }) {
  // Group pending by requester so the filter list is clean
  const byRequester = useMemo(() => {
    const map = new Map()
    for (const r of requests) {
      if (!map.has(r.requester_name)) map.set(r.requester_name, [])
      map.get(r.requester_name).push(r)
    }
    return [...map.entries()].map(([name, reqs]) => ({ name, reqs }))
  }, [requests])

  function formatDates(dates) {
    return (dates || []).map(ds => {
      const d = new Date(ds + 'T00:00:00')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }).join(', ')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Pending requests · ${requests.length}`}>
      {byRequester.length === 0 ? (
        <div className="py-6 text-center text-sm text-zinc-500">
          All caught up. No pending requests.
        </div>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {byRequester.map(({ name, reqs }) => {
            const hidden = hiddenRequesters.has(name)
            return (
              <div key={name} className="bg-surface-800/60 border border-white/[0.05] rounded-xl overflow-hidden">
                {/* Requester header */}
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.04]">
                  <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-semibold text-zinc-200 flex-shrink-0">
                    {name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{name}</p>
                    <p className="text-[11px] text-zinc-500">{reqs.length} pending</p>
                  </div>
                  <button
                    onClick={() => onToggleRequester(name)}
                    title={hidden ? 'Show on calendar' : 'Hide from calendar'}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors ${
                      hidden
                        ? 'bg-surface-700 text-zinc-500 hover:text-zinc-200'
                        : 'bg-accent/10 text-accent hover:bg-accent/20'
                    }`}
                  >
                    {hidden ? <EyeOff size={11} strokeWidth={2} /> : <Eye size={11} strokeWidth={2} />}
                    {hidden ? 'Hidden' : 'Showing'}
                  </button>
                </div>

                {/* Individual requests */}
                {reqs.map(req => (
                  <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.04] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-zinc-200 truncate">{formatDates(req.dates)}</p>
                      {req.message && (
                        <p className="text-[11px] text-zinc-500 italic truncate mt-0.5">&ldquo;{req.message}&rdquo;</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => onUpdateStatus(req.id, 'approved')}
                        title="Approve"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                      >
                        <Check size={13} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => onUpdateStatus(req.id, 'declined')}
                        title="Decline"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <XCircle size={13} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => onUpdateStatus(req.id, 'archived')}
                        title="Archive"
                        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                      >
                        <Archive size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

function ShareModal({ isOpen, onClose, room, pendingCount }) {
  const navigate = useNavigate()
  const { updateRoomAccessMode, addRoomMember, removeRoomMember, getMembersForRoom, getRoomLink } = useApp()
  const members = getMembersForRoom(room.id)
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [copied, setCopied] = useState(null)

  function copyLink(token) {
    navigator.clipboard.writeText(getRoomLink(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${room.name}"`}>
      <div className="space-y-6">
        {/* Access mode */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-2.5">Access</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateRoomAccessMode(room.id, 'open_link')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                room.accessMode === 'open_link' ? 'bg-accent text-white' : 'bg-surface-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >Open Link</button>
            <button
              onClick={() => updateRoomAccessMode(room.id, 'invite_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                room.accessMode === 'invite_only' ? 'bg-accent text-white' : 'bg-surface-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >Invite Only</button>
          </div>
        </div>

        {/* Link / members */}
        {room.accessMode === 'open_link' && openToken && (
          <div>
            <p className="text-sm text-zinc-400 mb-2">Anyone with this link can enter. They&apos;ll be asked for their name on first visit.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-surface-800 rounded-lg px-3 py-2 text-xs text-zinc-400 truncate">
                {getRoomLink(openToken)}
              </code>
              <Button size="sm" variant="secondary" onClick={() => copyLink(openToken)}>
                {copied === openToken ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        {room.accessMode === 'invite_only' && (
          <div>
            <p className="text-sm text-zinc-400 mb-3">Each person gets their own unique link.</p>
            {members.length > 0 && (
              <div className="space-y-2 mb-3">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 bg-surface-800 rounded-lg px-3 py-2.5">
                    <div className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-xs font-semibold text-zinc-300 flex-shrink-0">
                      {m.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{m.name}</p>
                      {m.email && <p className="text-xs text-zinc-600 truncate">{m.email}</p>}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => copyLink(m.inviteToken || m.invite_token)}>
                      {copied === (m.inviteToken || m.invite_token) ? 'Copied!' : 'Copy Link'}
                    </Button>
                    <button
                      onClick={() => removeRoomMember(m.id)}
                      className="text-xs text-red-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}
            {showAddMember ? (
              <form onSubmit={handleAddMember} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder="Name (required)" value={memberName} onChange={e => setMemberName(e.target.value)} autoFocus
                    className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent" />
                  <input type="email" placeholder="Email (optional)" value={memberEmail} onChange={e => setMemberEmail(e.target.value)}
                    className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" type="submit" disabled={!memberName.trim()}>Add & Generate Link</Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowAddMember(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowAddMember(true)} className="text-xs text-accent hover:underline">+ Add person</button>
            )}
          </div>
        )}

        {/* Pending / Inbox */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
          <span className="text-sm text-zinc-400">
            {pendingCount > 0 ? (
              <><span className="text-zinc-100 font-medium">{pendingCount}</span> pending request{pendingCount !== 1 ? 's' : ''}</>
            ) : 'No date requests yet'}
          </span>
          <button
            onClick={() => { onClose(); navigate('/inbox') }}
            className="text-xs text-accent hover:underline"
          >
            View in Inbox →
          </button>
        </div>

        {/* Preview as guest */}
        {openToken && (
          <a
            href={getRoomLink(openToken)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full bg-surface-800 hover:bg-surface-700 border border-white/[0.06] text-zinc-300 hover:text-zinc-100 text-[13px] font-medium px-3.5 py-2.5 rounded-lg transition-colors"
          >
            <ExternalLink size={13} strokeWidth={2} />
            Preview as guest
          </a>
        )}
      </div>
    </Modal>
  )
}

function RenameRoomModal({ room, onClose, onSave }) {
  const [name, setName] = useState(room.name)
  return (
    <Modal isOpen={true} onClose={onClose} title="Rename Room">
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }} className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim()}>Save</Button>
        </div>
      </form>
    </Modal>
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

function EditProjectModal({ isOpen, onClose, production, onSave, defaultAvailConfig }) {
  const config = production.availabilityConfig || production.availability_config
  const [form, setForm] = useState({
    name: production.name,
    description: production.description || '',
    startDate: production.startDate || '',
    endDate: production.endDate || '',
  })
  const [availConfig, setAvailConfig] = useState(config || defaultAvailConfig)

  // Reset local state when the modal re-opens for a different production
  useEffect(() => {
    if (!isOpen) return
    setForm({
      name: production.name,
      description: production.description || '',
      startDate: production.startDate || '',
      endDate: production.endDate || '',
    })
    setAvailConfig(production.availabilityConfig || production.availability_config || defaultAvailConfig)
  }, [isOpen, production, defaultAvailConfig])

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name) return
    onSave({ ...form, availability_config: availConfig })
  }

  const schedule = availConfig?.businessHours?.schedule || {}

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Project Settings">
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        {/* Basic */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Project Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description (optional)</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
            </div>
          </div>
        </div>

        {/* Availability settings */}
        <div className="pt-4 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">Availability</p>
            <button
              type="button"
              onClick={() => setAvailConfig(defaultAvailConfig)}
              className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
            >Reset to global</button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <select
              value={availConfig?.mode || 'blocks'}
              onChange={e => setAvailConfig(c => ({ ...c, mode: e.target.value }))}
              className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent"
            >
              <option value="blocks">Time blocks</option>
              <option value="slots">Named slots</option>
            </select>
            {availConfig?.mode === 'blocks' && (
              <select
                value={availConfig?.blockDuration || 30}
                onChange={e => setAvailConfig(c => ({ ...c, blockDuration: Number(e.target.value) }))}
                className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent"
              >
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
              </select>
            )}
          </div>

          <div className="space-y-0">
            {DAY_NAMES.map((name, i) => {
              const day = schedule[i]
              const isActive = !!day
              function updateSchedule(next) {
                setAvailConfig(c => ({
                  ...c,
                  businessHours: { schedule: { ...(c.businessHours?.schedule || {}), [i]: next } }
                }))
              }
              return (
                <div key={i} className="flex items-center h-9 gap-2.5">
                  <button
                    type="button"
                    onClick={() => updateSchedule(isActive ? null : { start: '09:00', end: '17:00' })}
                    className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${isActive ? 'bg-accent' : 'bg-surface-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className={`w-8 text-xs font-medium ${isActive ? 'text-zinc-200' : 'text-zinc-600'}`}>{name.slice(0, 3)}</span>
                  {isActive ? (
                    <>
                      <select value={day.start} onChange={e => updateSchedule({ ...day, start: e.target.value })}
                        className="text-[11px] bg-surface-700 border border-surface-600 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-accent">
                        {HOUR_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                      </select>
                      <span className="text-[10px] text-zinc-600">–</span>
                      <select value={day.end} onChange={e => updateSchedule({ ...day, end: e.target.value })}
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

          <div className="flex items-center justify-between py-3 mt-2 border-t border-surface-700">
            <div className="flex-1 pr-3">
              <p className="text-xs text-zinc-300">Guests select specific time slots</p>
              <p className="text-[10px] text-zinc-600">Off = guests pick whole days. On = guests pick individual slots.</p>
            </div>
            <button
              type="button"
              onClick={() => setAvailConfig(c => ({ ...c, guestSlotSelection: !c.guestSlotSelection }))}
              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${availConfig?.guestSlotSelection ? 'bg-accent' : 'bg-surface-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${availConfig?.guestSlotSelection ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-surface-900 -mx-6 px-6 pb-2 border-t border-white/[0.06]">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!form.name}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

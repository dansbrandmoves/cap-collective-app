import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { UpgradeModal } from '../components/ui/UpgradeModal'
import { AvailabilityCalendar } from '../components/availability/AvailabilityCalendar'

export function ProductionView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getProduction, updateProduction, updateProductionNotes, deleteProduction, createGroup, updateGroupName, deleteGroup, slots, calendarEvents, connectedCalendars, availabilityRules, prefixRules, slotStates, canAddGroup, isProPlan, FREE_GROUP_LIMIT, pendingRequestCounts } = useApp()

  const production = getProduction(id)
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [rightPanel, setRightPanel] = useState('calendar') // 'calendar' | 'group'
  const [showEditProject, setShowEditProject] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', startDate: '', endDate: '' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [deletingGroupId, setDeletingGroupId] = useState(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  // Auto-select group with pending requests on first load
  useEffect(() => {
    if (!production || activeGroupId) return
    const groupWithPending = production.groups.find(g => (pendingRequestCounts[g.id] || 0) > 0)
    if (groupWithPending) {
      setActiveGroupId(groupWithPending.id)
      setRightPanel('group')
    }
  }, [production, pendingRequestCounts]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!production) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Project not found.{' '}
        <Link to="/" className="ml-2 text-accent underline">Back to dashboard</Link>
      </div>
    )
  }

  const activeGroup = production.groups.find(g => g.id === activeGroupId) ?? null

  function openAddGroup() {
    if (!canAddGroup(id)) { setShowUpgrade(true); return }
    setShowNewGroup(true)
  }

  function handleCreateGroup(e) {
    e.preventDefault()
    if (!newGroupName.trim()) return
    const gid = createGroup(id, newGroupName.trim())
    setNewGroupName('')
    setShowNewGroup(false)
    setActiveGroupId(gid)
    setRightPanel('group')
  }

  function handleSelectGroup(groupId) {
    setActiveGroupId(groupId)
    setRightPanel('group')
    setMobileShowDetail(true)
  }

  function handleShowCalendar() {
    setRightPanel('calendar')
    setMobileShowDetail(true)
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

  async function handleEditGroupName(groupId) {
    if (!editGroupName.trim()) return
    await updateGroupName(id, groupId, editGroupName.trim())
    setEditingGroupId(null)
  }

  async function handleDeleteGroup(groupId) {
    await deleteGroup(id, groupId)
    setDeletingGroupId(null)
    if (activeGroupId === groupId) {
      setActiveGroupId(null)
      setRightPanel('calendar')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel */}
      <div className={`flex-shrink-0 bg-surface-900 border-r border-surface-700 flex-col
        w-full md:w-72
        ${mobileShowDetail ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="px-5 py-5 border-b border-surface-700">
          <button onClick={() => navigate('/')} className="text-xs text-zinc-500 hover:text-zinc-300 mb-3 flex items-center gap-1 transition-colors">
            ← Projects
          </button>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 leading-snug">{production.name}</h2>
              {(production.startDate || production.endDate) && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  {production.startDate && production.endDate
                    ? `${production.startDate} → ${production.endDate}`
                    : production.startDate || production.endDate}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={openEditProject} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors px-1.5 py-1">Edit</button>
              <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-600 hover:text-red-400 transition-colors px-1.5 py-1">Delete</button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {/* Calendar nav item */}
          <button
            onClick={handleShowCalendar}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors mb-2 ${
              rightPanel === 'calendar' && !activeGroupId ? 'bg-surface-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-800'
            }`}
          >
            <span className="text-base opacity-70">◷</span>
            <span>Availability</span>
          </button>

          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Groups</p>
            <button onClick={openAddGroup} className="text-xs text-zinc-500 hover:text-accent transition-colors">+ Add</button>
          </div>

          {production.groups.length === 0 && (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-zinc-600 mb-3">No groups yet.</p>
              <Button size="sm" variant="secondary" onClick={openAddGroup}>Add first group</Button>
            </div>
          )}

          {production.groups.map(group => {
            const isActive = rightPanel === 'group' && activeGroup?.id === group.id
            const isEditing = editingGroupId === group.id
            const isDeleting = deletingGroupId === group.id

            if (isEditing) {
              return (
                <div key={group.id} className="flex items-center gap-1 px-2 py-1 mb-0.5">
                  <input
                    type="text"
                    value={editGroupName}
                    onChange={e => setEditGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditGroupName(group.id); if (e.key === 'Escape') setEditingGroupId(null) }}
                    autoFocus
                    className="flex-1 bg-surface-700 border border-surface-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                  />
                  <button onClick={() => handleEditGroupName(group.id)} className="text-xs text-accent px-1">Save</button>
                  <button onClick={() => setEditingGroupId(null)} className="text-xs text-zinc-600 px-1">Cancel</button>
                </div>
              )
            }

            /* delete handled by modal below */

            return (
              <div
                key={group.id}
                className={`flex items-center gap-1 rounded-lg mb-0.5 group/item ${
                  isActive ? 'bg-surface-700' : 'hover:bg-surface-800'
                }`}
              >
                <button
                  onClick={() => handleSelectGroup(group.id)}
                  className={`flex-1 text-left px-3 py-2.5 text-sm transition-colors truncate ${
                    isActive ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {group.name}
                </button>
                {(pendingRequestCounts[group.id] || 0) > 0 && (
                  <span className="bg-accent text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mr-1">
                    {pendingRequestCounts[group.id]}
                  </span>
                )}
                <div className="hidden group-hover/item:flex items-center gap-0.5 pr-2">
                  <button onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name) }} className="text-xs text-zinc-600 hover:text-zinc-300 px-1 py-1 transition-colors">Edit</button>
                  <button onClick={() => setDeletingGroupId(group.id)} className="text-xs text-red-700 hover:text-red-400 px-1 py-1 transition-colors">Del</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Private notes */}
        <div className="border-t border-surface-700 bg-surface-950 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs">🔒</span>
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Private Notes</p>
          </div>
          {editingNotes ? (
            <textarea
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              onBlur={handleNotesBlur}
              autoFocus
              rows={6}
              className="w-full bg-surface-800 border border-accent/30 rounded-lg px-3 py-2 text-xs text-zinc-300 resize-none focus:outline-none focus:border-accent/60"
            />
          ) : (
            <div
              onClick={startEditingNotes}
              className="cursor-text rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors min-h-[60px] leading-relaxed"
            >
              {production.ownerNotes || <span className="text-zinc-700">Click to add private notes...</span>}
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className={`flex-1 flex-col overflow-hidden
        ${mobileShowDetail ? 'flex' : 'hidden md:flex'}
      `}>
        {rightPanel === 'calendar' ? (
          <ProjectCalendar onMobileBack={() => setMobileShowDetail(false)} />
        ) : activeGroup ? (
          <GroupOverview productionId={id} group={activeGroup} onMobileBack={() => setMobileShowDetail(false)} />
        ) : (
          <ProjectCalendar onMobileBack={() => setMobileShowDetail(false)} />
        )}
      </div>

      {/* Add Group Modal */}
      <Modal isOpen={showNewGroup} onClose={() => setShowNewGroup(false)} title="Add Group">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Group Name</label>
            <input
              type="text"
              placeholder="e.g. Brand Team, Vendors, Crew..."
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              autoFocus
            />
            <p className="text-sm text-zinc-500 mt-1.5">You choose the name. This creates a Room for this group.</p>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setShowNewGroup(false)}>Cancel</Button>
            <Button type="submit" disabled={!newGroupName.trim()}>Create Group</Button>
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

      {/* Delete Group Confirmation */}
      <Modal isOpen={!!deletingGroupId} onClose={() => setDeletingGroupId(null)} title="Delete Group">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            Are you sure you want to delete this group? This will also delete its room, notes, and date requests.
          </p>
          <p className="text-sm text-red-400">This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeletingGroupId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDeleteGroup(deletingGroupId)}>Delete Group</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Project Confirmation */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Project">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            Are you sure you want to delete <strong>{production.name}</strong>? This will also delete all groups, rooms, notes, and date requests inside it.
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
          reason={`Free plan includes ${FREE_GROUP_LIMIT} groups per project. Upgrade to Pro for unlimited groups.`}
        />
      )}
    </div>
  )
}

function ProjectCalendar({ onMobileBack }) {
  const { slots, calendarEvents, connectedCalendars, availabilityRules, prefixRules, slotStates } = useApp()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 sm:px-8 py-4 border-b border-surface-700 flex items-center gap-3">
        <button onClick={onMobileBack} className="md:hidden text-xs text-zinc-500 hover:text-zinc-300 flex-shrink-0 transition-colors">
          ← Back
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Availability</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 sm:py-6">
        <AvailabilityCalendar
          slots={slots}
          calendarEvents={calendarEvents}
          connectedCalendars={connectedCalendars}
          availabilityRules={availabilityRules}
          prefixRules={prefixRules}
          isOwner={true}
          slotStates={slotStates}
        />
      </div>
    </div>
  )
}

function GroupOverview({ productionId, group, onMobileBack }) {
  const navigate = useNavigate()
  const { updateGroupAccessMode, addGroupMember, removeGroupMember, getMembersForGroup, getRoomLink, fetchDateRequests, updateDateRequestStatus } = useApp()
  const members = getMembersForGroup(group.id)

  const [showAddMember, setShowAddMember] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [copied, setCopied] = useState(null)
  const [dateRequests, setDateRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(true)

  useEffect(() => {
    setLoadingRequests(true)
    fetchDateRequests(group.id).then(reqs => {
      setDateRequests(reqs)
      setLoadingRequests(false)
    })
  }, [group.id, fetchDateRequests])

  function copyLink(token) {
    navigator.clipboard.writeText(getRoomLink(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleAddMember(e) {
    e.preventDefault()
    if (!memberName.trim()) return
    addGroupMember(group.id, { name: memberName.trim(), email: memberEmail.trim() })
    setMemberName('')
    setMemberEmail('')
    setShowAddMember(false)
  }

  async function handleRequestAction(requestId, status) {
    const success = await updateDateRequestStatus(requestId, status)
    if (success) {
      setDateRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r))
    }
  }

  const openToken = group.openToken
  const pendingCount = dateRequests.filter(r => r.status === 'pending').length

  function formatRequestDates(dates) {
    return dates.map(ds => {
      const d = new Date(ds + 'T00:00:00')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }).join(', ')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 sm:px-8 py-4 border-b border-surface-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onMobileBack} className="md:hidden text-xs text-zinc-500 hover:text-zinc-300 flex-shrink-0 transition-colors">
            ← Back
          </button>
          <h2 className="text-lg font-semibold text-zinc-100 truncate">{group.name}</h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {pendingCount > 0 && <Badge variant="accent">{pendingCount} pending</Badge>}
          <Button size="sm" onClick={() => navigate(`/room/${openToken}`)}>Open Room →</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 sm:py-6 space-y-6 sm:space-y-8">

        {/* Access mode + link sharing */}
        <div>
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Room Access</p>
          <div className="bg-surface-900 border border-surface-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => updateGroupAccessMode(group.id, 'open_link')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  group.accessMode === 'open_link' ? 'bg-accent text-white' : 'bg-surface-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >Open Link</button>
              <button
                onClick={() => updateGroupAccessMode(group.id, 'invite_only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  group.accessMode === 'invite_only' ? 'bg-accent text-white' : 'bg-surface-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >Invite Only</button>
            </div>

            {group.accessMode === 'open_link' && openToken && (
              <div>
                <p className="text-sm text-zinc-500 mb-3">Anyone with this link can enter. They'll be asked for their name on first visit.</p>
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

            {group.accessMode === 'invite_only' && (
              <div>
                <p className="text-sm text-zinc-500 mb-3">Each person gets their own unique link. Add people below.</p>
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
                          onClick={() => removeGroupMember(m.id)}
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
          </div>
        </div>

        {/* Date Requests */}
        <div>
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Date Requests</p>
          {loadingRequests ? (
            <p className="text-sm text-zinc-600">Loading...</p>
          ) : dateRequests.length === 0 ? (
            <p className="text-sm text-zinc-600">No date requests yet.</p>
          ) : (
            <div className="space-y-3">
              {dateRequests.map(req => (
                <div key={req.id} className="bg-surface-900 border border-surface-700 rounded-xl px-5 sm:px-6 py-4 sm:py-5 shadow-sm shadow-black/10">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{req.requester_name}</p>
                      {req.requester_email && <p className="text-xs text-zinc-500">{req.requester_email}</p>}
                    </div>
                    <Badge variant={req.status === 'pending' ? 'yellow' : req.status === 'approved' ? 'green' : 'red'}>
                      {req.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 mb-1">
                    <span className="text-zinc-500">Dates:</span> {formatRequestDates(req.dates)}
                  </p>
                  {req.message && (
                    <p className="text-xs text-zinc-500 italic mt-1">"{req.message}"</p>
                  )}
                  {req.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => handleRequestAction(req.id, 'approved')}>Approve</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleRequestAction(req.id, 'declined')}>Decline</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes preview */}
        <div>
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Shared Notes (preview)</p>
          <div className="bg-surface-800 rounded-xl px-5 py-4 text-xs text-zinc-400 font-mono whitespace-pre-wrap line-clamp-6 leading-relaxed">
            {group.room.sharedNotes}
          </div>
          <button onClick={() => navigate(`/room/${openToken}`)} className="text-xs text-accent hover:underline mt-2">
            Open full room →
          </button>
        </div>
      </div>
    </div>
  )
}

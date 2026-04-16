import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'

export function ProductionView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getProduction, updateProductionNotes, createGroup } = useApp()

  const production = getProduction(id)
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')

  if (!production) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Project not found.{' '}
        <Link to="/" className="ml-2 text-accent underline">Back to dashboard</Link>
      </div>
    )
  }

  const activeGroup = production.groups.find(g => g.id === activeGroupId) ?? production.groups[0]

  function handleCreateGroup(e) {
    e.preventDefault()
    if (!newGroupName.trim()) return
    const gid = createGroup(id, newGroupName.trim())
    setNewGroupName('')
    setShowNewGroup(false)
    setActiveGroupId(gid)
  }

  function handleNotesBlur() {
    updateProductionNotes(id, notesValue)
    setEditingNotes(false)
  }

  function startEditingNotes() {
    setNotesValue(production.ownerNotes)
    setEditingNotes(true)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel */}
      <div className={`flex-shrink-0 bg-surface-900 border-r border-surface-700 flex-col
        w-full md:w-72
        ${mobileShowDetail ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="px-5 py-4 border-b border-surface-700">
          <button onClick={() => navigate('/')} className="text-xs text-zinc-500 hover:text-zinc-300 mb-3 flex items-center gap-1 transition-colors">
            ← Dashboard
          </button>
          <h2 className="text-sm font-semibold text-zinc-100 leading-snug">{production.name}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{production.startDate} → {production.endDate}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Groups</p>
            <button onClick={() => setShowNewGroup(true)} className="text-xs text-zinc-500 hover:text-accent transition-colors">+ Add</button>
          </div>

          {production.groups.length === 0 && (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-zinc-600 mb-3">No groups yet.</p>
              <Button size="sm" variant="secondary" onClick={() => setShowNewGroup(true)}>Add first group</Button>
            </div>
          )}

          {production.groups.map(group => {
            const isActive = activeGroup?.id === group.id
            return (
              <button
                key={group.id}
                onClick={() => { setActiveGroupId(group.id); setMobileShowDetail(true) }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors mb-0.5 ${
                  isActive ? 'bg-surface-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-800'
                }`}
              >
                <span className="truncate">{group.name}</span>
              </button>
            )
          })}
        </div>

        {/* Private notes */}
        <div className="border-t border-surface-700 bg-surface-950 px-4 py-4">
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
        {activeGroup ? (
          <GroupOverview productionId={id} group={activeGroup} onMobileBack={() => setMobileShowDetail(false)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
            Select a group to view its room
          </div>
        )}
      </div>

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
      <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-surface-700 flex items-center justify-between gap-3">
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

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">

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
                <div key={req.id} className="bg-surface-900 border border-surface-700 rounded-xl px-5 py-4">
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

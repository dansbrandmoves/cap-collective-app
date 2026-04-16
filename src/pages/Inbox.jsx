import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { supabase } from '../utils/supabase'

export function Inbox() {
  const { productions, updateDateRequestStatus } = useApp()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'pending' | 'all'

  // Fetch all date requests for all groups the user owns
  useEffect(() => {
    const allGroupIds = productions.flatMap(p => p.groups.map(g => g.id))
    if (!allGroupIds.length) { setLoading(false); return }

    const query = supabase
      .from('date_requests')
      .select('*')
      .in('group_id', allGroupIds)
      .order('created_at', { ascending: false })

    if (filter === 'pending') {
      query.eq('status', 'pending')
    }

    query.then(({ data, error }) => {
      if (error) console.error('Inbox fetch:', error)
      setRequests(data || [])
      setLoading(false)
    })
  }, [productions, filter])

  // Build lookup maps for group → production
  const groupToProduction = {}
  const groupNames = {}
  productions.forEach(p => {
    p.groups.forEach(g => {
      groupToProduction[g.id] = p
      groupNames[g.id] = g.name
    })
  })

  async function handleAction(requestId, status) {
    const success = await updateDateRequestStatus(requestId, status)
    if (success) {
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r))
    }
  }

  function formatDates(dates) {
    const arr = Array.isArray(dates) ? dates : []
    return arr.map(ds => {
      const d = new Date(ds + 'T00:00:00')
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    }).join(', ')
  }

  function timeAgo(iso) {
    const diff = Math.round((Date.now() - new Date(iso)) / 60000)
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.round(diff / 60)}h ago`
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="flex items-end justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Inbox</h1>
        <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-0.5">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'pending' ? 'bg-surface-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >Pending</button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-surface-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >All</button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-600">Loading...</p>
      ) : requests.length === 0 ? (
        <div className="border border-dashed border-surface-600 rounded-xl p-12 text-center">
          <p className="text-zinc-500 mb-2">{filter === 'pending' ? 'No pending requests.' : 'No requests yet.'}</p>
          <p className="text-sm text-zinc-600">Date requests from guests will show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const prod = groupToProduction[req.group_id]
            const groupName = groupNames[req.group_id]
            return (
              <div key={req.id} className="bg-surface-900 border border-surface-700 rounded-xl px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-zinc-100">{req.requester_name}</p>
                      <span className="text-xs text-zinc-600">{timeAgo(req.created_at)}</span>
                    </div>
                    {prod && (
                      <button
                        onClick={() => navigate(`/production/${prod.id}`)}
                        className="text-xs text-zinc-500 hover:text-accent transition-colors"
                      >
                        {prod.name} → {groupName}
                      </button>
                    )}
                  </div>
                  <Badge variant={req.status === 'pending' ? 'yellow' : req.status === 'approved' ? 'green' : 'red'}>
                    {req.status}
                  </Badge>
                </div>

                <p className="text-sm text-zinc-300 mb-1">
                  {formatDates(req.dates)}
                </p>

                {req.message && (
                  <p className="text-sm text-zinc-500 italic mb-2">"{req.message}"</p>
                )}

                {req.requester_email && (
                  <p className="text-xs text-zinc-600 mb-2">{req.requester_email}</p>
                )}

                {req.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => handleAction(req.id, 'approved')}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleAction(req.id, 'declined')}>Decline</Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

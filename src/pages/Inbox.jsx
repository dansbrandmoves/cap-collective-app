import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { supabase } from '../utils/supabase'
import { Inbox as InboxIcon, CalendarDays, Mail } from 'lucide-react'

export function Inbox() {
  const { productions, updateDateRequestStatus } = useApp()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    const allGroupIds = productions.flatMap(p => p.groups.map(g => g.id))
    if (!allGroupIds.length) { setLoading(false); return }

    const query = supabase
      .from('date_requests')
      .select('*')
      .in('group_id', allGroupIds)
      .order('created_at', { ascending: false })

    if (filter === 'pending') query.eq('status', 'pending')

    query.then(({ data, error }) => {
      if (error) console.error('Inbox fetch:', error)
      setRequests(data || [])
      setLoading(false)
    })
  }, [productions, filter])

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
    })
  }

  function timeAgo(iso) {
    const diff = Math.round((Date.now() - new Date(iso)) / 60000)
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.round(diff / 60)}h ago`
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="px-5 sm:px-8 lg:px-16 py-6 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-zinc-100">Inbox</h1>
          <p className="text-sm text-zinc-500 mt-1">Date requests from your guests.</p>
        </div>
        <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-0.5">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              filter === 'pending' ? 'bg-surface-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >Pending</button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              filter === 'all' ? 'bg-surface-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >All</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="border border-dashed border-surface-600 rounded-2xl p-12 sm:p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center mx-auto mb-5">
            <InboxIcon size={20} strokeWidth={1.5} className="text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-300 mb-1">
            {filter === 'pending' ? 'No pending requests' : 'No requests yet'}
          </p>
          <p className="text-sm text-zinc-600">Date requests from guests will show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const prod = groupToProduction[req.group_id]
            const groupName = groupNames[req.group_id]
            const dates = formatDates(req.dates)
            const isPending = req.status === 'pending'

            return (
              <div key={req.id} className={`bg-surface-900 border rounded-xl px-5 sm:px-6 py-4 sm:py-5 shadow-sm shadow-black/10 transition-all duration-150 ${
                isPending ? 'border-surface-700 hover:border-surface-500 hover:shadow-lg hover:shadow-black/20' : 'border-surface-800'
              }`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
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

                {/* Dates */}
                <div className="flex items-start gap-2 mb-2">
                  <CalendarDays size={13} className="text-zinc-600 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap gap-1.5">
                    {dates.map((d, i) => (
                      <span key={i} className="text-xs bg-surface-800 border border-surface-700 text-zinc-300 px-2 py-0.5 rounded-md">{d}</span>
                    ))}
                  </div>
                </div>

                {req.message && (
                  <p className="text-sm text-zinc-500 italic mb-2 pl-5">"{req.message}"</p>
                )}

                {req.requester_email && (
                  <div className="flex items-center gap-1.5 pl-5 mb-2">
                    <Mail size={11} className="text-zinc-600" />
                    <p className="text-xs text-zinc-600">{req.requester_email}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-3 pt-3 border-t border-surface-800">
                  {req.status !== 'approved' && (
                    <Button size="sm" onClick={() => handleAction(req.id, 'approved')}>Approve</Button>
                  )}
                  {req.status !== 'pending' && (
                    <Button size="sm" variant="secondary" onClick={() => handleAction(req.id, 'pending')}>Reopen</Button>
                  )}
                  {req.status !== 'declined' && (
                    <Button size="sm" variant="ghost" onClick={() => handleAction(req.id, 'declined')}>Decline</Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

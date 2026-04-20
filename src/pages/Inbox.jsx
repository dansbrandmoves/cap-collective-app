import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { supabase } from '../utils/supabase'
import { Inbox as InboxIcon, CalendarDays, Mail, Archive, ArrowUpRight } from 'lucide-react'
import { PageLoader } from '../components/ui/PageLoader'

export function Inbox() {
  const { productions, updateDateRequestStatus } = useApp()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  useEffect(() => {
    const allRoomIds = productions.flatMap(p => p.rooms.map(r => r.id))
    if (!allRoomIds.length) { setLoading(false); return }

    const query = supabase
      .from('date_requests')
      .select('*')
      .in('room_id', allRoomIds)
      .order('created_at', { ascending: false })

    if (filter === 'active') query.neq('status', 'archived')

    query.then(({ data, error }) => {
      if (error) console.error('Inbox fetch:', error)
      setRequests(data || [])
      setLoading(false)
    })
  }, [productions, filter])

  const roomToProduction = {}
  const roomNames = {}
  const roomTokens = {}
  productions.forEach(p => {
    p.rooms.forEach(r => {
      roomToProduction[r.id] = p
      roomNames[r.id] = r.name
      roomTokens[r.id] = r.openToken
    })
  })

  async function handleArchive(requestId) {
    const success = await updateDateRequestStatus(requestId, 'archived')
    if (success) {
      // If we're on the 'active' filter, remove it from view; otherwise flip the status.
      if (filter === 'active') {
        setRequests(prev => prev.filter(r => r.id !== requestId))
      } else {
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'archived' } : r))
      }
    }
  }

  function handleOpenRoom(req) {
    const token = roomTokens[req.room_id]
    const prod = roomToProduction[req.room_id]
    if (token) navigate(`/room/${token}`)
    else if (prod) navigate(`/project/${prod.id}`)
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

  return (
    <div className="px-5 sm:px-8 lg:px-14 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10 sm:mb-12">
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15]">Inbox</h1>
          <p className="text-[15px] text-zinc-400 mt-2 leading-relaxed">Guests who&rsquo;ve shared availability with you.</p>
        </div>
        <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.04] rounded-xl p-1 self-start">
          <button
            onClick={() => setFilter('active')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ease-ios ${
              filter === 'active' ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >Active</button>
          <button
            onClick={() => setFilter('all')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ease-ios ${
              filter === 'all' ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >All</button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : requests.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl p-12 sm:p-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center mx-auto mb-5">
            <InboxIcon size={20} strokeWidth={1.5} className="text-zinc-500" />
          </div>
          <p className="text-[15px] font-medium text-zinc-200 mb-1">
            {filter === 'active' ? 'All caught up' : 'Nothing shared yet'}
          </p>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
            When a guest shares dates that work for them, you&rsquo;ll see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const prod = roomToProduction[req.room_id]
            const roomName = roomNames[req.room_id]
            const dates = formatDates(req.dates)
            const isArchived = req.status === 'archived'

            return (
              <div key={req.id} className={`bg-surface-900 border rounded-2xl px-5 sm:px-6 py-5 transition-all duration-200 ease-ios ${
                isArchived ? 'border-white/[0.04] opacity-60' : 'border-white/[0.06] hover:border-white/10 hover:shadow-lift'
              }`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[15px] font-semibold text-zinc-100 tracking-tight">{req.requester_name}</p>
                      <span className="text-[11px] text-zinc-600">{timeAgo(req.created_at)}</span>
                    </div>
                    {prod && (
                      <button
                        onClick={() => navigate(`/project/${prod.id}`)}
                        className="text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors"
                      >
                        {prod.name} &middot; {roomName}
                      </button>
                    )}
                  </div>
                  {isArchived && (
                    <span className="flex-shrink-0 text-[10px] font-medium text-zinc-500 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/5">
                      Archived
                    </span>
                  )}
                </div>

                {/* Shared dates as pills */}
                <div className="flex items-start gap-2 mb-3">
                  <CalendarDays size={13} strokeWidth={1.75} className="text-zinc-500 mt-1 flex-shrink-0" />
                  <div className="flex flex-wrap gap-1.5">
                    {dates.map((d, i) => (
                      <span key={i} className="text-[12px] font-medium bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-full">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                {req.message && (
                  <p className="text-[14px] text-zinc-400 italic mb-3 pl-5 leading-relaxed">&ldquo;{req.message}&rdquo;</p>
                )}

                {req.requester_email && (
                  <div className="flex items-center gap-1.5 pl-5 mb-3">
                    <Mail size={11} strokeWidth={1.75} className="text-zinc-600" />
                    <a href={`mailto:${req.requester_email}`} className="text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors">{req.requester_email}</a>
                  </div>
                )}

                {!isArchived && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/[0.05]">
                    <Button size="sm" onClick={() => handleOpenRoom(req)}>
                      Open room
                      <ArrowUpRight size={13} strokeWidth={1.75} className="ml-1" />
                    </Button>
                    <button
                      onClick={() => handleArchive(req.id)}
                      className="min-h-[36px] flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-200 hover:bg-white/5 px-3 rounded-lg transition-colors"
                      title="Archive"
                    >
                      <Archive size={13} strokeWidth={1.75} />
                      Archive
                    </button>
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

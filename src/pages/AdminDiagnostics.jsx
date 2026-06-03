import { useState, useEffect, useMemo, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../utils/supabase'
import { RefreshCw, ChevronRight, Activity, AlertCircle, CheckCircle2, MinusCircle, Info } from 'lucide-react'
import { AvailabilityInspector } from '../components/diagnostics/AvailabilityInspector'

// n8n-style executions view over the `diagnostics` table. Each row is one
// execution record; click to expand into full step-by-step detail + payload.

const STATUS_META = {
  ok:    { label: 'Success', cls: 'text-green-400 bg-green-500/10 border-green-500/20', Icon: CheckCircle2 },
  error: { label: 'Error',   cls: 'text-red-400 bg-red-500/10 border-red-500/20',       Icon: AlertCircle },
  skip:  { label: 'Skipped', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', Icon: MinusCircle },
  info:  { label: 'Info',    cls: 'text-zinc-400 bg-white/[0.04] border-white/[0.08]',   Icon: Info },
}

function statusOf(row) {
  return row?.detail?.status || 'info'
}

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.info
  const { Icon } = meta
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.cls}`}>
      <Icon size={11} strokeWidth={2} /> {meta.label}
    </span>
  )
}

function Row({ row }) {
  const [open, setOpen] = useState(false)
  const status = statusOf(row)
  const d = row.detail || {}
  const steps = Array.isArray(d.steps) ? d.steps : []
  const extra = Object.fromEntries(
    Object.entries(d).filter(([k]) => !['actor', 'status', 'projectId', 'roomId', 'summary', 'steps', 'error', 'durationMs'].includes(k))
  )

  return (
    <div className="border-b border-white/[0.05]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronRight size={14} strokeWidth={2} className={`text-zinc-600 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <StatusBadge status={status} />
        <span className="text-[13px] font-medium text-zinc-100 font-mono flex-shrink-0">{row.event}</span>
        <span className="text-[12px] text-zinc-500 truncate flex-1 min-w-0">{d.summary || d.error || ''}</span>
        {d.actor && d.actor !== 'system' && (
          <span className="text-[11px] text-zinc-500 hidden sm:inline flex-shrink-0">{d.actor}</span>
        )}
        <span className="text-[11px] text-zinc-600 flex-shrink-0 tabular-nums">{fmtTime(row.created_at)}</span>
      </button>

      {open && (
        <div className="px-4 sm:px-12 pb-4 space-y-3">
          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
            {d.actor && <Meta label="Actor" value={d.actor} />}
            {d.projectId && <Meta label="Project" value={d.projectId} mono />}
            {d.roomId && <Meta label="Room" value={d.roomId} mono />}
            {typeof d.durationMs === 'number' && <Meta label="Duration" value={`${d.durationMs} ms`} />}
          </div>

          {d.error && (
            <div className="text-[12px] text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-3 py-2 font-mono break-words">
              {d.error}
            </div>
          )}

          {/* Steps */}
          {steps.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Steps</p>
              {steps.map((s, i) => {
                const sm = STATUS_META[s.status] || STATUS_META.info
                const { Icon } = sm
                const sExtra = Object.fromEntries(Object.entries(s).filter(([k]) => !['label', 'status'].includes(k)))
                return (
                  <div key={i} className="flex items-start gap-2 text-[12px]">
                    <Icon size={13} strokeWidth={2} className={`mt-0.5 flex-shrink-0 ${sm.cls.split(' ')[0]}`} />
                    <span className="text-zinc-300">{s.label}</span>
                    {Object.keys(sExtra).length > 0 && (
                      <span className="text-zinc-600 font-mono">{JSON.stringify(sExtra)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Raw payload */}
          {Object.keys(extra).length > 0 && (
            <details className="text-[12px]">
              <summary className="text-zinc-500 cursor-pointer hover:text-zinc-300">Raw payload</summary>
              <pre className="mt-2 bg-surface-950 border border-white/[0.06] rounded-lg p-3 overflow-x-auto text-[11px] text-zinc-400">
                {JSON.stringify(extra, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function Meta({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-600">{label}</p>
      <p className={`text-zinc-300 truncate ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</p>
    </div>
  )
}

export function AdminDiagnostics({ embedded = false }) {
  const { isAdmin } = useApp()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [flowFilter, setFlowFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('log') // 'log' | 'availability'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('diagnostics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Live: append new diagnostics as they arrive (best-effort; ignored if the
  // table isn't in the realtime publication).
  useEffect(() => {
    const ch = supabase
      .channel('admin-diagnostics')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diagnostics' }, payload => {
        setRows(prev => [payload.new, ...prev].slice(0, 300))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const flows = useMemo(() => ['all', ...new Set(rows.map(r => r.event))], [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (flowFilter !== 'all' && r.event !== flowFilter) return false
      if (statusFilter !== 'all' && statusOf(r) !== statusFilter) return false
      if (q) {
        const hay = JSON.stringify(r).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, flowFilter, statusFilter, search])

  if (!embedded && !isAdmin) return <Navigate to="/" replace />

  const body = (
    <>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2.5">
            {!embedded && <Activity size={20} strokeWidth={1.75} className="text-accent" />}
            <h1 className="text-[20px] font-semibold text-zinc-50 tracking-tight">{embedded ? 'Execution log' : 'Diagnostics'}</h1>
          </div>
          {mode === 'log' && (
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-400 hover:text-zinc-100 border border-white/[0.08] hover:bg-white/[0.04] rounded-lg px-3 py-2 transition-colors"
            >
              <RefreshCw size={14} strokeWidth={2} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 mt-2">
          {[['log', 'Execution log'], ['availability', 'Availability inspector']].map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`text-[13px] font-medium px-3 py-1.5 rounded-lg transition-colors ${mode === k ? 'bg-accent/15 text-accent' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'}`}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'availability' ? <AvailabilityInspector /> : LogView()}
      </>
  )

  if (embedded) return body

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        {body}
      </div>
    </div>
  )

  function LogView() {
    return (
      <>
        <p className="text-[13px] text-zinc-500 mb-6">Execution log across guests, owners, and background jobs. Newest first.</p>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search payload…"
            className="bg-surface-800 border border-white/[0.08] rounded-lg px-3 py-1.5 text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 w-full sm:w-56"
          />
          <select value={flowFilter} onChange={e => setFlowFilter(e.target.value)}
            className="bg-surface-800 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-300 focus:outline-none focus:border-accent/60">
            {flows.map(f => <option key={f} value={f}>{f === 'all' ? 'All flows' : f}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-surface-800 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-300 focus:outline-none focus:border-accent/60">
            <option value="all">All statuses</option>
            <option value="ok">Success</option>
            <option value="error">Error</option>
            <option value="skip">Skipped</option>
            <option value="info">Info</option>
          </select>
          <span className="text-[12px] text-zinc-600 ml-auto">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* List */}
        <div className="bg-surface-900 border border-white/[0.06] rounded-xl overflow-hidden">
          {loading && rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-zinc-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[14px] text-zinc-300 mb-1">No execution records</p>
              <p className="text-[12px] text-zinc-600">As guests connect calendars, tap days, or jobs run, they’ll appear here.</p>
            </div>
          ) : (
            filtered.map(r => <Row key={r.id} row={r} />)
          )}
        </div>
      </>
    )
  }
}

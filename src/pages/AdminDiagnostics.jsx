import { useState, useEffect, useMemo, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../utils/supabase'
import { RefreshCw, ChevronRight, Activity, AlertCircle, CheckCircle2, MinusCircle, Info, Copy, Check } from 'lucide-react'
import { AvailabilityInspector } from '../components/diagnostics/AvailabilityInspector'
import { Modal } from '../components/ui/Modal'

const PAGE_SIZE = 50

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

// One execution = one clickable summary row → opens the tri-panel modal.
function Row({ row, onOpen }) {
  const status = statusOf(row)
  const d = row.detail || {}
  return (
    <button
      onClick={() => onOpen(row)}
      className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors"
    >
      <StatusBadge status={status} />
      <span className="text-[13px] font-medium text-zinc-100 font-mono flex-shrink-0">{row.event}</span>
      <span className="text-[12px] text-zinc-500 truncate flex-1 min-w-0">{d.summary || d.error || ''}</span>
      {d.actor && d.actor !== 'system' && (
        <span className="text-[11px] text-zinc-500 hidden sm:inline flex-shrink-0">{d.actor}</span>
      )}
      <span className="text-[11px] text-zinc-600 flex-shrink-0 tabular-nums">{fmtTime(row.created_at)}</span>
      <ChevronRight size={14} strokeWidth={2} className="text-zinc-600 flex-shrink-0" />
    </button>
  )
}

// Copy-to-clipboard button with transient "Copied" feedback.
function CopyButton({ getText, label = 'Copy', className = '' }) {
  const [done, setDone] = useState(false)
  async function copy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(getText())
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch { /* clipboard blocked; ignore */ }
  }
  return (
    <button onClick={copy}
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1.5 border transition-colors ${done ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-zinc-400 border-white/[0.08] hover:text-zinc-100 hover:bg-white/[0.04]'} ${className}`}>
      {done ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={2} />}
      {done ? 'Copied' : label}
    </button>
  )
}

function Panel({ title, accent, copyText, children }) {
  return (
    <div className="flex flex-col min-w-0 bg-surface-950 border border-white/[0.07] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.06]">
        <span className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${accent}`}>{title}</span>
        {copyText && <CopyButton getText={copyText} label="Copy" />}
      </div>
      <div className="p-3 overflow-auto flex-1 text-[12px]">{children}</div>
    </div>
  )
}

function KV({ data }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!entries.length) return <p className="text-zinc-600">—</p>
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-600">{k}</p>
          <p className="text-zinc-300 font-mono text-[11px] break-words whitespace-pre-wrap">
            {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
          </p>
        </div>
      ))}
    </div>
  )
}

// n8n-style execution detail: Input → Action → Output, each independently
// copyable, plus a single "Copy all" that grabs the whole record for pasting.
function ExecutionModal({ row, onClose }) {
  if (!row) return null
  const d = row.detail || {}
  const status = statusOf(row)
  const steps = Array.isArray(d.steps) ? d.steps : []

  // INPUT = what triggered it (identity/context). ACTION = what it did
  // (event + summary + steps). OUTPUT = the result (status, error, payload).
  const input = { actor: d.actor, projectId: d.projectId, roomId: d.roomId }
  const KNOWN = ['actor', 'status', 'projectId', 'roomId', 'summary', 'steps', 'error', 'durationMs']
  const output = {
    status,
    ...(typeof d.durationMs === 'number' ? { durationMs: d.durationMs } : {}),
    ...(d.error ? { error: d.error } : {}),
    ...Object.fromEntries(Object.entries(d).filter(([k]) => !KNOWN.includes(k))),
  }
  const fullRecord = { event: row.event, created_at: row.created_at, ...row.detail ? { detail: row.detail } : {} }
  const fullJson = () => JSON.stringify(fullRecord, null, 2)

  return (
    <Modal isOpen={!!row} onClose={onClose} size="2xl" title={
      <span className="flex items-center gap-2.5">
        <StatusBadge status={status} />
        <span className="font-mono text-[14px]">{row.event}</span>
        <span className="text-[11px] text-zinc-600 tabular-nums font-normal">{fmtTime(row.created_at)}</span>
      </span>
    }>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12px] text-zinc-500">{d.summary || d.error || 'Execution detail'}</p>
        <CopyButton getText={fullJson} label="Copy all (JSON)" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:[&>*]:max-h-[55vh]">
        <Panel title="Input" accent="text-sky-300" copyText={() => JSON.stringify(input, null, 2)}>
          <KV data={input} />
        </Panel>

        <div className="relative">
          <Panel title="Action" accent="text-accent" copyText={() => JSON.stringify({ event: row.event, summary: d.summary, steps }, null, 2)}>
            {d.summary && <p className="text-zinc-300 mb-2">{d.summary}</p>}
            {steps.length > 0 ? (
              <div className="space-y-1.5">
                {steps.map((s, i) => {
                  const sm = STATUS_META[s.status] || STATUS_META.info
                  const { Icon } = sm
                  const sExtra = Object.fromEntries(Object.entries(s).filter(([k]) => !['label', 'status'].includes(k)))
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <Icon size={13} strokeWidth={2} className={`mt-0.5 flex-shrink-0 ${sm.cls.split(' ')[0]}`} />
                      <div className="min-w-0">
                        <span className="text-zinc-300">{s.label}</span>
                        {Object.keys(sExtra).length > 0 && (
                          <span className="block text-zinc-600 font-mono text-[11px] break-words">{JSON.stringify(sExtra)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-zinc-600">No steps recorded.</p>}
          </Panel>
        </div>

        <Panel title="Output" accent={d.error ? 'text-red-400' : 'text-green-400'} copyText={() => JSON.stringify(output, null, 2)}>
          {d.error && (
            <div className="text-[12px] text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-2.5 py-2 font-mono break-words mb-2">
              {d.error}
            </div>
          )}
          <KV data={output} />
        </Panel>
      </div>
    </Modal>
  )
}

export function AdminDiagnostics({ embedded = false }) {
  const { isAdmin } = useApp()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [flowFilter, setFlowFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('log') // 'log' | 'availability'
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null) // row open in the tri-panel modal

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
  const actors = useMemo(() => ['all', ...new Set(rows.map(r => r.detail?.actor).filter(Boolean))], [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (flowFilter !== 'all' && r.event !== flowFilter) return false
      if (statusFilter !== 'all' && statusOf(r) !== statusFilter) return false
      if (actorFilter !== 'all' && (r.detail?.actor || '') !== actorFilter) return false
      if (q) {
        const hay = JSON.stringify(r).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, flowFilter, statusFilter, actorFilter, search])

  // Pagination. Any filter change snaps back to page 1.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  useEffect(() => { setPage(0) }, [flowFilter, statusFilter, actorFilter, search])

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
          <select value={actorFilter} onChange={e => setActorFilter(e.target.value)}
            className="bg-surface-800 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-300 focus:outline-none focus:border-accent/60 max-w-[160px]">
            {actors.map(a => <option key={a} value={a}>{a === 'all' ? 'All users' : a}</option>)}
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
            paged.map(r => <Row key={r.id} row={r} onOpen={setSelected} />)
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 mt-3">
            <span className="text-[12px] text-zinc-600">
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                className="text-[13px] font-medium text-zinc-400 hover:text-zinc-100 border border-white/[0.08] hover:bg-white/[0.04] rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                Prev
              </button>
              <span className="text-[12px] text-zinc-500 tabular-nums px-1">{safePage + 1} / {pageCount}</span>
              <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
                className="text-[13px] font-medium text-zinc-400 hover:text-zinc-100 border border-white/[0.08] hover:bg-white/[0.04] rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                Next
              </button>
            </div>
          </div>
        )}

        <ExecutionModal row={selected} onClose={() => setSelected(null)} />
      </>
    )
  }
}

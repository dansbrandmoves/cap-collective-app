import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../utils/supabase'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/PageLoader'
import { Shield, Search } from 'lucide-react'

export function AdminDashboard() {
  const { user, authLoading, isAdmin } = useApp()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [busyIds, setBusyIds] = useState(new Set())

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) {
      console.error('admin_list_users:', error)
      setError(error.message)
      setLoading(false)
      return
    }
    setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) loadUsers()
  }, [isAdmin, loadUsers])

  async function updateUser(id, updates) {
    setBusyIds(prev => new Set(prev).add(id))
    // Optimistic
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u))
    const { error } = await supabase.rpc('admin_update_user', {
      target_id: id,
      new_plan: updates.plan ?? null,
      new_role: updates.role ?? null,
    })
    setBusyIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (error) {
      console.error('admin_update_user:', error)
      setError(error.message)
      loadUsers() // rollback
    }
  }

  if (authLoading) return <PageLoader />
  if (!user) return <Navigate to="/signin" replace />
  if (!isAdmin) return <Navigate to="/" replace />

  const filtered = query
    ? users.filter(u => u.email?.toLowerCase().includes(query.toLowerCase()))
    : users

  const stats = {
    total: users.length,
    pro: users.filter(u => u.plan === 'pro').length,
    admin: users.filter(u => u.role === 'admin').length,
  }

  return (
    <div className="px-5 sm:px-8 lg:px-14 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <Shield size={20} strokeWidth={1.75} className="text-accent" />
            <h1 className="text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15]">Admin</h1>
          </div>
          <p className="text-[15px] text-zinc-400 leading-relaxed">Manage users, plans, and roles.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard label="Users" value={stats.total} />
        <StatCard label="Pro" value={stats.pro} accent />
        <StatCard label="Admins" value={stats.admin} />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by email..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-surface-900 border border-white/[0.06] rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/50"
        />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center">
          <p className="text-sm text-zinc-500">{query ? 'No users match that search.' : 'No users yet.'}</p>
        </div>
      ) : (
        <div className="bg-surface-900 border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-[1fr_110px_130px_130px] gap-4 px-5 py-3 border-b border-white/[0.06] bg-surface-950/60">
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">User</div>
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">Joined</div>
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">Plan</div>
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">Role</div>
          </div>

          {filtered.map(u => {
            const busy = busyIds.has(u.id)
            const joined = u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
            return (
              <div
                key={u.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_110px_130px_130px] gap-2 md:gap-4 px-5 py-4 border-b border-white/[0.04] last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100 truncate">{u.email}</p>
                  <p className="text-[11px] text-zinc-600 truncate md:hidden mt-0.5">Joined {joined}</p>
                </div>

                <div className="hidden md:block text-xs text-zinc-500 self-center">{joined}</div>

                <div className="self-center">
                  <PlanPill
                    plan={u.plan}
                    disabled={busy}
                    onChange={(newPlan) => updateUser(u.id, { plan: newPlan })}
                  />
                </div>

                <div className="self-center">
                  <RolePill
                    role={u.role}
                    disabled={busy || u.id === user.id}
                    onChange={(newRole) => updateUser(u.id, { role: newRole })}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-surface-900 border border-white/[0.06] rounded-xl px-4 py-3">
      <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight ${accent ? 'text-accent' : 'text-zinc-100'}`}>{value}</p>
    </div>
  )
}

function PlanPill({ plan, disabled, onChange }) {
  return (
    <div className="inline-flex items-center gap-0 bg-surface-800 rounded-lg p-0.5 border border-white/[0.04]">
      {['free', 'pro'].map(p => (
        <button
          key={p}
          disabled={disabled || plan === p}
          onClick={() => onChange(p)}
          className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ${
            plan === p
              ? p === 'pro'
                ? 'bg-accent text-white'
                : 'bg-surface-600 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-200 disabled:opacity-50'
          }`}
        >
          {p === 'pro' ? 'Pro' : 'Free'}
        </button>
      ))}
    </div>
  )
}

function RolePill({ role, disabled, onChange }) {
  return (
    <div className="inline-flex items-center gap-0 bg-surface-800 rounded-lg p-0.5 border border-white/[0.04]">
      {['user', 'admin'].map(r => (
        <button
          key={r}
          disabled={disabled || role === r}
          onClick={() => onChange(r)}
          title={disabled && role === 'admin' ? "You can't demote yourself" : undefined}
          className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ${
            role === r
              ? r === 'admin'
                ? 'bg-amber-500 text-white'
                : 'bg-surface-600 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-200 disabled:opacity-50'
          }`}
        >
          {r === 'admin' ? 'Admin' : 'User'}
        </button>
      ))}
    </div>
  )
}

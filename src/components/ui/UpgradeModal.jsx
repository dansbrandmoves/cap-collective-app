import { X, Zap, Check } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { supabase } from '../../utils/supabase'
import { useState } from 'react'

export function UpgradeModal({ onClose, reason }) {
  const { FREE_PROJECT_LIMIT, FREE_ROOM_LIMIT } = useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleUpgrade() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          successUrl: `${window.location.origin}/billing?upgraded=1`,
          cancelUrl: `${window.location.origin}/billing`,
        },
      })
      if (fnErr || data?.error) throw new Error(fnErr?.message || data?.error || 'Failed to start checkout')
      if (data?.url) window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center">
              <Zap size={15} strokeWidth={2} className="text-accent" />
            </div>
            <span className="font-semibold text-zinc-100">Upgrade to Pro</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Reason */}
        {reason && (
          <div className="mx-6 mb-4 px-4 py-3 bg-surface-800 border border-surface-600 rounded-xl">
            <p className="text-sm text-zinc-300">{reason}</p>
          </div>
        )}

        {/* Plan comparison */}
        <div className="px-6 pb-4 grid grid-cols-2 gap-3">
          {/* Free */}
          <div className="bg-surface-800 rounded-xl p-4 border border-surface-600">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">Free</p>
            <p className="text-2xl font-bold text-zinc-300 mb-3">$0</p>
            <ul className="space-y-1.5 text-xs text-zinc-500">
              <li className="flex items-center gap-1.5">
                <Check size={12} strokeWidth={2.5} className="flex-shrink-0 text-zinc-600" />
                {FREE_PROJECT_LIMIT} project
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={12} strokeWidth={2.5} className="flex-shrink-0 text-zinc-600" />
                {FREE_ROOM_LIMIT} rooms per project
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={12} strokeWidth={2.5} className="flex-shrink-0 text-zinc-600" />
                All core features
              </li>
            </ul>
          </div>

          {/* Pro */}
          <div className="bg-accent/8 rounded-xl p-4 border border-accent/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
              PRO
            </div>
            <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Pro</p>
            <p className="text-2xl font-bold text-zinc-100 mb-3">$10<span className="text-sm font-normal text-zinc-400">/mo</span></p>
            <ul className="space-y-1.5 text-xs text-zinc-300">
              <li className="flex items-center gap-1.5">
                <Check size={12} strokeWidth={2.5} className="flex-shrink-0 text-accent" />
                Unlimited projects
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={12} strokeWidth={2.5} className="flex-shrink-0 text-accent" />
                Unlimited rooms
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={12} strokeWidth={2.5} className="flex-shrink-0 text-accent" />
                Priority support
              </li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-amber-500 disabled:opacity-60 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-colors shadow-lg shadow-accent/20"
          >
            <Zap size={15} strokeWidth={2} />
            {loading ? 'Redirecting to checkout...' : 'Upgrade to Pro — $10/mo'}
          </button>
          <p className="text-center text-xs text-zinc-600 mt-2">Cancel anytime. Billed monthly.</p>
        </div>
      </div>
    </div>
  )
}

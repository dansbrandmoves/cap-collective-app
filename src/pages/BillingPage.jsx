import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Zap, Check, Crown, CreditCard, AlertCircle } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../utils/supabase'

export function BillingPage() {
  const { plan, isProPlan, user, FREE_PROJECT_LIMIT, FREE_GROUP_LIMIT } = useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const upgraded = searchParams.get('upgraded') === '1'

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
    <div className="px-5 sm:px-8 lg:px-16 py-6 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Billing</h1>
        <p className="text-sm text-zinc-500">Manage your plan and subscription.</p>
      </div>

      {/* Upgrade success banner */}
      {upgraded && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3 mb-6">
          <Crown size={16} strokeWidth={2} className="text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-300 font-medium">Welcome to Pro! Your plan has been upgraded.</p>
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1">Current plan</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-zinc-100">{isProPlan ? 'Pro' : 'Free'}</span>
              {isProPlan && (
                <span className="inline-flex items-center gap-1 bg-accent/15 border border-accent/25 text-accent text-xs font-semibold px-2 py-0.5 rounded-full">
                  <Crown size={10} strokeWidth={2.5} />
                  Pro
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-zinc-100">{isProPlan ? '$10' : '$0'}</p>
            <p className="text-xs text-zinc-500">{isProPlan ? '/month' : 'free'}</p>
          </div>
        </div>

        {isProPlan ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-surface-700">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Check size={14} strokeWidth={2.5} className="text-accent flex-shrink-0" />
              Unlimited projects
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Check size={14} strokeWidth={2.5} className="text-accent flex-shrink-0" />
              Unlimited groups
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Check size={14} strokeWidth={2.5} className="text-accent flex-shrink-0" />
              Priority support
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-surface-700">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Check size={14} strokeWidth={2} className="text-zinc-600 flex-shrink-0" />
              {FREE_PROJECT_LIMIT} project
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Check size={14} strokeWidth={2} className="text-zinc-600 flex-shrink-0" />
              {FREE_GROUP_LIMIT} groups per project
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Check size={14} strokeWidth={2} className="text-zinc-600 flex-shrink-0" />
              All core features
            </div>
          </div>
        )}
      </div>

      {/* Upgrade CTA (free only) */}
      {!isProPlan && (
        <div className="bg-accent/8 border border-accent/25 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
              <Zap size={18} strokeWidth={2} className="text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-100 mb-1">Upgrade to Pro</h2>
              <p className="text-sm text-zinc-400 mb-4">
                Unlock unlimited projects and groups. Run as many productions simultaneously as you need.
              </p>
              <ul className="space-y-2 mb-5">
                {[
                  'Unlimited projects',
                  'Unlimited groups per project',
                  'Priority support',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check size={14} strokeWidth={2.5} className="flex-shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 mb-3">
                  <AlertCircle size={14} strokeWidth={2} />
                  {error}
                </div>
              )}

              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-accent hover:bg-amber-500 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-accent/20"
              >
                <CreditCard size={15} strokeWidth={2} />
                {loading ? 'Redirecting...' : 'Upgrade — $10/mo'}
              </button>
              <p className="text-xs text-zinc-600 mt-2">Cancel anytime. Billed monthly via Stripe.</p>
            </div>
          </div>
        </div>
      )}

      {/* Pro: manage subscription note */}
      {isProPlan && (
        <div className="bg-surface-900 border border-surface-700 rounded-2xl p-5">
          <p className="text-sm text-zinc-400">
            To manage your subscription, cancel, or update payment details, contact{' '}
            <a href={`mailto:${user?.email}`} className="text-accent hover:underline">support</a>{' '}
            or visit the Stripe customer portal (link coming soon).
          </p>
        </div>
      )}
    </div>
  )
}

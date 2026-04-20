import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Zap, Check, Crown, CreditCard, AlertCircle, Settings } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../utils/supabase'

export function BillingPage() {
  const { plan, isProPlan, user, FREE_PROJECT_LIMIT, FREE_ROOM_LIMIT } = useApp()
  const [loading, setLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState(null)
  const [upgradedNow, setUpgradedNow] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const sessionId = searchParams.get('session_id')
  const canceled = searchParams.get('canceled') === '1'

  // On return from Stripe Checkout: verify the session and flip plan to pro.
  useEffect(() => {
    if (!sessionId || !user) return
    let cancelled = false
    ;(async () => {
      setVerifying(true)
      setError(null)
      const { data, error: fnErr } = await supabase.functions.invoke('verify-checkout-session', {
        body: { sessionId },
      })
      if (cancelled) return
      if (fnErr || data?.error) {
        setError(fnErr?.message || data?.error || 'Could not verify checkout')
      } else if (data?.paid) {
        setUpgradedNow(true)
        // Re-fetch the plan so the UI updates
        if (user?.id) {
          const { data: p } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
          if (p?.plan) {
            // Force a page reload to pick up the new plan in AppContext (simpler than plumbing refresh)
            // But since we show the success banner here, give the user a moment first.
          }
        }
      }
      setVerifying(false)
      // Clean the URL
      setSearchParams({}, { replace: true })
    })()
    return () => { cancelled = true }
  }, [sessionId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // On every mount: sync subscription status from Stripe so the local plan
  // stays accurate even without webhooks (catches cancellations, payment
  // failures, etc. next time the user opens this page).
  useEffect(() => {
    if (!user || sessionId) return // skip during verify flow
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.functions.invoke('sync-subscription-status', { body: {} })
      if (cancelled) return
      if (data?.changed) {
        // Reload to refresh plan state
        window.location.reload()
      }
    })()
    return () => { cancelled = true }
  }, [user, sessionId])

  async function handleUpgrade() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('create-checkout-session', {
        body: { origin: window.location.origin },
      })
      if (fnErr || data?.error) throw new Error(fnErr?.message || data?.error || 'Failed to start checkout')
      if (data?.url) window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('create-portal-session', {
        body: { origin: window.location.origin },
      })
      if (fnErr || data?.error) throw new Error(fnErr?.message || data?.error || 'Could not open billing portal')
      if (data?.url) window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setPortalLoading(false)
    }
  }

  return (
    <div className="px-5 sm:px-8 lg:px-14 py-8 sm:py-12">
      <div className="mb-10 sm:mb-12">
        <h1 className="text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15] mb-2">Billing</h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed">Manage your plan and subscription.</p>
      </div>

      {verifying && (
        <div className="flex items-center gap-3 bg-surface-900 border border-white/[0.06] rounded-xl px-4 py-3 mb-6">
          <div className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin flex-shrink-0" />
          <p className="text-sm text-zinc-300">Verifying your payment with Stripe...</p>
        </div>
      )}

      {upgradedNow && !verifying && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3 mb-6">
          <Crown size={16} strokeWidth={2} className="text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-300 font-medium">Welcome to Pro! Your plan has been upgraded.</p>
        </div>
      )}

      {canceled && !upgradedNow && !verifying && (
        <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 mb-6">
          <AlertCircle size={16} strokeWidth={2} className="text-zinc-400 flex-shrink-0" />
          <p className="text-sm text-zinc-300">Checkout canceled. You can upgrade anytime below.</p>
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
              Unlimited rooms
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
              {FREE_ROOM_LIMIT} rooms per project
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Check size={14} strokeWidth={2} className="text-zinc-600 flex-shrink-0" />
              All core features
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={14} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

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
                Unlock unlimited projects and rooms. Run as many productions simultaneously as you need.
              </p>
              <ul className="space-y-2 mb-5">
                {[
                  'Unlimited projects',
                  'Unlimited rooms per project',
                  'Priority support',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check size={14} strokeWidth={2.5} className="flex-shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>

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

      {/* Pro: manage subscription */}
      {isProPlan && (
        <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <Settings size={18} strokeWidth={1.75} className="text-zinc-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-100 mb-1">Manage subscription</h2>
              <p className="text-sm text-zinc-400 mb-4">
                Update your payment method, view invoices, or cancel your subscription. Handled securely by Stripe.
              </p>
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="inline-flex items-center gap-2 bg-surface-700 hover:bg-surface-600 disabled:opacity-60 text-zinc-100 font-medium text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {portalLoading ? 'Opening portal...' : 'Manage in Stripe →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

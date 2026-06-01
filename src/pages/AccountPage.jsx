import { useSearchParams, Navigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { CalendarSettings } from './CalendarSettings'
import { AvailabilityRules } from './AvailabilityRules'
import { BillingPage } from './BillingPage'
import { CalendarDays, CalendarClock, CreditCard } from 'lucide-react'

// Single account hub. Tabs consolidate what used to be three separate top-level
// nav items (Calendars / Availability / Billing). Entered from the sidebar avatar.
const TABS = [
  { key: 'calendars', label: 'Calendars', icon: CalendarDays },
  { key: 'availability', label: 'Availability', icon: CalendarClock },
  { key: 'billing', label: 'Billing', icon: CreditCard },
]

export function AccountPage() {
  const { user, authLoading } = useApp()
  const [params, setParams] = useSearchParams()
  // Don't redirect while auth is still resolving (returning user refreshing the page).
  if (!user) return authLoading ? null : <Navigate to="/signin" replace />

  const tab = TABS.some(t => t.key === params.get('tab')) ? params.get('tab') : 'calendars'
  const setTab = (key) => setParams(key === 'calendars' ? {} : { tab: key }, { replace: true })

  const name = user.user_metadata?.full_name || user.email

  return (
    <div className="px-5 sm:px-8 lg:px-14 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {user.user_metadata?.avatar_url ? (
          <img src={user.user_metadata.avatar_url} alt="" className="w-11 h-11 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-base font-bold text-white flex-shrink-0">
            {name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-semibold text-zinc-50 tracking-tight leading-tight truncate">Account</h1>
          <p className="text-[13px] text-zinc-500 truncate">{name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-surface-800 mb-8 -mx-1 px-1 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === key
                ? 'border-accent text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {tab === 'calendars' && <CalendarSettings embedded />}
      {tab === 'availability' && <AvailabilityRules embedded />}
      {tab === 'billing' && <BillingPage embedded />}
    </div>
  )
}

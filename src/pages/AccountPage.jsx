import { useRef, useState } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { CalendarSettings } from './CalendarSettings'
import { AvailabilityRules } from './AvailabilityRules'
import { BillingPage } from './BillingPage'
import { AvatarCropper } from '../components/account/AvatarCropper'
import { CalendarDays, CalendarClock, CreditCard, Camera } from 'lucide-react'

// Single account hub. Tabs consolidate what used to be three separate top-level
// nav items (Calendars / Availability / Billing). Entered from the sidebar avatar.
const TABS = [
  { key: 'calendars', label: 'Calendars', icon: CalendarDays },
  { key: 'availability', label: 'Availability', icon: CalendarClock },
  { key: 'billing', label: 'Billing', icon: CreditCard },
]

export function AccountPage() {
  const { user, authLoading, avatarUrl, uploadAvatar, removeAvatar } = useApp()
  const [params, setParams] = useSearchParams()
  const fileRef = useRef(null)
  const [cropFile, setCropFile] = useState(null)
  // Don't redirect while auth is still resolving (returning user refreshing the page).
  if (!user) return authLoading ? null : <Navigate to="/signin" replace />

  const tab = TABS.some(t => t.key === params.get('tab')) ? params.get('tab') : 'calendars'
  const setTab = (key) => setParams(key === 'calendars' ? {} : { tab: key }, { replace: true })

  const fullName = user.user_metadata?.full_name
  const name = fullName || user.email
  // Uploaded photo wins; fall back to an OAuth provider photo, then initials.
  const photo = avatarUrl || user.user_metadata?.avatar_url || null

  function pickFile(e) {
    const f = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (f) setCropFile(f)
  }

  return (
    <div className="px-5 sm:px-8 lg:px-14 py-8 sm:py-12">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={async (blob) => { await uploadAvatar(blob); setCropFile(null) }}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3.5 mb-6">
        {/* Avatar — click to change */}
        <button
          onClick={() => fileRef.current?.click()}
          className="relative group w-14 h-14 rounded-full flex-shrink-0 overflow-hidden"
          title="Change photo"
        >
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-accent flex items-center justify-center text-lg font-bold text-white">
              {name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera size={16} strokeWidth={2} className="text-white" />
          </span>
        </button>
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-semibold text-zinc-50 tracking-tight leading-tight truncate">
            {fullName || 'Account'}
          </h1>
          <p className="text-[13px] text-zinc-500 truncate">{user.email}</p>
          <div className="flex items-center gap-2.5 mt-1">
            <button onClick={() => fileRef.current?.click()} className="text-[12px] font-medium text-accent hover:text-accent/80 transition-colors">
              {photo ? 'Change photo' : 'Add photo'}
            </button>
            {avatarUrl && (
              <button onClick={removeAvatar} className="text-[12px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors">Remove</button>
            )}
          </div>
        </div>
      </div>

      <p className="text-[12px] text-zinc-600 mb-6 -mt-2">
        Notifications and booking emails are sent to <span className="text-zinc-400">{user.email}</span>.
      </p>

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

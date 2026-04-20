import { useState, useEffect, useRef } from 'react'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../utils/supabase'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import {
  startGoogleAuth,
  handleGoogleRedirect,
  getValidAccessToken,
  disconnectGoogle,
  isGoogleConnected,
  fetchCalendarList,
  fetchAllGoverningEvents,
  isConfigured,
} from '../utils/googleCalendar'
import { RefreshCw, Plug, Unplug, Plus, Trash2, Sun, Moon, Globe } from 'lucide-react'

const TIMEZONES = [
  { group: 'Americas', zones: [
    { value: 'America/New_York',    label: 'Eastern Time (ET)' },
    { value: 'America/Chicago',     label: 'Central Time (CT)' },
    { value: 'America/Denver',      label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
    { value: 'Pacific/Honolulu',    label: 'Hawaii (HT)' },
    { value: 'America/Toronto',     label: 'Toronto (ET)' },
    { value: 'America/Vancouver',   label: 'Vancouver (PT)' },
    { value: 'America/Sao_Paulo',   label: 'São Paulo (BRT)' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London',  label: 'London (GMT/BST)' },
    { value: 'Europe/Paris',   label: 'Paris (CET)' },
    { value: 'Europe/Berlin',  label: 'Berlin (CET)' },
    { value: 'Europe/Moscow',  label: 'Moscow (MSK)' },
  ]},
  { group: 'Middle East & Africa', zones: [
    { value: 'Asia/Dubai',              label: 'Dubai (GST)' },
    { value: 'Africa/Johannesburg',     label: 'Johannesburg (SAST)' },
  ]},
  { group: 'Asia & Pacific', zones: [
    { value: 'Asia/Kolkata',     label: 'India (IST)' },
    { value: 'Asia/Singapore',   label: 'Singapore (SGT)' },
    { value: 'Asia/Tokyo',       label: 'Tokyo (JST)' },
    { value: 'Asia/Seoul',       label: 'Seoul (KST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  ]},
  { group: 'Universal', zones: [
    { value: 'UTC', label: 'UTC' },
  ]},
]

function tzLabel(value) {
  for (const g of TIMEZONES) {
    const z = g.zones.find(z => z.value === value)
    if (z) return z.label
  }
  return value
}

const ROLE_META = {
  governs:       { label: 'Blocks your time',   badge: 'green',  desc: 'Events on this calendar block booking slots.' },
  informational: { label: 'Only visible to you', badge: 'yellow', desc: 'You can see these events, but they won\'t affect availability.' },
  ignored:       { label: 'Ignored',              badge: 'ghost',  desc: 'Connected but won\'t affect your availability.' },
}

const ROLES = ['governs', 'informational', 'ignored']
const DAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const HOUR_OPTIONS = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const period = h >= 12 ? 'PM' : 'AM'
    const label = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`
    HOUR_OPTIONS.push({ val, label })
  }
}

function TimeSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-xs bg-surface-800 border border-surface-700 rounded-md px-1.5 py-1 text-zinc-300 focus:outline-none focus:border-accent appearance-none cursor-pointer">
      {HOUR_OPTIONS.map(o => (
        <option key={o.val} value={o.val}>{o.label}</option>
      ))}
    </select>
  )
}

function formatLastSynced(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const diff = Math.round((Date.now() - d) / 60000)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`
}

export function CalendarSettings() {
  const {
    connectedCalendars, addConnectedCalendar, updateCalendarRole, updateCalendarDefaultState, removeConnectedCalendar,
    googleAccessToken, setGoogleAccessToken,
    googleTokenExpiresAt, setGoogleTokenExpiresAt,
    calendarSyncing, setCalendarSyncing,
    lastSynced, replaceCalendarEvents,
    prefixRules, createPrefixRule, updatePrefixRule, deletePrefixRule,
    slotStates, updateSlotStateCustomization, resetSlotStateCustomizations,
    businessHours, setBusinessHours,
    guestCalendarEnabled, setGuestCalendarEnabled,
    theme, toggleTheme,
    timezone, setTimezone,
    availabilityMode, setAvailabilityMode, blockDuration, setBlockDuration,
    logoUrl, logoIsDark, setLogoIsDark, uploadLogo, removeLogo, user,
    resetAllSettings,
  } = useApp()

  const [gisReady, setGisReady] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [pendingCals, setPendingCals] = useState([])
  const [assigningRoles, setAssigningRoles] = useState({})
  const pendingSyncRef = useRef(false)
  const [showAddRule, setShowAddRule] = useState(false)
  const [newPrefix, setNewPrefix] = useState('')
  const [newState, setNewState] = useState('blocked')
  const [editingHours, setEditingHours] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [tzOpen, setTzOpen] = useState(false)

  const configured = isConfigured()
  const [connected, setConnected] = useState(false)

  // Check connection status + handle post-connect calendar picker
  useEffect(() => {
    if (!configured) return
    async function init() {
      const isConn = await isGoogleConnected()
      setConnected(isConn)

      // If we just came back from Google OAuth, show calendar picker
      const params = new URLSearchParams(window.location.search)
      if (params.get('connected') === '1' && isConn) {
        window.history.replaceState({}, '', window.location.pathname)
        try {
          const accessToken = await getValidAccessToken()
          if (accessToken) {
            const cals = await fetchCalendarList(accessToken)
            const roles = {}
            cals.forEach(cal => {
              const existing = connectedCalendars.find(c => c.googleCalendarId === cal.googleCalendarId)
              roles[cal.googleCalendarId] = existing?.role ?? 'governs'
            })
            setAssigningRoles(roles)
            setPendingCals(cals)
            setShowRoleModal(true)
          }
        } catch (err) { setAuthError(`Failed to fetch calendars: ${err.message}`) }
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync on mount and every 30 minutes
  useEffect(() => {
    if (!connected || connectedCalendars.length === 0) return
    handleSync()
    const interval = setInterval(() => { handleSync() }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [connected, connectedCalendars.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleConnect() {
    setAuthError(null)
    startGoogleAuth()
  }

  async function handleDisconnect() {
    await disconnectGoogle()
    setGoogleAccessToken(null)
    setGoogleTokenExpiresAt(null)
    setConnected(false)
  }

  function handleSaveRoles() {
    pendingCals.forEach(cal => {
      addConnectedCalendar({ ...cal, role: assigningRoles[cal.googleCalendarId] ?? 'governs' })
    })
    setShowRoleModal(false)
    setPendingCals([])
    pendingSyncRef.current = true
  }

  useEffect(() => {
    if (!pendingSyncRef.current) return
    pendingSyncRef.current = false
    handleSync()
  }, [connectedCalendars]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSync() {
    setCalendarSyncing(true)
    setAuthError(null)
    try {
      const accessToken = await getValidAccessToken()
      if (!accessToken) {
        setConnected(false)
        setAuthError('Google Calendar disconnected. Reconnect to sync.')
        setCalendarSyncing(false)
        return
      }
      setGoogleAccessToken(accessToken)
      const timeMin = new Date(); timeMin.setMonth(timeMin.getMonth() - 1)
      const timeMax = new Date(); timeMax.setMonth(timeMax.getMonth() + 3)
      const events = await fetchAllGoverningEvents(accessToken, connectedCalendars, timeMin, timeMax)
      replaceCalendarEvents(events)
    } catch (err) {
      setAuthError(`Sync failed: ${err.message}`)
    } finally {
      setCalendarSyncing(false)
    }
  }

  const schedule = businessHours.schedule || {}

  function toggleDay(d) {
    setBusinessHours(prev => {
      const s = { ...prev.schedule }
      s[d] = s[d] ? null : { start: '09:00', end: '17:00' }
      return { ...prev, schedule: s }
    })
  }

  function updateDayTime(d, field, value) {
    setBusinessHours(prev => {
      const s = { ...prev.schedule }
      s[d] = { ...s[d], [field]: value }
      return { ...prev, schedule: s }
    })
  }

  function applyToAll(sourceDay) {
    const src = schedule[sourceDay]
    if (!src) return
    setBusinessHours(prev => {
      const s = { ...prev.schedule }
      for (let d = 0; d < 7; d++) {
        if (s[d]) s[d] = { ...src }
      }
      return { ...prev, schedule: s }
    })
  }

  return (
    <div className="px-5 sm:px-8 lg:px-14 py-8 sm:py-12">
      <div className="mb-10 sm:mb-12">
        <h1 className="text-[28px] sm:text-[34px] font-semibold text-zinc-50 tracking-tight leading-[1.15] mb-2">Settings</h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed">Calendar, availability, and preferences.</p>
      </div>

      {!configured && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm font-medium text-amber-300 mb-1">Google Calendar not set up</p>
          <p className="text-xs text-amber-500">
            Calendar integration needs to be configured before you can connect. Contact support if you need help.
          </p>
        </div>
      )}

      {authError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 mb-6">
          <p className="text-xs text-red-400">{authError}</p>
        </div>
      )}

      {/* ── Google Calendar ── */}
      <div className="py-5 border-b border-surface-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200">Google Calendar</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {connected
                ? `Connected · Last synced ${formatLastSynced(lastSynced)}`
                : connectedCalendars.length > 0
                ? <span className="text-amber-400">Connection expired — reconnect to resume syncing.</span>
                : 'Connect once — stays synced automatically.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {connected ? (
              <>
                <button onClick={handleSync} disabled={calendarSyncing}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors disabled:opacity-50">
                  <RefreshCw size={14} strokeWidth={1.75} className={calendarSyncing ? 'animate-spin' : ''} />
                </button>
                <button onClick={handleConnect} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  Reconnect
                </button>
                <Button variant="secondary" size="sm" onClick={handleDisconnect}>Disconnect</Button>
              </>
            ) : (
              <Button size="sm" onClick={handleConnect} disabled={!configured}>
                {connectedCalendars.length > 0 ? 'Reconnect' : 'Connect'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Appearance ── */}
      <div className="py-5 border-b border-surface-800">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Appearance</p>
          <div className="relative">
            <button onClick={() => setThemeOpen(!themeOpen)}
              className="flex items-center gap-2.5 bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2 text-sm text-zinc-300 hover:border-surface-500 transition-colors min-w-[160px]">
              {theme === 'dark'
                ? <Moon size={14} strokeWidth={1.75} className="text-zinc-400" />
                : <Sun size={14} strokeWidth={1.75} className="text-amber-400" />
              }
              <span className="flex-1 text-left">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              <svg className={`w-3 h-3 text-zinc-500 transition-transform ${themeOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {themeOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setThemeOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-full bg-surface-800 border border-surface-700 rounded-lg shadow-xl shadow-black/30 overflow-hidden z-20">
                  {[
                    { value: 'dark', label: 'Dark', icon: Moon, iconClass: 'text-zinc-400' },
                    { value: 'light', label: 'Light', icon: Sun, iconClass: 'text-amber-400' },
                  ].map(({ value, label, icon: Icon, iconClass }) => (
                    <button key={value} onClick={() => { if (value !== theme) toggleTheme(); setThemeOpen(false) }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${
                        value === theme
                          ? 'bg-accent/10 text-zinc-100'
                          : 'text-zinc-400 hover:bg-[#f0f0f0] hover:text-zinc-200'
                      }`}>
                      <Icon size={14} strokeWidth={1.75} className={iconClass} />
                      {label}
                      {value === theme && <span className="ml-auto text-accent text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Timezone ── */}
      <div className="py-5 border-b border-surface-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Timezone</p>
            <p className="text-xs text-zinc-600 mt-1">Used for availability and booking times.</p>
          </div>
          <div className="relative">
            <button onClick={() => setTzOpen(!tzOpen)}
              className="flex items-center gap-2.5 bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2 text-sm text-zinc-300 hover:border-surface-500 transition-colors min-w-[200px]">
              <Globe size={14} strokeWidth={1.75} className="text-zinc-400 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{tzLabel(timezone)}</span>
              <svg className={`w-3 h-3 text-zinc-500 flex-shrink-0 transition-transform ${tzOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {tzOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTzOpen(false)} />
                <div className="absolute top-full right-0 mt-1 w-64 bg-surface-800 border border-surface-700 rounded-lg shadow-xl shadow-black/30 overflow-y-auto max-h-72 z-20">
                  {TIMEZONES.map(group => (
                    <div key={group.group}>
                      <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{group.group}</div>
                      {group.zones.map(z => (
                        <button key={z.value} onClick={() => { setTimezone(z.value); setTzOpen(false) }}
                          className={`w-full flex items-center justify-between px-3.5 py-2 text-sm transition-colors ${
                            z.value === timezone
                              ? 'bg-accent/10 text-zinc-100'
                              : 'text-zinc-400 hover:bg-surface-700 hover:text-zinc-200'
                          }`}>
                          {z.label}
                          {z.value === timezone && <span className="text-accent text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Branding ── */}
      <div className="py-5 border-b border-surface-800">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Branding</p>
        <p className="text-xs text-zinc-600 mb-3">Your logo appears on booking pages and room links instead of Coordie.</p>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <div className="space-y-3">
              {/* Preview: pick which background works */}
              <div className="flex items-center gap-3">
                <button onClick={async () => {
                  setLogoIsDark(true)
                  await supabase.from('profiles').update({ logo_is_dark: true }).eq('id', user?.id)
                }}
                  className={`rounded-lg px-4 py-3 flex items-center justify-center bg-[#f0f0f0] transition-all ${logoIsDark ? 'ring-2 ring-accent' : 'opacity-50 hover:opacity-75'}`}>
                  <img src={logoUrl} alt="" className="max-h-8 max-w-[100px] object-contain" />
                </button>
                <button onClick={async () => {
                  setLogoIsDark(false)
                  await supabase.from('profiles').update({ logo_is_dark: false }).eq('id', user?.id)
                }}
                  className={`rounded-lg px-4 py-3 flex items-center justify-center bg-[#1a1a1e] transition-all ${!logoIsDark ? 'ring-2 ring-accent' : 'opacity-50 hover:opacity-75'}`}>
                  <img src={logoUrl} alt="" className="max-h-8 max-w-[100px] object-contain" />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600">Click the background that makes your logo look best.</p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                  Replace
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async (e) => { if (e.target.files[0]) await uploadLogo(e.target.files[0]) }} />
                </label>
                <button onClick={removeLogo} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Remove</button>
              </div>
            </div>
          ) : (
            <label className="flex items-center gap-2 text-xs bg-surface-800 border border-surface-700 hover:border-surface-500 text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded-lg cursor-pointer transition-colors">
              Upload logo
              <input type="file" accept="image/*" className="hidden"
                onChange={async (e) => { if (e.target.files[0]) await uploadLogo(e.target.files[0]) }} />
            </label>
          )}
        </div>
      </div>

      {/* ── Connected Calendars ── */}
      {connectedCalendars.length > 0 && (
        <div className="py-5 border-b border-surface-800">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Connected Calendars</p>
          <div className="space-y-2">
            {connectedCalendars.map(cal => (
              <div key={cal.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-1.5">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
                  <p className="text-sm text-zinc-300 truncate">{cal.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={cal.role} onChange={e => updateCalendarRole(cal.googleCalendarId, e.target.value)}
                    className="text-xs bg-surface-800 border border-surface-700 rounded-md px-2 py-1 text-zinc-400 focus:outline-none focus:border-accent">
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                  </select>
                  {cal.role === 'governs' && (
                    <select value={cal.defaultState || 'booked'} onChange={e => updateCalendarDefaultState(cal.googleCalendarId, e.target.value)}
                      className="text-xs bg-surface-800 border border-surface-700 rounded-md px-2 py-1 text-zinc-400 focus:outline-none focus:border-accent">
                      {Object.entries(slotStates).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => removeConnectedCalendar(cal.googleCalendarId)}
                    className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Availability ── */}
      <div className="py-5 border-b border-surface-800">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Availability</p>

        {/* Mode + duration */}
        <div className="flex items-center gap-3 mb-4">
          <select value={availabilityMode} onChange={e => setAvailabilityMode(e.target.value)}
            className="text-xs bg-surface-800 border border-surface-700 rounded-md px-2 py-1 text-zinc-400 focus:outline-none focus:border-accent">
            <option value="blocks">Time blocks</option>
            <option value="slots">Named slots</option>
          </select>
          {availabilityMode === 'blocks' && (
            <select value={blockDuration} onChange={e => setBlockDuration(Number(e.target.value))}
              className="text-xs bg-surface-800 border border-surface-700 rounded-md px-2 py-1 text-zinc-400 focus:outline-none focus:border-accent">
              <option value={30}>30 min blocks</option>
              <option value={60}>60 min blocks</option>
            </select>
          )}
        </div>

        {/* Business hours per day */}
        <div className="space-y-0 mb-3">
          {DAY_NAMES.map((name, i) => {
            const day = schedule[i]
            const isActive = !!day
            return (
              <div key={i} className="flex items-center h-10 gap-3 group/day">
                <button onClick={() => toggleDay(i)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                    isActive ? 'bg-accent' : 'bg-surface-600'
                  }`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    isActive ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
                <span className={`w-10 text-sm font-medium ${isActive ? 'text-zinc-100' : 'text-zinc-600'}`}>
                  {name.slice(0, 3)}
                </span>
                {isActive ? (
                  <>
                    <TimeSelect value={day.start} onChange={v => updateDayTime(i, 'start', v)} />
                    <span className="text-xs text-zinc-600">–</span>
                    <TimeSelect value={day.end} onChange={v => updateDayTime(i, 'end', v)} />
                    <button onClick={() => applyToAll(i)}
                      className="text-[10px] text-zinc-600 hover:text-accent transition-colors opacity-0 group-hover/day:opacity-100 ml-1">
                      Apply to all
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-zinc-600">Unavailable</span>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-zinc-600">
          {availabilityMode === 'blocks'
            ? `Generates ${blockDuration}-minute blocks within these hours. Manage custom slots on the Availability page.`
            : 'These hours define your working days. Custom slots are managed on the Availability page.'}
        </p>
      </div>

      {/* ── Guest Calendar Access ── */}
      <div className="py-5 border-b border-surface-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Guest Calendar Access</p>
            <p className="text-xs text-zinc-600 mt-1">
              {guestCalendarEnabled
                ? 'Guests can connect their Google Calendar on booking and room pages.'
                : 'Off — requires Google OAuth verification to enable.'}
            </p>
          </div>
          <button onClick={() => setGuestCalendarEnabled(!guestCalendarEnabled)}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
              guestCalendarEnabled ? 'bg-accent' : 'bg-surface-600'
            }`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
              guestCalendarEnabled ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* ── Prefix Rules ── */}
      <div className="py-5 border-b border-surface-800">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1">Prefix Rules</p>
        <p className="text-xs text-zinc-600 mb-3">Event title prefixes that override the default calendar state.</p>
        {prefixRules.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {prefixRules.map(rule => (
              <div key={rule.id} className="flex items-center gap-3 py-1">
                <code className="text-sm font-bold text-accent bg-surface-800 px-2 py-0.5 rounded flex-shrink-0">{rule.prefix}</code>
                <span className="text-zinc-600 text-xs">→</span>
                <span className="text-xs text-zinc-400">{slotStates[rule.state]?.label || rule.state}</span>
                <div className="flex-1" />
                <button onClick={() => deletePrefixRule(rule.id)}
                  className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors">
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
        {showAddRule ? (
          <div className="flex flex-wrap items-end gap-2 mt-2">
            <input value={newPrefix} onChange={e => setNewPrefix(e.target.value.slice(0, 3))} maxLength={3} placeholder="*"
              className="w-14 bg-surface-800 border border-surface-700 rounded-md px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-accent font-mono" />
            <select value={newState} onChange={e => setNewState(e.target.value)}
              className="text-xs bg-surface-800 border border-surface-700 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent">
              {Object.entries(slotStates).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <Button size="sm" onClick={() => {
              if (!newPrefix.trim()) return
              createPrefixRule({ prefix: newPrefix.trim(), state: newState })
              setNewPrefix(''); setNewState('blocked'); setShowAddRule(false)
            }}>Add</Button>
            <button onClick={() => setShowAddRule(false)} className="text-xs text-zinc-600 hover:text-zinc-400 px-2 py-1">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowAddRule(true)} className="text-xs text-zinc-500 hover:text-accent transition-colors">+ Add rule</button>
        )}
      </div>

      {/* ── Status Labels ── */}
      <div className="py-5 border-b border-surface-800">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Status Labels</p>
          <button onClick={resetSlotStateCustomizations} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Reset</button>
        </div>
        <div className="space-y-1.5">
          {Object.entries(slotStates).map(([key, val]) => {
            const meaning = { available: 'Open', hold: 'Tentative', booked: 'Calendar event', blocked: 'Hard block' }[key]
            return (
              <div key={key} className="flex items-center gap-2.5 py-1">
                <input type="color" value={val.color}
                  onChange={e => updateSlotStateCustomization(key, { color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer bg-[#1a1a1e] border-0 flex-shrink-0" />
                <input type="text" value={val.label}
                  onChange={e => updateSlotStateCustomization(key, { label: e.target.value })}
                  className="flex-1 bg-[#1a1a1e] text-sm text-zinc-300 focus:outline-none focus:text-zinc-100 min-w-0 border-b border-transparent focus:border-surface-600 py-0.5" />
                <span className="text-[10px] text-zinc-600 flex-shrink-0">{meaning}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Reset ── */}
      <div className="py-5">
        <button onClick={() => {
          if (confirm('Reset all settings to defaults? This won\'t affect your projects, booking pages, or calendar connection.')) {
            resetAllSettings()
          }
        }} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
          Reset all settings to defaults
        </button>
      </div>

      {/* Role assignment modal */}
      <Modal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} title="Assign Calendar Roles">
        <div className="space-y-3 mb-5">
          <p className="text-xs text-zinc-500">Choose how each calendar affects availability.</p>
          {pendingCals.map(cal => (
            <div key={cal.googleCalendarId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
                <p className="text-sm text-zinc-300 truncate">{cal.name}</p>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <select
                  value={assigningRoles[cal.googleCalendarId] ?? 'governs'}
                  onChange={e => setAssigningRoles(r => ({ ...r, [cal.googleCalendarId]: e.target.value }))}
                  className="text-xs bg-[#f0f0f0] border border-surface-600 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                </select>
                <button onClick={() => setPendingCals(prev => prev.filter(c => c.googleCalendarId !== cal.googleCalendarId))}
                  className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove calendar">
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setShowRoleModal(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSaveRoles}>Save & Connect</Button>
        </div>
      </Modal>
    </div>
  )
}

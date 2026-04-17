import { useState, useEffect, useRef } from 'react'
import { useApp } from '../contexts/AppContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import {
  loadGoogleIdentityServices,
  initTokenClient,
  requestAccessToken,
  revokeAccessToken,
  fetchCalendarList,
  fetchAllGoverningEvents,
  isConfigured,
} from '../utils/googleCalendar'
import { RefreshCw, Plug, Unplug, Plus, Trash2 } from 'lucide-react'

const ROLE_META = {
  governs:       { label: 'Governs availability', badge: 'green',  desc: 'Events block or color slots — drives what groups see.' },
  informational: { label: 'Informational only',   badge: 'yellow', desc: 'Visible to you privately only. No effect on slot state.' },
  ignored:       { label: 'Ignored',              badge: 'ghost',  desc: 'Connected but excluded from all calculations.' },
}

const ROLES = ['governs', 'informational', 'ignored']
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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

  const configured = isConfigured()

  useEffect(() => {
    if (!configured) return
    loadGoogleIdentityServices()
      .then(() => {
        initTokenClient(handleTokenResponse)
        setGisReady(true)
      })
      .catch(() => setAuthError('Failed to load Google Identity Services.'))
  }, [])

  useEffect(() => {
    if (!googleAccessToken || connectedCalendars.length === 0) return
    handleSync()
    const interval = setInterval(() => { handleSync() }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [googleAccessToken, connectedCalendars.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTokenResponse(tokenResponse) {
    if (tokenResponse.error) { setAuthError(`Auth error: ${tokenResponse.error}`); return }
    setGoogleAccessToken(tokenResponse.access_token)
    if (tokenResponse.expires_in) setGoogleTokenExpiresAt(Date.now() + (tokenResponse.expires_in * 1000))
    setAuthError(null)
    fetchCalendarList(tokenResponse.access_token)
      .then(cals => {
        const roles = {}
        cals.forEach(cal => {
          const existing = connectedCalendars.find(c => c.googleCalendarId === cal.googleCalendarId)
          roles[cal.googleCalendarId] = existing?.role ?? 'governs'
        })
        setAssigningRoles(roles)
        setPendingCals(cals)
        setShowRoleModal(true)
      })
      .catch(err => setAuthError(`Failed to fetch calendars: ${err.message}`))
  }

  function handleConnect() { setAuthError(null); requestAccessToken() }
  function handleDisconnect() { revokeAccessToken(googleAccessToken); setGoogleAccessToken(null); setGoogleTokenExpiresAt(null) }

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
    if (!googleAccessToken) { setAuthError('Not authenticated. Connect Google Calendar first.'); return }
    setCalendarSyncing(true)
    setAuthError(null)
    try {
      const timeMin = new Date(); timeMin.setMonth(timeMin.getMonth() - 1)
      const timeMax = new Date(); timeMax.setMonth(timeMax.getMonth() + 3)
      const events = await fetchAllGoverningEvents(googleAccessToken, connectedCalendars, timeMin, timeMax)
      replaceCalendarEvents(events)
    } catch (err) {
      if (err.message?.includes('401')) {
        setAuthError('Session expired. Please re-connect Google Calendar.')
      } else {
        setAuthError(`Sync failed: ${err.message}`)
      }
    } finally {
      setCalendarSyncing(false)
    }
  }

  function toggleDay(d) {
    setBusinessHours(prev => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d].sort(),
    }))
  }

  const activeDays = (businessHours.days || [1,2,3,4,5]).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')

  return (
    <div className="px-5 sm:px-8 lg:px-16 py-6 sm:py-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Settings</h1>
        <p className="text-sm text-zinc-500">Calendar, availability, and preferences.</p>
      </div>

      {!configured && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm font-medium text-amber-300 mb-1">Google Client ID not configured</p>
          <p className="text-xs text-amber-500">
            Add <code className="bg-amber-900/50 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> to your <code className="bg-amber-900/50 px-1 rounded">.env</code> file.
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
              {googleAccessToken
                ? `Connected · Last synced ${formatLastSynced(lastSynced)}`
                : 'Grant read access to derive availability from your calendars.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {googleAccessToken ? (
              <>
                <button onClick={handleSync} disabled={calendarSyncing}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors disabled:opacity-50">
                  <RefreshCw size={14} strokeWidth={1.75} className={calendarSyncing ? 'animate-spin' : ''} />
                </button>
                <Button variant="secondary" size="sm" onClick={handleDisconnect}>Disconnect</Button>
              </>
            ) : (
              <Button size="sm" onClick={handleConnect} disabled={!configured || !gisReady}>Connect</Button>
            )}
          </div>
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

      {/* ── Business Hours ── */}
      <div className="py-5 border-b border-surface-800">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Business Hours</p>
          <button onClick={() => setEditingHours(!editingHours)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            {editingHours ? 'Done' : 'Edit'}
          </button>
        </div>
        {editingHours ? (
          <div className="mt-3 space-y-3">
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    businessHours.days.includes(i)
                      ? 'bg-accent/15 border border-accent/30 text-accent'
                      : 'bg-surface-800 border border-surface-700 text-zinc-600 hover:text-zinc-400'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="time" value={businessHours.start}
                onChange={e => setBusinessHours(prev => ({ ...prev, start: e.target.value }))}
                className="text-xs bg-surface-800 border border-surface-700 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent" />
              <span className="text-xs text-zinc-600">to</span>
              <input type="time" value={businessHours.end}
                onChange={e => setBusinessHours(prev => ({ ...prev, end: e.target.value }))}
                className="text-xs bg-surface-800 border border-surface-700 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 mt-1">
            {activeDays} · {formatTime(businessHours.start)} – {formatTime(businessHours.end)}
          </p>
        )}
        <p className="text-xs text-zinc-600 mt-2">Default hours for new booking pages. Also constrains calendar availability.</p>
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
              guestCalendarEnabled ? 'bg-accent' : 'bg-surface-700'
            }`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              guestCalendarEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
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
          {Object.entries(slotStates).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2.5 py-1">
              <input type="color" value={val.color}
                onChange={e => updateSlotStateCustomization(key, { color: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 flex-shrink-0" />
              <input type="text" value={val.label}
                onChange={e => updateSlotStateCustomization(key, { label: e.target.value })}
                className="flex-1 bg-transparent text-sm text-zinc-300 focus:outline-none focus:text-zinc-100 min-w-0 border-b border-transparent focus:border-surface-600 py-0.5" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Appearance ── */}
      <div className="py-5">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Appearance</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Switch between dark and light interface.</p>
          </div>
          <button onClick={toggleTheme}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
              theme === 'dark' ? 'bg-accent' : 'bg-surface-700'
            }`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
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
              <select
                value={assigningRoles[cal.googleCalendarId] ?? 'governs'}
                onChange={e => setAssigningRoles(r => ({ ...r, [cal.googleCalendarId]: e.target.value }))}
                className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent self-start sm:self-auto">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
              </select>
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

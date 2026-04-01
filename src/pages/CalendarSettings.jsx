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

const ROLE_META = {
  governs:       { label: 'Governs availability', badge: 'green',  desc: 'Events block or color slots — drives what groups see.' },
  informational: { label: 'Informational only',   badge: 'yellow', desc: 'Visible to you privately only. No effect on slot state.' },
  ignored:       { label: 'Ignored',              badge: 'ghost',  desc: 'Connected but excluded from all calculations.' },
}

const ROLES = ['governs', 'informational', 'ignored']

function formatLastSynced(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const diff = Math.round((Date.now() - d) / 60000)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function CalendarSettings() {
  const {
    connectedCalendars, addConnectedCalendar, updateCalendarRole, updateCalendarDefaultState, removeConnectedCalendar,
    googleAccessToken, setGoogleAccessToken,
    calendarSyncing, setCalendarSyncing,
    lastSynced, replaceCalendarEvents,
    prefixRules, createPrefixRule, updatePrefixRule, deletePrefixRule,
  } = useApp()

  const [gisReady, setGisReady] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [pendingCals, setPendingCals] = useState([]) // from Google, before roles assigned
  const [assigningRoles, setAssigningRoles] = useState({})
  const pendingSyncRef = useRef(false) // trigger auto-sync after calendars save to state
  const [showAddRule, setShowAddRule] = useState(false)
  const [newPrefix, setNewPrefix] = useState('')
  const [newState, setNewState] = useState('blocked')

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

  function handleTokenResponse(tokenResponse) {
    if (tokenResponse.error) {
      setAuthError(`Auth error: ${tokenResponse.error}`)
      return
    }
    setGoogleAccessToken(tokenResponse.access_token)
    setAuthError(null)
    // Fetch calendar list to show role assignment UI
    fetchCalendarList(tokenResponse.access_token)
      .then(cals => {
        // Pre-fill roles for already-connected calendars
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

  function handleConnect() {
    setAuthError(null)
    requestAccessToken()
  }

  function handleDisconnect() {
    revokeAccessToken(googleAccessToken)
    setGoogleAccessToken(null)
  }

  function handleSaveRoles() {
    pendingCals.forEach(cal => {
      addConnectedCalendar({ ...cal, role: assigningRoles[cal.googleCalendarId] ?? 'governs' })
    })
    setShowRoleModal(false)
    setPendingCals([])
    // Auto-sync once connectedCalendars state has updated (next render)
    pendingSyncRef.current = true
  }

  // Trigger auto-sync after calendar roles are saved
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
      setAuthError(`Sync failed: ${err.message}`)
    } finally {
      setCalendarSyncing(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Owner Only</p>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">Calendar Settings</h1>
        <p className="text-sm text-zinc-500">
          Control what the app knows. Each calendar has a role — governs availability, informational only, or ignored.
        </p>
      </div>

      {/* Config warning */}
      {!configured && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-medium text-amber-300 mb-1">Google Client ID not configured</p>
          <p className="text-xs text-amber-500">
            Add <code className="bg-amber-900/50 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> to your <code className="bg-amber-900/50 px-1 rounded">.env</code> file and restart the dev server.
          </p>
        </div>
      )}

      {authError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-5 py-3 mb-6">
          <p className="text-xs text-red-400">{authError}</p>
        </div>
      )}

      {/* Connect / Disconnect */}
      <div className="bg-surface-900 border border-surface-700 rounded-xl px-6 py-5 flex items-center justify-between mb-6">
        <div>
          <p className="text-sm font-medium text-zinc-300">
            {googleAccessToken ? 'Google Calendar connected' : 'Connect Google Calendar'}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {googleAccessToken
              ? 'OAuth active — token expires in ~1 hour, re-connect to refresh.'
              : 'Grant read access to derive availability from your calendars.'}
          </p>
        </div>
        {googleAccessToken ? (
          <div className="flex items-center gap-3">
            <Badge variant="green">Connected</Badge>
            <Button variant="secondary" size="sm" onClick={handleDisconnect}>Disconnect</Button>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={!configured || !gisReady}
          >
            Connect →
          </Button>
        )}
      </div>

      {/* Connected calendars */}
      <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Connected Calendars</p>
      {connectedCalendars.length === 0 ? (
        <p className="text-sm text-zinc-600">No calendars connected yet.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {connectedCalendars.map(cal => {
            const role = ROLE_META[cal.role]
            return (
              <div key={cal.id} className="bg-surface-900 border border-surface-700 rounded-xl px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
                    <p className="text-sm font-medium text-zinc-200 truncate">{cal.name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={cal.role}
                      onChange={e => updateCalendarRole(cal.googleCalendarId, e.target.value)}
                      className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1 text-zinc-300 focus:outline-none focus:border-accent"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                    </select>
                    {cal.role === 'governs' && (
                      <select
                        value={cal.defaultState || 'booked'}
                        onChange={e => updateCalendarDefaultState(cal.googleCalendarId, e.target.value)}
                        className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1 text-zinc-300 focus:outline-none focus:border-accent"
                      >
                        <option value="available">Available</option>
                        <option value="hold">Penciled</option>
                        <option value="booked">Not Typically Considered</option>
                        <option value="blocked">Not Available</option>
                      </select>
                    )}
                    <button onClick={() => removeConnectedCalendar(cal.googleCalendarId)} className="text-xs text-red-600 hover:text-red-400 transition-colors">Remove</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Prefix Rules */}
      <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Prefix Rules</p>
      <p className="text-xs text-zinc-600 mb-3">Events in governing calendars with these title prefixes override the default state.</p>
      {prefixRules.length === 0 ? (
        <p className="text-sm text-zinc-600 mb-4">No prefix rules defined.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {prefixRules.map(rule => (
            <div key={rule.id} className="bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <code className="text-sm font-bold text-accent bg-surface-800 px-2 py-0.5 rounded">{rule.prefix}</code>
                <span className="text-zinc-500 text-xs">→</span>
                <Badge variant={rule.state === 'blocked' ? 'red' : rule.state === 'hold' ? 'yellow' : rule.state === 'available' ? 'ghost' : 'default'}>
                  {rule.state === 'blocked' ? 'Not Available' : rule.state === 'hold' ? 'Penciled' : rule.state === 'booked' ? 'Not Typically Considered' : rule.state}
                </Badge>
                {rule.description && <span className="text-xs text-zinc-600 hidden sm:inline">{rule.description}</span>}
              </div>
              <button onClick={() => deletePrefixRule(rule.id)} className="text-xs text-red-600 hover:text-red-400 transition-colors flex-shrink-0">Remove</button>
            </div>
          ))}
        </div>
      )}
      {showAddRule ? (
        <div className="bg-surface-900 border border-surface-700 rounded-xl px-4 py-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Prefix character</label>
              <input
                value={newPrefix}
                onChange={e => setNewPrefix(e.target.value.slice(0, 3))}
                maxLength={3}
                placeholder="*"
                className="w-16 bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-accent font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Maps to state</label>
              <select
                value={newState}
                onChange={e => setNewState(e.target.value)}
                className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent"
              >
                <option value="blocked">Not Available</option>
                <option value="hold">Penciled</option>
                <option value="booked">Not Typically Considered</option>
                <option value="available">Available</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => {
                if (!newPrefix.trim()) return
                createPrefixRule({ prefix: newPrefix.trim(), state: newState })
                setNewPrefix('')
                setNewState('blocked')
                setShowAddRule(false)
              }}>Add Rule</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowAddRule(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowAddRule(true)} className="mb-6">+ Add Prefix Rule</Button>
      )}

      {/* Sync */}
      <div className="flex items-center justify-between px-5 py-4 bg-surface-900 border border-surface-700 rounded-xl">
        <div>
          <p className="text-sm text-zinc-300">Sync calendar events</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Last synced: {formatLastSynced(lastSynced)}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSync}
          disabled={calendarSyncing || !googleAccessToken}
        >
          {calendarSyncing ? 'Syncing...' : 'Refresh now'}
        </Button>
      </div>

      {/* Role assignment modal — shown after OAuth */}
      <Modal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} title="Assign Calendar Roles">
        <div className="space-y-3 mb-5">
          <p className="text-xs text-zinc-500">Choose how each calendar affects availability.</p>
          {pendingCals.map(cal => (
            <div key={cal.googleCalendarId} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
              <p className="text-sm text-zinc-300 flex-1 truncate">{cal.name}</p>
              <select
                value={assigningRoles[cal.googleCalendarId] ?? 'governs'}
                onChange={e => setAssigningRoles(r => ({ ...r, [cal.googleCalendarId]: e.target.value }))}
                className="text-xs bg-surface-700 border border-surface-600 rounded-md px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-accent"
              >
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

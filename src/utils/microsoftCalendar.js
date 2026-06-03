/**
 * Microsoft Graph Calendar OAuth — Authorization Code Flow with refresh tokens.
 * Mirrors googleCalendar.js: redirect → ?code → edge function exchanges for a
 * refresh token stored on profiles.ms_* → access token auto-refreshes.
 *
 * Gated by VITE_MS_CLIENT_ID — until that's set (frontend env + Vercel) the whole
 * Microsoft connect UI stays hidden, so this is inert on the live app.
 */
import { supabase } from './supabase'

const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID
// "common" = work + personal Microsoft accounts (matches the app registration).
const TENANT = 'common'
const AUTHORIZE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`
const GRAPH = 'https://graph.microsoft.com/v1.0'
const SCOPES = 'offline_access Calendars.Read User.Read openid email profile'

export const isMsConfigured = () => Boolean(CLIENT_ID)

// Start the redirect OAuth flow — returns to window.location.origin with ?code.
export function startMicrosoftAuth() {
  if (!CLIENT_ID) { console.warn('VITE_MS_CLIENT_ID is not set.'); return }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: window.location.origin,
    response_mode: 'query',
    scope: SCOPES,
    state: 'microsoft-calendar',
    prompt: 'consent',
  })
  window.location.href = `${AUTHORIZE}?${params}`
}

// Call on app load: if we came back from Microsoft, exchange the code for tokens.
export async function handleMicrosoftRedirect() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  if (!code || state !== 'microsoft-calendar') return null
  window.history.replaceState({}, '', window.location.pathname)
  const { data, error } = await supabase.functions.invoke('microsoft-calendar-auth', {
    body: { action: 'exchange', code, redirectUri: window.location.origin },
  })
  if (error || data?.error) { console.error('MS auth exchange failed:', error || data?.error); return null }
  return data // { access_token, expires_at }
}

// Valid access token, refreshing via the edge function if needed.
export async function getValidMsAccessToken() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('ms_access_token, ms_token_expires_at, ms_refresh_token')
    .eq('id', user.id).single()
  if (!profile?.ms_refresh_token) return null
  if (profile.ms_access_token && profile.ms_token_expires_at > Date.now() + 300000) return profile.ms_access_token
  const { data, error } = await supabase.functions.invoke('microsoft-calendar-auth', { body: { action: 'refresh' } })
  if (error || data?.error) { console.error('MS token refresh failed:', error || data?.error); return null }
  return data.access_token
}

export async function disconnectMicrosoft() {
  await supabase.functions.invoke('microsoft-calendar-auth', { body: { action: 'disconnect' } })
}

// Trigger an immediate server-side sync of the owner's Microsoft calendars.
// The owner's in-memory events refresh from owner_calendar_events via realtime.
export async function triggerMicrosoftSync() {
  return supabase.functions.invoke('sync-ms-calendar', { body: {} })
}

export async function isMicrosoftConnected() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('ms_refresh_token').eq('id', user.id).single()
  return !!profile?.ms_refresh_token
}

// ── Graph calendar helpers ──
// MS calendar ids are namespaced with an "ms:" prefix in our connected-calendars
// store so they never collide with Google calendar ids (both share the same key).

export async function fetchMsCalendarList(accessToken) {
  const res = await fetch(`${GRAPH}/me/calendars`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`MS calendar list failed: ${res.status}`)
  const data = await res.json()
  return (data.value || []).map(cal => ({
    googleCalendarId: `ms:${cal.id}`,   // shared key field; "ms:" namespaces it
    msCalendarId: cal.id,
    name: cal.name,
    color: cal.hexColor && cal.hexColor !== 'auto' ? cal.hexColor : '#0078d4',
    primary: !!cal.isDefaultCalendar,
    provider: 'microsoft',
  }))
}

export async function fetchMsCalendarEvents(accessToken, msCalendarId, timeMin, timeMax) {
  const params = new URLSearchParams({
    startDateTime: timeMin.toISOString(),
    endDateTime: timeMax.toISOString(),
    $top: '250',
    $orderby: 'start/dateTime',
  })
  const res = await fetch(
    `${GRAPH}/me/calendars/${encodeURIComponent(msCalendarId)}/calendarView?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' } },
  )
  if (!res.ok) throw new Error(`MS events fetch failed: ${res.status}`)
  const data = await res.json()
  return (data.value || []).map(ev => ({
    id: ev.id,
    calendarId: `ms:${msCalendarId}`,
    title: ev.subject || '',
    // With the Prefer UTC header Graph returns naive UTC datetimes — append Z.
    start: ev.isAllDay ? ev.start.dateTime.slice(0, 10) : `${ev.start.dateTime.replace(/\.\d+$/, '')}Z`,
    end: ev.isAllDay ? ev.end.dateTime.slice(0, 10) : `${ev.end.dateTime.replace(/\.\d+$/, '')}Z`,
    isAllDay: !!ev.isAllDay,
  }))
}

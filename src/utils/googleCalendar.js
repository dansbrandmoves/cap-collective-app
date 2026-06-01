/**
 * Google Calendar OAuth — Authorization Code Flow with refresh tokens
 *
 * Flow:
 * 1. User clicks Connect → redirected to Google consent screen
 * 2. Google redirects back with ?code=... in the URL
 * 3. We send the code to our edge function which exchanges it for tokens
 * 4. Refresh token stored in Supabase — access token auto-refreshes forever
 *
 * No more 1-hour expiry. Calendar stays connected until user disconnects.
 */

import { supabase } from './supabase'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
// readonly = read free/busy for availability; events = create meetings in-app.
// Both are "sensitive" (not restricted) scopes — same verification tier the app
// already cleared for readonly.
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/**
 * Start the Google OAuth flow — redirects to Google consent screen.
 * After consent, Google redirects back to redirectUri with ?code=...
 */
export function startGoogleAuth() {
  if (!CLIENT_ID) {
    console.warn('VITE_GOOGLE_CLIENT_ID is not set.')
    return
  }
  // Must match an authorized redirect URI in Google Console
  // We use the origin (not full path) because Google requires exact match
  const redirectUri = window.location.origin
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',     // This gives us a refresh token
    prompt: 'consent',          // Always show consent to get refresh token
    state: 'google-calendar',   // We check for this on redirect
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/**
 * Handle the OAuth redirect — exchange code for tokens via edge function.
 * Call this on app load to check for ?code= in the URL.
 * Returns { access_token, expires_at } or null if no code present.
 */
export async function handleGoogleRedirect() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')

  if (!code || state !== 'google-calendar') return null

  // Clean the URL
  window.history.replaceState({}, '', window.location.pathname)

  // Exchange code for tokens via edge function
  const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
    body: {
      action: 'exchange',
      code,
      redirectUri: window.location.origin,
    },
  })

  if (error || data?.error) {
    console.error('Google auth exchange failed:', error || data?.error)
    return null
  }

  return data // { access_token, expires_at }
}

/**
 * Get a valid access token — refreshes automatically if expired.
 * Returns access_token string or null if not connected.
 */
export async function getValidAccessToken() {
  // Check if we have a stored token that's still valid
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_token_expires_at, google_refresh_token')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (!profile?.google_refresh_token) return null

  // If token is still valid (with 5 min buffer), use it
  if (profile.google_access_token && profile.google_token_expires_at > Date.now() + 300000) {
    return profile.google_access_token
  }

  // Refresh the token
  const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'refresh' },
  })

  if (error || data?.error) {
    console.error('Token refresh failed:', error || data?.error)
    return null
  }

  return data.access_token
}

/**
 * Disconnect Google Calendar — removes tokens from Supabase.
 */
export async function disconnectGoogle() {
  await supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'disconnect' },
  })
}

/**
 * Check if Google Calendar OAuth is configured.
 */
export const isConfigured = () => Boolean(CLIENT_ID)

/**
 * Check if user has a Google Calendar connection (refresh token exists).
 */
export async function isGoogleConnected() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_refresh_token')
    .eq('id', user.id)
    .single()
  return !!profile?.google_refresh_token
}

// ── Calendar API helpers (unchanged) ──

export async function fetchCalendarList(accessToken) {
  const res = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Calendar list fetch failed: ${res.status}`)
  const data = await res.json()
  return (data.items || []).map(cal => ({
    googleCalendarId: cal.id,
    name: cal.summary,
    color: cal.backgroundColor || '#6b7280',
    primary: cal.primary || false,
  }))
}

export async function fetchCalendarEvents(accessToken, calendarId, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`Events fetch failed for ${calendarId}: ${res.status}`)
  const data = await res.json()
  return (data.items || []).map(event => ({
    id: event.id,
    calendarId,
    title: event.summary || '',
    start: event.start.dateTime ?? event.start.date,
    end: event.end.dateTime ?? event.end.date,
    isAllDay: !event.start.dateTime,
  }))
}

export async function fetchAllGoverningEvents(accessToken, connectedCalendars, timeMin, timeMax) {
  const governing = connectedCalendars.filter(c => c.role === 'governs')
  const results = await Promise.allSettled(
    governing.map(cal =>
      fetchCalendarEvents(accessToken, cal.googleCalendarId, timeMin, timeMax)
        .then(events => events.map(e => ({ ...e, calendarId: cal.googleCalendarId })))
    )
  )
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
}

// Legacy exports for backward compatibility (GuestCalendarPanel still uses these)
export function loadGoogleIdentityServices() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

/**
 * Guest calendar connect via Google's POPUP code client.
 *
 * Unlike the old implicit token client (1-hour access token, no refresh token),
 * the code client returns an auth CODE we exchange server-side for a refresh
 * token — so the server can keep the guest's availability in sync on a schedule,
 * exactly like the owner. Stays a popup (no full-page redirect).
 *
 * Returns the guest's first access token (for an immediate client-side read), and
 * the server stores the refresh token keyed by (roomId, guestName).
 */
export async function connectGuestCalendarOffline({ roomId, guestName }) {
  if (!CLIENT_ID) throw new Error('Google Calendar is not configured.')
  await loadGoogleIdentityServices()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  const code = await new Promise((resolve, reject) => {
    const codeClient = window.google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      ux_mode: 'popup',
      callback: (resp) => {
        if (resp.error || !resp.code) reject(new Error(resp.error || 'No authorization code'))
        else resolve(resp.code)
      },
    })
    codeClient.requestCode()
  })

  // Exchange happens server-side. For the popup code model, redirect_uri is the
  // page origin (Google's documented value for ux_mode 'popup').
  const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
    body: {
      action: 'guest_exchange',
      code,
      redirectUri: window.location.origin,
      roomId,
      guestName,
      timezone,
    },
  })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Calendar connect failed')
  return data // { access_token, expires_at, hasRefreshToken }
}

/** Trigger an immediate server-side sync for one guest (don't wait on the cron). */
export async function triggerGuestSync({ roomId, guestName }) {
  return supabase.functions.invoke('sync-guest-calendars', { body: { roomId, guestName } })
}

/**
 * Create a real event on the owner's primary Google Calendar (server-side, using
 * the stored refresh token). Needs the calendar.events scope — if the owner hasn't
 * re-consented, the server returns { needsReconnect: true }.
 * @returns {{ ok?: boolean, htmlLink?: string, error?: string, needsReconnect?: boolean }}
 */
export async function createCalendarEvent({ title, date, allDay, startTime, endTime, attendees, description, timezone }) {
  const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'create_event', title, date, allDay, startTime, endTime, attendees, description, timezone },
  })
  if (error) return { error: error.message || 'Could not create event' }
  return data || { error: 'No response' }
}

/** Disconnect a guest's calendar server-side (clears token + availability). */
export async function disconnectGuestCalendar({ roomId, guestName }) {
  return supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'guest_disconnect', roomId, guestName },
  })
}

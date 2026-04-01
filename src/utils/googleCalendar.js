/**
 * Google Calendar OAuth — client-side (no backend required)
 *
 * Uses Google Identity Services (token model).
 * Access tokens expire in 1 hour — user re-auths when needed. Fine for prototype.
 *
 * Setup required:
 * 1. Google Cloud Console → create project → enable Google Calendar API
 * 2. APIs & Services → Credentials → OAuth 2.0 Client ID (Web application)
 * 3. Add http://localhost:5173 (and your Vercel URL) as authorized JavaScript origins
 * 4. Set VITE_GOOGLE_CLIENT_ID in your .env file
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

let tokenClient = null

/**
 * Load the Google Identity Services script dynamically.
 */
export function loadGoogleIdentityServices() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

/**
 * Initialize the token client. Call once after GIS is loaded.
 */
export function initTokenClient(onToken) {
  if (!CLIENT_ID) {
    console.warn('VITE_GOOGLE_CLIENT_ID is not set. Calendar OAuth is disabled.')
    return
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onToken,
  })
}

/**
 * Trigger the OAuth popup to request an access token.
 */
export function requestAccessToken() {
  if (!tokenClient) {
    throw new Error('Token client not initialized. Call initTokenClient first.')
  }
  tokenClient.requestAccessToken()
}

/**
 * Revoke the current access token (sign out).
 */
export function revokeAccessToken(token) {
  if (token) {
    window.google?.accounts?.oauth2?.revoke(token)
  }
}

/**
 * Fetch the user's Google Calendar list.
 * Returns array of { id, summary, backgroundColor, primary }
 */
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

/**
 * Fetch events from a specific calendar within a date range.
 * Handles Google's all-day exclusive-end convention — returns raw events,
 * derivation logic in availability.js handles the correction.
 *
 * @param {string} accessToken
 * @param {string} calendarId
 * @param {Date} timeMin
 * @param {Date} timeMax
 */
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
    calendarId, // we'll map this to our internal connectedCalendar id later
    title: event.summary || '',
    start: event.start.dateTime ?? event.start.date,
    end: event.end.dateTime ?? event.end.date,
    isAllDay: !event.start.dateTime,
  }))
}

/**
 * Fetch events from ALL governing calendars for a given date range.
 * Merges results and tags each event with the internal calendar id.
 *
 * @param {string} accessToken
 * @param {Array} connectedCalendars — [{ id, googleCalendarId, role }]
 * @param {Date} timeMin
 * @param {Date} timeMax
 */
export async function fetchAllGoverningEvents(accessToken, connectedCalendars, timeMin, timeMax) {
  const governing = connectedCalendars.filter(c => c.role === 'governs')
  const results = await Promise.allSettled(
    governing.map(cal =>
      fetchCalendarEvents(accessToken, cal.googleCalendarId, timeMin, timeMax)
        .then(events => events.map(e => ({ ...e, calendarId: cal.id })))
    )
  )
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
}

export const isConfigured = () => Boolean(CLIENT_ID)

// Where "Schedule meeting" sends you — Google Calendar template or an Outlook
// compose deeplink. Zero-effort: the app infers the right calendar; one tap on
// "use Outlook/Google instead" overrides it, and the choice is remembered.
//
// Resolution order (first hit wins):
//   1. explicit override (the user tapped "use X instead") — localStorage
//   2. hint from the calendar they actually connected (guest connect / owner
//      connected calendars: all-Microsoft → outlook, all-Google → google)
//   3. sign-in identity (Supabase auth provider 'azure' → outlook)
//   4. email domain (outlook/hotmail/live/msn → outlook)
//   5. google

const OVERRIDE_KEY = 'coordie-sched-provider'          // explicit user choice
const HINT_KEY = 'coordie-sched-provider-hint'         // set when a calendar is connected

const MS_CONSUMER_DOMAIN = /@(outlook|hotmail|live|msn)\./i

export function getSchedulingOverride() {
  try { return localStorage.getItem(OVERRIDE_KEY) } catch { return null }
}
export function setSchedulingOverride(provider) {
  try {
    if (provider) localStorage.setItem(OVERRIDE_KEY, provider)
    else localStorage.removeItem(OVERRIDE_KEY)
  } catch { /* private mode */ }
}
export function setSchedulingHint(provider) {
  try { localStorage.setItem(HINT_KEY, provider) } catch { /* private mode */ }
}

export function resolveSchedulingProvider({ connectedCalendars = [], authProvider = null, email = null } = {}) {
  const explicit = getSchedulingOverride()
  if (explicit === 'google' || explicit === 'outlook') return explicit
  let hint = null
  try { hint = localStorage.getItem(HINT_KEY) } catch { /* private mode */ }
  if (hint === 'google' || hint === 'outlook') return hint
  const providers = new Set(connectedCalendars.map(c => c.provider || 'google'))
  if (providers.size === 1) return providers.has('microsoft') ? 'outlook' : 'google'
  if (authProvider === 'azure') return 'outlook'
  if (authProvider === 'google') return 'google'
  if (email && MS_CONSUMER_DOMAIN.test(email)) return 'outlook'
  return 'google'
}

/**
 * Open a prefilled new-event page on the resolved provider. Times are naive
 * local datetimes on BOTH providers (no Z) → interpreted in the viewer's own
 * calendar timezone, same behavior as the Google template we've always used.
 * Outlook host: personal MSAs (outlook.com/hotmail/live/msn) live on
 * outlook.live.com; work/school accounts on outlook.office.com.
 */
export function openCalendarTemplate(provider, { title, dateStr, startTime, endTime, details = '', attendees = [], email = null }) {
  const safeTitle = title || 'Meeting'
  if (provider === 'outlook') {
    const host = email && MS_CONSUMER_DOMAIN.test(email) ? 'outlook.live.com' : 'outlook.office.com'
    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: safeTitle,
      startdt: `${dateStr}T${startTime}:00`,
      enddt: `${dateStr}T${endTime}:00`,
      body: details,
    })
    if (attendees.length > 0) params.set('to', attendees.join(','))
    window.open(`https://${host}/calendar/0/deeplink/compose?${params.toString()}`, '_blank', 'noopener,noreferrer')
  } else {
    const datePart = dateStr.replace(/-/g, '')
    const dates = `${datePart}T${startTime.replace(':', '')}00/${datePart}T${endTime.replace(':', '')}00`
    const params = new URLSearchParams({ action: 'TEMPLATE', text: safeTitle, dates, details })
    if (attendees.length > 0) params.set('add', attendees.join(','))
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }
}

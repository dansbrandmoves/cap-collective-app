/**
 * Availability derivation logic
 *
 * Priority order (highest wins):
 * 1. VETO  — event title starts with '*'  → blocked (red)
 * 2. HOLD  — event title starts with '^'  → tentative (orange/indigo)
 * 3. BLOCK — regular event on a 'governs' calendar → booked (amber)
 * 4. CLEAR — no governing events overlap → available (green)
 *
 * Calendars with role 'ignored' or 'informational' have zero effect on slot state.
 * All-day events use Google's exclusive-end convention — subtract 1 day before comparing.
 */

export const SLOT_STATES = {
  available: { label: 'Available',               color: '#d1d5db', bg: 'bg-zinc-300',   text: 'text-zinc-400',   dot: 'bg-zinc-400',   ring: 'ring-zinc-300' },
  hold:      { label: 'Penciled',                color: '#f97316', bg: 'bg-orange-500', text: 'text-orange-400', dot: 'bg-orange-400', ring: 'ring-orange-500' },
  booked:    { label: 'Not Typically Considered', color: '#9ca3af', bg: 'bg-zinc-500',   text: 'text-zinc-400',   dot: 'bg-zinc-500',   ring: 'ring-zinc-500' },
  blocked:   { label: 'Not Available',           color: '#ef4444', bg: 'bg-red-500',    text: 'text-red-400',    dot: 'bg-red-400',    ring: 'ring-red-500' },
}

const PRIORITY = { blocked: 3, booked: 2, hold: 1, available: 0 }

/**
 * Parse a time string "HH:MM" into minutes since midnight.
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

/**
 * Normalize an all-day event's end date: Google returns exclusive end (day after).
 * Convert to a Date at 23:59 of the last actual day.
 */
function normalizeEventRange(event) {
  if (event.isAllDay) {
    const start = new Date(event.start + 'T00:00:00')
    // Subtract 1 day from exclusive end
    const end = new Date(event.end + 'T00:00:00')
    end.setDate(end.getDate() - 1)
    end.setHours(23, 59, 59)
    return { start, end }
  }
  return { start: new Date(event.start), end: new Date(event.end) }
}

/**
 * Check whether a calendar event overlaps a given slot on a given date.
 * @param {Date} date
 * @param {{ startTime: string, endTime: string }} slot
 * @param {object} event
 */
function eventOverlapsSlot(date, slot, event) {
  const { start: evStart, end: evEnd } = normalizeEventRange(event)

  // Event must include this date
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  if (evEnd < dayStart || evStart > dayEnd) return false

  // For all-day events that span this date, they cover the whole day
  if (event.isAllDay) return true

  // For timed events, check time overlap with slot
  const slotStart = timeToMinutes(slot.startTime)
  const slotEnd = timeToMinutes(slot.endTime)

  // Event times relative to this date
  const evStartMins = evStart.getDate() === date.getDate()
    ? evStart.getHours() * 60 + evStart.getMinutes()
    : 0
  const evEndMins = evEnd.getDate() === date.getDate()
    ? evEnd.getHours() * 60 + evEnd.getMinutes()
    : 23 * 60 + 59

  // Overlap: slot start < event end AND slot end > event start
  return slotStart < evEndMins && slotEnd > evStartMins
}

/**
 * Derive the state of a single slot on a single date.
 *
 * @param {Date} date
 * @param {object} slot — { startTime, endTime, defaultState }
 * @param {Array} calendarEvents
 * @param {Array} connectedCalendars — [{ id, role }]
 * @returns {{ state: string, drivingEvent: object|null }}
 */
export function deriveSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules = []) {
  let bestState = slot.defaultState || 'available'
  let drivingEvent = null

  const calendarMap = Object.fromEntries(connectedCalendars.map(c => [c.googleCalendarId, c]))

  for (const event of calendarEvents) {
    const calendar = calendarMap[event.calendarId]
    if (!calendar) continue
    if (calendar.role === 'ignored' || calendar.role === 'informational') continue
    // Only 'governs' calendars affect slot state
    if (calendar.role !== 'governs') continue

    if (!eventOverlapsSlot(date, slot, event)) continue

    const title = event.title || ''
    let eventState

    const matchedRule = prefixRules.find(r => r.prefix && title.startsWith(r.prefix))
    if (matchedRule) {
      eventState = matchedRule.state
    } else {
      // Fall back to this calendar's own default tier
      eventState = calendar.defaultState || 'booked'
    }

    if (PRIORITY[eventState] > PRIORITY[bestState]) {
      bestState = eventState
      drivingEvent = { ...event, calendarName: calendar.name }
    }

    // Short-circuit on veto — nothing can override
    if (bestState === 'blocked') break
  }

  return { state: bestState, drivingEvent }
}

/**
 * Derive availability for a range of dates across all slots.
 * Returns: { [dateStr]: { [slotId]: { state, drivingEvent } } }
 */
export function deriveAvailabilityMatrix(dates, slots, calendarEvents, connectedCalendars, prefixRules = []) {
  const matrix = {}
  for (const date of dates) {
    const key = dateToStr(date)
    matrix[key] = {}
    for (const slot of slots) {
      matrix[key][slot.id] = deriveSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules)
    }
  }
  return matrix
}

/**
 * Format a Date to YYYY-MM-DD string
 */
export function dateToStr(d) {
  return d.toISOString().split('T')[0]
}

/**
 * Get an array of Date objects for a full calendar month (Sun–Sat grid including padding)
 */
export function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days = []

  // Pad start to Sunday
  for (let i = 0; i < firstDay.getDay(); i++) {
    const d = new Date(firstDay)
    d.setDate(d.getDate() - (firstDay.getDay() - i))
    days.push({ date: d, inMonth: false })
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), inMonth: true })
  }

  // Pad end to Saturday
  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(lastDay)
      d.setDate(d.getDate() + i)
      days.push({ date: d, inMonth: false })
    }
  }

  return days
}

/**
 * Get 7 Date objects starting from a given Monday (or any date)
 */
export function getWeekDays(startDate) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    return d
  })
}

/**
 * Get the Monday of the week containing a given date
 */
export function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday start
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

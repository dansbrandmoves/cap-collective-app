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

// Fixed internal semantics (users can override labels/colors in Settings):
// available = open for booking, no conflicts
// hold      = tentatively held, may change
// booked    = occupied by a calendar event
// blocked   = hard block, not available under any circumstances
export const DEFAULT_SLOT_STATES = {
  available: { label: 'Available', color: '#22c55e', bg: 'bg-green-500', text: 'text-green-400', dot: 'bg-green-400', ring: 'ring-green-500' },
  hold:      { label: 'Hold',      color: '#f97316', bg: 'bg-orange-500', text: 'text-orange-400', dot: 'bg-orange-400', ring: 'ring-orange-500' },
  booked:    { label: 'Busy',      color: '#3f3f46', bg: 'bg-zinc-700',   text: 'text-zinc-500',   dot: 'bg-zinc-600',   ring: 'ring-zinc-700' },
  blocked:   { label: 'Blocked',   color: '#52525b', bg: 'bg-zinc-600',   text: 'text-zinc-500',   dot: 'bg-zinc-500',   ring: 'ring-zinc-600' },
}

// Keep a backwards-compatible reference
export const SLOT_STATES = DEFAULT_SLOT_STATES

/**
 * Build customized slot states by merging overrides onto defaults.
 * @param {object} customizations — e.g. { booked: { label: 'Busy', color: '#666' } }
 */
export function buildSlotStates(customizations = {}) {
  const result = {}
  for (const [key, defaults] of Object.entries(DEFAULT_SLOT_STATES)) {
    result[key] = { ...defaults, ...(customizations[key] || {}) }
  }
  return result
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
export function eventOverlapsSlot(date, slot, event) {
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
export function deriveSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules = [], businessHours = null) {
  // Business hours check: if this day is off or slot is outside hours, force blocked
  if (businessHours && businessHours.enabled !== false && businessHours.schedule) {
    const dayOfWeek = date.getDay()
    const dayConfig = businessHours.schedule[dayOfWeek]
    if (!dayConfig) {
      return { state: 'blocked', drivingEvent: null } // day is off
    }
    // Check if slot falls outside this day's hours
    const slotStart = timeToMinutes(slot.startTime)
    const slotEnd = timeToMinutes(slot.endTime)
    const dayStart = timeToMinutes(dayConfig.start)
    const dayEnd = timeToMinutes(dayConfig.end)
    if (slotEnd <= dayStart || slotStart >= dayEnd) {
      return { state: 'blocked', drivingEvent: null } // outside hours
    }
  }

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

/* ──────────────────────────────────────────────────────────────────────────
 * explainSlotState — the diagnostics "eyes" on derivation.
 *
 * Same logic as deriveSlotState, but instead of just returning the answer it
 * records EVERY decision: which calendar each event belongs to, whether that
 * calendar governs, the event's stored (UTC) time vs. the local-time minutes the
 * overlap math actually uses, whether it overlapped, the rule/tier it resolved
 * to, and which event ended up driving the state. This is what makes a bug like
 * "owner shows free at 11am despite an overlapping event" instantly diagnosable:
 * you can see at a glance whether the event was missing, on a non-governing
 * calendar, or simply interpreted in the wrong timezone.
 *
 * The authoritative overlap decision still comes from eventOverlapsSlot(), so the
 * trace can never disagree with the real engine. (Parity asserted in tests.)
 * ────────────────────────────────────────────────────────────────────────── */
export function explainSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules = [], businessHours = null, timeZone = null) {
  const trace = { slotId: slot.id, slotName: slot.name, slotTime: `${slot.startTime}–${slot.endTime}` }
  const slotStart = timeToMinutes(slot.startTime)
  const slotEnd = timeToMinutes(slot.endTime)
  trace.slotMinutes = { start: slotStart, end: slotEnd }

  // Business-hours gate (mirrors deriveSlotState exactly)
  if (businessHours && businessHours.enabled !== false && businessHours.schedule) {
    const dayConfig = businessHours.schedule[date.getDay()]
    if (!dayConfig) {
      return { state: 'blocked', drivingEvent: null, trace: { ...trace, businessHours: { applied: true, reason: 'day-off' }, events: [] } }
    }
    const dayStart = timeToMinutes(dayConfig.start)
    const dayEnd = timeToMinutes(dayConfig.end)
    if (slotEnd <= dayStart || slotStart >= dayEnd) {
      return { state: 'blocked', drivingEvent: null, trace: { ...trace, businessHours: { applied: true, reason: 'outside-hours', dayConfig }, events: [] } }
    }
    trace.businessHours = { applied: true, reason: null, dayConfig }
  } else {
    trace.businessHours = { applied: false }
  }

  const defaultState = slot.defaultState || 'available'
  trace.defaultState = defaultState
  let bestState = defaultState
  let drivingEvent = null

  const calendarMap = Object.fromEntries(connectedCalendars.map(c => [c.googleCalendarId, c]))
  const fmtLocal = (iso) => {
    if (!iso) return null
    try { return new Date(iso).toLocaleString('en-US', timeZone ? { timeZone, hour12: true, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { hour12: true, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
    catch { return iso }
  }

  const events = []
  for (const event of calendarEvents) {
    const calendar = calendarMap[event.calendarId]
    const row = {
      title: event.title || '(untitled)',
      calendarId: event.calendarId,
      provider: calendar?.provider || (String(event.calendarId || '').startsWith('ms:') ? 'microsoft' : 'google'),
      calendarName: calendar?.name || null,
      calendarKnown: !!calendar,
      role: calendar?.role || null,
      isAllDay: !!event.isAllDay,
      rawStart: event.start,
      rawEnd: event.end,
      localStart: fmtLocal(event.start),
      localEnd: fmtLocal(event.end),
    }

    if (!calendar) { row.skippedReason = 'unknown-calendar'; events.push(row); continue }
    if (calendar.role !== 'governs') { row.skippedReason = calendar.role || 'non-governing'; events.push(row); continue }

    // Minutes-of-day the overlap math uses (browser-local) — exposes tz bugs.
    if (!event.isAllDay) {
      const evStart = new Date(event.start)
      const evEnd = new Date(event.end)
      row.evMinutes = {
        start: evStart.getDate() === date.getDate() ? evStart.getHours() * 60 + evStart.getMinutes() : 0,
        end: evEnd.getDate() === date.getDate() ? evEnd.getHours() * 60 + evEnd.getMinutes() : 23 * 60 + 59,
      }
    }

    const overlaps = eventOverlapsSlot(date, slot, event)
    row.overlaps = overlaps
    if (!overlaps) { row.skippedReason = 'no-overlap'; events.push(row); continue }

    const title = event.title || ''
    const matchedRule = prefixRules.find(r => r.prefix && title.startsWith(r.prefix))
    const eventState = matchedRule ? matchedRule.state : (calendar.defaultState || 'booked')
    row.matchedRule = matchedRule?.prefix || null
    row.eventState = eventState

    if (PRIORITY[eventState] > PRIORITY[bestState]) {
      bestState = eventState
      drivingEvent = { ...event, calendarName: calendar.name }
      row.becameDriving = true
    }
    events.push(row)
  }

  trace.events = events
  trace.finalState = bestState
  return { state: bestState, drivingEvent, trace }
}

/**
 * Derive availability for a range of dates across all slots.
 * Returns: { [dateStr]: { [slotId]: { state, drivingEvent } } }
 */
export function deriveAvailabilityMatrix(dates, slots, calendarEvents, connectedCalendars, prefixRules = [], businessHours = null) {
  const matrix = {}
  for (const date of dates) {
    const key = dateToStr(date)
    matrix[key] = {}
    for (const slot of slots) {
      matrix[key][slot.id] = deriveSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules, businessHours)
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

  // Pad end so the grid is always 6 full rows (42 cells). Consistent
  // calendar height across all months — prevents layout jump when
  // navigating between 5-row and 6-row months.
  while (days.length < 42) {
    const last = days[days.length - 1].date
    const d = new Date(last)
    d.setDate(d.getDate() + 1)
    days.push({ date: d, inMonth: false })
  }

  return days
}

/**
 * Trim trailing weeks that are entirely outside the month, so a calendar never
 * renders a blank 7-day row at the bottom. (getMonthGrid pads to a fixed 6 rows
 * for layout stability; this is for views that prefer only as many rows as needed.)
 */
export function trimBlankWeeks(grid) {
  const weeks = []
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7))
  while (weeks.length > 1 && weeks[weeks.length - 1].every(c => !c.inMonth)) weeks.pop()
  return weeks.flat()
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

/* ──────────────────────────────────────────────────────────────────────────
 * Project-level aggregation — "when can everyone do this?"
 *
 * Generalizes the single-room BestDaysStrip merge logic to span every group
 * (room) in a project. A "person" is identified by name string (no global IDs
 * yet), so same-named people across groups merge — acceptable for v1.
 *
 * IMPORTANT data asymmetry: shared_availability stores only POSITIVE (free) rows
 * for the next ~60 days. "Absent from the set" therefore means UNKNOWN, never
 * busy. That's why the signal denominator is knownCount (people with any signal
 * anywhere in the project), not a full member roster.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Resolve a project's effective slots from its availability_config, falling back
 * to the owner's global effectiveSlots. Mirrors the per-room/RoomView derivation
 * so the project overview uses the same slots the guests see.
 */
export function projectSlotsFromConfig(config, effectiveSlots) {
  if (!config) return effectiveSlots
  if (config.mode === 'slots') return config.customSlots || effectiveSlots
  const schedule = config.businessHours?.schedule || {}
  let earliest = '23:59', latest = '00:00'
  for (const day of Object.values(schedule)) {
    if (!day) continue
    if (day.start < earliest) earliest = day.start
    if (day.end > latest) latest = day.end
  }
  if (earliest >= latest) return effectiveSlots
  const dur = config.blockDuration || 30
  const generated = []
  let [h, m] = earliest.split(':').map(Number)
  const endMins = latest.split(':').map(Number).reduce((a, b, i) => a + (i === 0 ? b * 60 : b), 0)
  while (h * 60 + m + dur <= endMins) {
    const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const te = h * 60 + m + dur
    const end = `${String(Math.floor(te / 60)).padStart(2, '0')}:${String(te % 60).padStart(2, '0')}`
    const period = h >= 12 ? 'PM' : 'AM'
    generated.push({ id: `block-${start}`, name: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`, startTime: start, endTime: end, color: '#22c55e', defaultState: 'available' })
    m += dur
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60 }
  }
  return generated
}

const ACTIVE_REQUEST = r => r.status !== 'declined' && r.status !== 'archived'

function cleanNameSet(names) {
  const set = new Set(names)
  set.delete(undefined); set.delete(null); set.delete('')
  return set
}

/**
 * Distinct people who have ANY availability signal anywhere in the project.
 * This is the denominator for the day signal — everyone "connected" so far.
 */
export function projectKnownPeople(rooms, dateRequestsByRoom, sharedAvailByRoom) {
  const names = []
  for (const room of rooms) {
    for (const r of (dateRequestsByRoom[room.id] || []).filter(ACTIVE_REQUEST)) names.push(r.requester_name)
    for (const a of (sharedAvailByRoom[room.id] || [])) { if (a.is_available) names.push(a.guest_name) }
  }
  return cleanNameSet(names)
}

/**
 * Aggregate one day across all groups in a project.
 * @returns {{ perRoom: Array<{roomId,roomName,freeNames:string[],totalKnown:number}>,
 *             freeCount: number, knownCount: number }}
 */
export function aggregateProjectDay(dateStr, rooms, dateRequestsByRoom, sharedAvailByRoom) {
  const allFree = []
  const perRoom = rooms.map(room => {
    const reqs = (dateRequestsByRoom[room.id] || []).filter(ACTIVE_REQUEST)
    const avail = sharedAvailByRoom[room.id] || []

    const free = cleanNameSet([
      ...reqs.filter(r => r.dates?.includes(dateStr)).map(r => r.requester_name),
      ...avail.filter(a => a.date === dateStr && a.is_available).map(a => a.guest_name),
    ])
    const known = cleanNameSet([
      ...reqs.map(r => r.requester_name),
      ...avail.filter(a => a.is_available).map(a => a.guest_name),
    ])
    free.forEach(n => allFree.push(n))
    return { roomId: room.id, roomName: room.name, freeNames: [...free], totalKnown: known.size }
  })

  const knownCount = projectKnownPeople(rooms, dateRequestsByRoom, sharedAvailByRoom).size
  return { perRoom, freeCount: cleanNameSet(allFree).size, knownCount }
}

export const PROJECT_DAY_AMBER_RATIO = 0.5

/**
 * Map a day's aggregate to a traffic-light signal.
 * gray  — no signal yet, OR owner is not free (owner's own block is not a
 *         negotiable guest conflict, so it reads neutral, not red).
 * green — owner free and everyone known is free.
 * amber — owner free and at least half of known people are free.
 * red   — owner free but under half are free (a real scheduling conflict).
 */
export function projectDaySignal(ownerFree, freeCount, knownCount) {
  if (!ownerFree || knownCount === 0) return 'gray'
  if (freeCount === knownCount) return 'green'
  if (freeCount / knownCount >= PROJECT_DAY_AMBER_RATIO) return 'amber'
  return 'red'
}

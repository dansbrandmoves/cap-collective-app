// Logic regression tests for the availability engine — pure functions, no DB/auth.
// Run with `npm test` (uses Node's built-in test runner, zero dependencies).
// These guard the math that every calendar surface depends on; run them between
// phases of the unified-calendar / bookings work.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dateToStr, eventOverlapsSlot, deriveSlotState, explainSlotState, projectSlotsFromConfig,
  aggregateProjectDay, projectDaySignal, projectKnownPeople, getMonthGrid,
} from '../src/utils/availability.js'

const SLOT = { id: 's1', startTime: '09:00', endTime: '10:00', defaultState: 'available' }
const JUN10 = new Date(2026, 5, 10) // Wednesday, dow=3
const GOVERNS = [{ googleCalendarId: 'primary', role: 'governs', defaultState: 'booked', name: 'Primary' }]
const PREFIX = [{ prefix: '*', state: 'blocked' }, { prefix: '^', state: 'hold' }]

test('dateToStr formats YYYY-MM-DD', () => {
  assert.equal(dateToStr(new Date(2026, 5, 10)), '2026-06-10')
})

test('eventOverlapsSlot: timed overlap / non-overlap / all-day', () => {
  const timed = { start: '2026-06-10T09:30:00', end: '2026-06-10T09:45:00', isAllDay: false }
  assert.equal(eventOverlapsSlot(JUN10, SLOT, timed), true)
  const after = { start: '2026-06-10T11:00:00', end: '2026-06-10T12:00:00', isAllDay: false }
  assert.equal(eventOverlapsSlot(JUN10, SLOT, after), false)
  const allDay = { start: '2026-06-10', end: '2026-06-11', isAllDay: true } // exclusive end
  assert.equal(eventOverlapsSlot(JUN10, SLOT, allDay), true)
})

test('deriveSlotState: clear / booked / veto / hold / ignored', () => {
  // No events → available
  assert.equal(deriveSlotState(JUN10, SLOT, [], GOVERNS, PREFIX, null).state, 'available')
  // Governing event → booked
  const ev = t => ([{ calendarId: 'primary', title: t, start: '2026-06-10T09:30:00', end: '2026-06-10T09:45:00', isAllDay: false }])
  assert.equal(deriveSlotState(JUN10, SLOT, ev('Standup'), GOVERNS, PREFIX, null).state, 'booked')
  // '*' veto → blocked, '^' → hold
  assert.equal(deriveSlotState(JUN10, SLOT, ev('*Closed'), GOVERNS, PREFIX, null).state, 'blocked')
  assert.equal(deriveSlotState(JUN10, SLOT, ev('^Maybe'), GOVERNS, PREFIX, null).state, 'hold')
  // Ignored calendar → no effect
  const ignored = [{ googleCalendarId: 'primary', role: 'ignored', name: 'P' }]
  assert.equal(deriveSlotState(JUN10, SLOT, ev('Standup'), ignored, PREFIX, null).state, 'available')
})

test('deriveSlotState: business-hours off-day forces blocked', () => {
  // schedule only defines Monday(1); Wednesday(3) is undefined → off → blocked
  const bh = { schedule: { 1: { start: '09:00', end: '17:00' } } }
  assert.equal(deriveSlotState(JUN10, SLOT, [], GOVERNS, PREFIX, bh).state, 'blocked')
})

test('projectSlotsFromConfig: fallback / slots mode / blocks generation', () => {
  const fallback = [SLOT]
  assert.equal(projectSlotsFromConfig(null, fallback), fallback)
  const custom = [{ id: 'c1' }]
  assert.deepEqual(projectSlotsFromConfig({ mode: 'slots', customSlots: custom }, fallback), custom)
  const blocks = projectSlotsFromConfig(
    { mode: 'blocks', blockDuration: 60, businessHours: { schedule: { 1: { start: '09:00', end: '11:00' } } } },
    fallback
  )
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].startTime, '09:00')
  assert.equal(blocks[1].startTime, '10:00')
})

const ROOMS = [{ id: 'r1', name: 'Clients' }, { id: 'r2', name: 'Crew' }]
const REQ = {
  r1: [
    { room_id: 'r1', requester_name: 'Ana', dates: ['2026-06-10'], status: 'pending' },
    { room_id: 'r1', requester_name: 'Bo', dates: ['2026-06-10'], status: 'declined' },
  ],
  r2: [{ room_id: 'r2', requester_name: 'Cy', dates: ['2026-06-10', '2026-06-12'], status: 'pending' }],
}
const AVAIL = {
  r1: [
    { room_id: 'r1', guest_name: 'Dee', date: '2026-06-10', is_available: true },
    { room_id: 'r1', guest_name: 'Ana', date: '2026-06-12', is_available: true },
  ],
  r2: [],
}

test('projectKnownPeople excludes declined requesters', () => {
  const known = projectKnownPeople(ROOMS, REQ, AVAIL)
  assert.deepEqual([...known].sort(), ['Ana', 'Cy', 'Dee'])
})

test('aggregateProjectDay counts distinct free people across rooms', () => {
  const d10 = aggregateProjectDay('2026-06-10', ROOMS, REQ, AVAIL)
  assert.equal(d10.freeCount, 3)   // Ana, Dee (Clients) + Cy (Crew); Bo declined
  assert.equal(d10.knownCount, 3)
  const d12 = aggregateProjectDay('2026-06-12', ROOMS, REQ, AVAIL)
  assert.equal(d12.freeCount, 2)   // Ana (shared) + Cy (request)
  assert.equal(d12.knownCount, 3)
})

test('projectDaySignal thresholds', () => {
  assert.equal(projectDaySignal(true, 3, 3), 'green')
  assert.equal(projectDaySignal(true, 2, 3), 'amber') // .67
  assert.equal(projectDaySignal(true, 1, 3), 'red')   // .33
  assert.equal(projectDaySignal(false, 3, 3), 'gray') // owner busy
  assert.equal(projectDaySignal(true, 0, 0), 'gray')  // no signal
})

test('getMonthGrid returns 42 cells with 30 in-month for June 2026', () => {
  const grid = getMonthGrid(2026, 5)
  assert.equal(grid.length, 42)
  assert.equal(grid.filter(c => c.inMonth).length, 30)
})

test('explainSlotState mirrors deriveSlotState exactly (parity) + emits trace', () => {
  const ev = t => ([{ calendarId: 'primary', title: t, start: '2026-06-10T09:30:00', end: '2026-06-10T09:45:00', isAllDay: false }])
  const cases = [
    [[], GOVERNS, PREFIX, null],
    [ev('Standup'), GOVERNS, PREFIX, null],
    [ev('*Closed'), GOVERNS, PREFIX, null],
    [ev('^Maybe'), GOVERNS, PREFIX, null],
    [ev('Standup'), [{ googleCalendarId: 'primary', role: 'ignored', name: 'P' }], PREFIX, null],
  ]
  for (const [events, cals, prefix, bh] of cases) {
    const truth = deriveSlotState(JUN10, SLOT, events, cals, prefix, bh)
    const explained = explainSlotState(JUN10, SLOT, events, cals, prefix, bh)
    assert.equal(explained.state, truth.state)
    assert.ok(Array.isArray(explained.trace.events))
  }
})

test('explainSlotState trace surfaces a non-overlapping governing event with reason', () => {
  const evt = [{ calendarId: 'primary', title: 'Later', start: '2026-06-10T11:00:00', end: '2026-06-10T12:00:00', isAllDay: false }]
  const { state, trace } = explainSlotState(JUN10, SLOT, evt, GOVERNS, PREFIX, null)
  assert.equal(state, 'available')          // 11am event doesn't touch the 9–10 slot
  assert.equal(trace.events.length, 1)
  assert.equal(trace.events[0].overlaps, false)
  assert.equal(trace.events[0].skippedReason, 'no-overlap')
})

test('explainSlotState flags an event on an unknown (not-connected) calendar', () => {
  const evt = [{ calendarId: 'ms:abc', title: 'Outlook thing', start: '2026-06-10T09:30:00', end: '2026-06-10T09:45:00', isAllDay: false }]
  const { trace } = explainSlotState(JUN10, SLOT, evt, GOVERNS, PREFIX, null) // GOVERNS only has 'primary'
  assert.equal(trace.events[0].calendarKnown, false)
  assert.equal(trace.events[0].skippedReason, 'unknown-calendar')
  assert.equal(trace.events[0].provider, 'microsoft')
})

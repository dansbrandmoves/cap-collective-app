// Time-of-day windows (minutes since midnight), shared by the project calendar,
// the day inspector, and booking pages so they never drift apart.
//
// NOTE: there are TWO window predicates on purpose — they mean different things:
//   - slotOverlapsWindow: a slot counts if it overlaps the window at all (project /
//     day-inspector "ideal time slots"). A 11:45–12:15 slot counts for both morning
//     and afternoon.
//   - slotStartsInWindow: a slot counts only if its START falls in the window
//     (booking page time list). That 11:45 slot counts for morning only.
// Don't collapse these into one — it would silently change one surface's behavior.

export const WINDOWS = {
  any:       { label: 'Any time',  start: 0,        end: 24 * 60 },
  morning:   { label: 'Morning',   start: 5 * 60,   end: 12 * 60 },
  afternoon: { label: 'Afternoon', start: 12 * 60,  end: 17 * 60 },
  evening:   { label: 'Evening',   start: 17 * 60,  end: 23 * 60 },
}

export const WINDOW_ORDER = ['any', 'morning', 'afternoon', 'evening']

// "HH:MM" -> minutes since midnight.
export const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }

// Slot overlaps the window at all (project view + day inspector).
export const slotOverlapsWindow = (slot, w) => toMin(slot.startTime) < w.end && toMin(slot.endTime) > w.start

// Slot's start time falls within the window (booking page list).
export const slotStartsInWindow = (slot, w) => { const s = toMin(slot.startTime); return s >= w.start && s < w.end }

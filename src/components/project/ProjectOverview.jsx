import { useState, useMemo } from 'react'
import { DayInspectorPanel } from '../availability/AvailabilityCalendar'
import {
  getMonthGrid, dateToStr, deriveSlotState,
  aggregateProjectDay, projectKnownPeople,
} from '../../utils/availability'
import { OWNER_LABEL } from '../../hooks/useProjectPeople'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// One signal only: green = everyone's free. Partial/conflict/unknown days stay
// neutral and let the count speak — no traffic-light noise.
const SIGNAL = {
  green: { dot: '#22c55e', cell: 'bg-green-500/[0.06] border-green-500/15 hover:bg-green-500/[0.12] hover:border-green-500/35' },
}

// Time-of-day windows (minutes since midnight). A slot counts toward a window
// if it overlaps it at all. "Any time" spans the whole day.
const WINDOWS = {
  any:       { label: 'Any time',  start: 0,        end: 24 * 60 },
  morning:   { label: 'Morning',   start: 5 * 60,   end: 12 * 60 },
  afternoon: { label: 'Afternoon', start: 12 * 60,  end: 17 * 60 },
  evening:   { label: 'Evening',   start: 17 * 60,  end: 23 * 60 },
}
const WINDOW_ORDER = ['any', 'morning', 'afternoon', 'evening']
const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }
const slotInWindow = (slot, w) => toMin(slot.startTime) < w.end && toMin(slot.endTime) > w.start
const dedupeNames = (arr) => {
  const s = new Set(arr)
  s.delete(undefined); s.delete(null); s.delete('')
  return s
}

// Calendar-only project view. People selection now lives in the project left
// panel (PeopleRoster); this component receives the shared availability data +
// the current exclusion set and renders Best Days + the month grid + inspector.
export function ProjectOverview({
  production, slots, calendarEvents, connectedCalendars, prefixRules, businessHours,
  loading, dateRequestsByRoom = {}, sharedAvailByRoom = {}, excluded, includedOwner, totalPeople = 0,
}) {
  const rooms = production.rooms || []

  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [inspected, setInspected] = useState(null) // dateStr
  const [windowKey, setWindowKey] = useState('any') // 'any' | 'morning' | 'afternoon' | 'evening'
  const win = WINDOWS[windowKey]

  // Filtered copies of the room maps with excluded people removed.
  const fReq = useMemo(() => {
    const out = {}
    for (const [rid, arr] of Object.entries(dateRequestsByRoom)) out[rid] = arr.filter(r => !excluded.has(r.requester_name))
    return out
  }, [dateRequestsByRoom, excluded])
  const fAvail = useMemo(() => {
    const out = {}
    for (const [rid, arr] of Object.entries(sharedAvailByRoom)) out[rid] = arr.filter(a => !excluded.has(a.guest_name))
    return out
  }, [sharedAvailByRoom, excluded])

  const grid = useMemo(() => getMonthGrid(year, month), [year, month])

  // Owner is free in the window if they have an available slot overlapping it.
  // ("Any time" → every slot qualifies, so this reduces to "free at all that day".)
  function ownerFreeInWindow(date, w) {
    return slots.some(slot =>
      slotInWindow(slot, w) &&
      deriveSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules, businessHours).state === 'available')
  }

  // Guests free on a day, filtered by the chosen window. A day-level response
  // ("that day works") counts for any window; a slot-level response only counts
  // if at least one of their picked slots overlaps the window.
  function guestFreeNamesInWindow(ds, w) {
    const names = []
    for (const room of rooms) {
      for (const r of (fReq[room.id] || [])) {
        if (!r.dates?.includes(ds)) continue
        const slotIds = r.slot_map?.[ds]
        if (Array.isArray(slotIds) && slotIds.length) {
          const theirSlots = slots.filter(s => slotIds.includes(s.id))
          if (theirSlots.some(s => slotInWindow(s, w))) names.push(r.requester_name)
        } else {
          names.push(r.requester_name) // day-level → any window
        }
      }
      for (const a of (fAvail[room.id] || [])) {
        if (a.date === ds && a.is_available) names.push(a.guest_name) // day-level
      }
    }
    return dedupeNames(names)
  }

  function dayCounts(date, ds, w) {
    const knownCount = includedKnown
    const freeCount = guestFreeNamesInWindow(ds, w).size + (includedOwner && ownerFreeInWindow(date, w) ? 1 : 0)
    return { freeCount, knownCount }
  }

  const includedKnown = useMemo(
    () => projectKnownPeople(rooms, fReq, fAvail).size + (includedOwner ? 1 : 0),
    [rooms, fReq, fAvail, includedOwner]
  )

  const dayInfo = useMemo(() => {
    const map = {}
    for (const { date, inMonth } of grid) {
      if (!inMonth) continue
      const ds = dateToStr(date)
      const { freeCount, knownCount } = dayCounts(date, ds, win)
      map[ds] = { freeCount, knownCount }
    }
    return map
  }, [grid, rooms, fReq, fAvail, includedOwner, includedKnown, slots, calendarEvents, connectedCalendars, prefixRules, businessHours, windowKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Best days: scan next 60 days for highest free-counts in the chosen window.
  const bestDays = useMemo(() => {
    if (includedKnown === 0) return []
    const out = []
    for (let i = 0; i < 60; i++) {
      const date = new Date(today); date.setDate(today.getDate() + i)
      const ds = dateToStr(date)
      const { freeCount, knownCount } = dayCounts(date, ds, win)
      if (freeCount > 0) out.push({ ds, date, freeCount, knownCount })
    }
    return out.sort((a, b) => b.freeCount - a.freeCount || new Date(a.ds) - new Date(b.ds)).slice(0, 3)
  }, [includedKnown, includedOwner, rooms, fReq, fAvail, slots, calendarEvents, connectedCalendars, prefixRules, businessHours, windowKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const inspectorData = useMemo(() => {
    if (!inspected) return null
    const reqs = []
    const avail = []
    for (const room of rooms) {
      for (const r of (fReq[room.id] || [])) {
        if (r.dates?.includes(inspected) && r.status !== 'declined' && r.status !== 'archived') reqs.push(r)
      }
      for (const a of (fAvail[room.id] || [])) {
        if (a.date === inspected && a.is_available) avail.push(a)
      }
    }
    if (includedOwner && ownerFreeInWindow(new Date(inspected + 'T00:00:00'), WINDOWS.any)) {
      avail.push({ date: inspected, is_available: true, guest_name: OWNER_LABEL })
    }
    return { reqs, avail }
  }, [inspected, rooms, fReq, fAvail, includedOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  function goToday() { setMonth(today.getMonth()); setYear(today.getFullYear()) }

  const todayStr = dateToStr(today)

  return (
    <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8">
      <div className="lg:flex lg:gap-5 lg:items-start">
      <div className="flex-1 min-w-0">

      {/* Schedule a meeting — pick a time of day, see which days work for everyone */}
      {includedKnown > 0 ? (
        <div className="mb-6 bg-surface-800/40 border border-white/[0.06] rounded-xl px-4 py-4">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Schedule a meeting</p>
              <p className="text-[15px] text-zinc-100 font-medium mt-1 tracking-tight">
                When can everyone meet{windowKey !== 'any' ? ` in the ${win.label.toLowerCase()}` : ''}?
              </p>
            </div>
            <span className="text-[11px] text-zinc-600 flex-shrink-0 whitespace-nowrap">
              {includedKnown} {includedKnown === 1 ? 'person' : 'people'}
            </span>
          </div>

          {/* Time-of-day filter */}
          <div className="inline-flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.05] rounded-lg p-0.5 mb-3.5">
            {WINDOW_ORDER.map(key => (
              <button key={key} onClick={() => setWindowKey(key)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 ease-ios ${
                  windowKey === key ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400 hover:text-zinc-100'
                }`}>
                {WINDOWS[key].label}
              </button>
            ))}
          </div>

          {/* Days that work, ranked */}
          {bestDays.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {bestDays.map(({ ds, date, freeCount, knownCount }) => {
                const allFree = freeCount === knownCount
                return (
                  <button key={ds} onClick={() => setInspected(ds)}
                    className={`text-left rounded-lg px-3 py-2 border transition-all duration-150 ease-ios ${
                      allFree
                        ? 'bg-green-500/[0.06] border-green-500/20 hover:bg-green-500/[0.12] hover:border-green-500/40'
                        : 'bg-surface-900 border-white/[0.06] hover:bg-surface-800 hover:border-white/[0.14]'
                    }`}>
                    <p className="text-[13px] font-semibold text-zinc-100 tracking-tight">
                      {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${allFree ? 'text-green-400' : 'text-amber-400'}`}>
                      {allFree ? 'Everyone free' : `${freeCount} of ${knownCount} free`}
                    </p>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-[13px] text-zinc-500 leading-relaxed">
              No one&rsquo;s free {windowKey === 'any' ? 'on the next 60 days yet' : `in the ${win.label.toLowerCase()}`}.
              {windowKey !== 'any' && ' Try another time of day.'}
            </p>
          )}
        </div>
      ) : totalPeople <= 1 ? (
        <div className="mb-6 border border-dashed border-white/10 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-zinc-200 mb-0.5">No availability yet</p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Add people in the panel on the left and share their links. As they connect a calendar or tap their free days, the best days for everyone appear here.
          </p>
        </div>
      ) : null}

      {/* Legend — one signal: green means everyone's free. Counts say the rest. */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full ring-2 ring-surface-900" style={{ backgroundColor: SIGNAL.green.dot }} />
        <span className="text-[13px] text-zinc-400">Everyone free</span>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-[15px] font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
          {MONTH_NAMES[month]} {year}
          {windowKey !== 'any' && (
            <button onClick={() => setWindowKey('any')}
              title="Showing morning/afternoon/evening availability — tap to clear"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent bg-accent/10 border border-accent/20 rounded-full pl-2 pr-1.5 py-0.5 hover:bg-accent/15 transition-colors">
              {win.label}
              <span className="text-accent/70">×</span>
            </button>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="min-h-[36px] text-[13px] font-medium text-zinc-400 hover:text-zinc-100 px-3 rounded-lg hover:bg-white/5 transition-colors">Today</button>
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors"><span className="text-lg leading-none">‹</span></button>
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors"><span className="text-lg leading-none">›</span></button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-zinc-600 py-1">
            <span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }, i) => {
          const ds = dateToStr(date)
          const info = dayInfo[ds]
          const isToday = ds === todayStr
          if (!inMonth) {
            return <div key={i} className="min-h-[52px] sm:min-h-[72px] rounded-lg" />
          }
          // Only highlight days where EVERYONE is free. Everything else is a plain
          // cell — the count speaks for itself, no amber/red noise.
          const hasData = info && info.knownCount > 0
          const allFree = hasData && info.freeCount === info.knownCount
          return (
            <button
              key={i}
              onClick={() => setInspected(ds)}
              className={`min-h-[52px] sm:min-h-[72px] rounded-lg border p-1.5 sm:p-2 text-left transition-all duration-150 ${
                allFree ? SIGNAL.green.cell : 'bg-white/[0.02] border-white/[0.05] hover:border-white/12'
              } ${loading ? 'opacity-60' : ''}`}
            >
              <span className={`text-[12px] sm:text-[13px] font-medium ${isToday ? 'text-accent' : 'text-zinc-300'}`}>
                {date.getDate()}
              </span>
              {hasData && (
                <span className={`block text-[10px] sm:text-[11px] font-semibold mt-1 ${allFree ? 'text-green-400' : 'text-zinc-500'}`}>
                  {info.freeCount}/{info.knownCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-zinc-600 mt-4">Availability is known for the next 60 days.</p>
      </div>{/* /main column */}

      {inspected && inspectorData && (
        <DayInspectorPanel
          dateStr={inspected}
          roomIds={rooms.map(r => r.id)}
          slots={slots}
          dateRequests={inspectorData.reqs}
          sharedAvailability={inspectorData.avail}
          actionLabel="Schedule meeting"
          onClose={() => setInspected(null)}
        />
      )}
      </div>{/* /split row */}
    </div>
  )
}

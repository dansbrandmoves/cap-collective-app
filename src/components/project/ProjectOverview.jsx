import { useState, useMemo } from 'react'
import { DayInspectorPanel } from '../availability/AvailabilityCalendar'
import {
  getMonthGrid, dateToStr, deriveSlotState,
  aggregateProjectDay, projectKnownPeople,
} from '../../utils/availability'
import { OWNER_LABEL } from '../../hooks/useProjectPeople'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// One signal only: green = everyone's free. Partial/conflict/unknown days stay
// neutral and let the count speak — no traffic-light noise.

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
    <div className="flex-1 overflow-y-auto px-5 sm:px-8 lg:px-12 py-8 sm:py-12">
      <div className="lg:flex lg:gap-5 lg:items-start">
      <div className="flex-1 min-w-0">

      {/* Schedule a meeting — calm, spacious, one question at a time (booking aesthetic) */}
      {includedKnown > 0 ? (
        <div className="mb-10">
          <p className="text-[12px] font-semibold text-accent uppercase tracking-[0.12em] mb-2">Schedule a meeting</p>
          <h2 className="text-[26px] sm:text-[32px] font-semibold text-zinc-50 leading-[1.1] tracking-tight mb-1">
            When can everyone meet{windowKey !== 'any' ? <> in the <span className="text-accent">{win.label.toLowerCase()}</span></> : ''}?
          </h2>
          <p className="text-[14px] text-zinc-500 mb-6">Across {includedKnown} {includedKnown === 1 ? 'person' : 'people'} · next 60 days</p>

          {/* Time-of-day filter */}
          <div className="inline-flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.05] rounded-xl p-1 mb-6">
            {WINDOW_ORDER.map(key => (
              <button key={key} onClick={() => setWindowKey(key)}
                className={`px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ease-ios ${
                  windowKey === key ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400 hover:text-zinc-100'
                }`}>
                {WINDOWS[key].label}
              </button>
            ))}
          </div>

          {/* Days that work, ranked — bigger, airier cards */}
          {bestDays.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {bestDays.map(({ ds, date, freeCount, knownCount }) => {
                const allFree = freeCount === knownCount
                return (
                  <button key={ds} onClick={() => setInspected(ds)}
                    className={`text-left rounded-2xl px-4 py-3 border transition-all duration-150 ease-ios active:scale-[0.99] ${
                      allFree
                        ? 'bg-green-500/[0.08] border-green-500/25 hover:bg-green-500/[0.14] hover:border-green-500/45'
                        : 'border-white/[0.08] hover:bg-white/[0.03] hover:border-white/[0.16]'
                    }`}>
                    <p className="text-[15px] font-semibold text-zinc-50 tracking-tight">
                      {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className={`text-[12px] mt-0.5 ${allFree ? 'text-green-400' : 'text-zinc-500'}`}>
                      {allFree ? 'Everyone free' : `${freeCount} of ${knownCount} free`}
                    </p>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-[14px] text-zinc-500 leading-relaxed">
              No one&rsquo;s free {windowKey === 'any' ? 'on the next 60 days yet' : `in the ${win.label.toLowerCase()}`}.
              {windowKey !== 'any' && ' Try another time of day.'}
            </p>
          )}
        </div>
      ) : totalPeople <= 1 ? (
        <div className="mb-10 border border-dashed border-white/10 rounded-2xl px-6 py-8 text-center max-w-md">
          <p className="text-[15px] font-medium text-zinc-200 mb-1">No availability yet</p>
          <p className="text-[13px] text-zinc-500 leading-relaxed">
            Add people on the left and share their links. As they connect a calendar or tap their free days, the best days appear here.
          </p>
        </div>
      ) : null}

      {/* Month nav — calmer, more room */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-[18px] font-semibold text-zinc-100 tracking-tight flex items-center gap-2.5">
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
        <div className="flex items-center gap-1.5">
          <button onClick={goToday} className="min-h-[36px] text-[13px] font-medium text-zinc-400 hover:text-zinc-100 px-3 rounded-lg hover:bg-white/5 transition-colors">Today</button>
          <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors"><ChevronLeft size={18} strokeWidth={1.75} /></button>
          <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors"><ChevronRight size={18} strokeWidth={1.75} /></button>
        </div>
      </div>

      {/* Grid — bigger, rounder, lighter cells (booking aesthetic) */}
      <div className="grid grid-cols-7 mb-2">
        {DOW.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.1em] py-1.5">
            <span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {grid.map(({ date, inMonth }, i) => {
          const ds = dateToStr(date)
          const info = dayInfo[ds]
          const isToday = ds === todayStr
          if (!inMonth) {
            return <div key={i} className="min-h-[56px] sm:min-h-[76px] rounded-2xl" />
          }
          // Only highlight days where EVERYONE is free. Everything else is a plain,
          // borderless cell — the count speaks for itself.
          const hasData = info && info.knownCount > 0
          const allFree = hasData && info.freeCount === info.knownCount
          return (
            <button
              key={i}
              onClick={() => setInspected(ds)}
              className={`min-h-[56px] sm:min-h-[76px] rounded-2xl p-2 text-left transition-all duration-150 ${
                allFree
                  ? 'bg-green-500/[0.10] hover:bg-green-500/[0.16]'
                  : 'hover:bg-white/[0.04]'
              } ${loading ? 'opacity-60' : ''}`}
            >
              <span className={`text-[14px] sm:text-[15px] font-medium ${isToday ? 'text-accent' : 'text-zinc-200'}`}>
                {date.getDate()}
              </span>
              {hasData && (
                <span className={`block text-[11px] font-semibold mt-1 ${allFree ? 'text-green-400' : 'text-zinc-600'}`}>
                  {info.freeCount}/{info.knownCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
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

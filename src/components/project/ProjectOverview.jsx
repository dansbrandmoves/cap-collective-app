import { useState, useMemo } from 'react'
import { DayInspectorPanel } from '../availability/AvailabilityCalendar'
import {
  getMonthGrid, trimBlankWeeks, dateToStr, deriveSlotState,
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
  // When a guest views this (RoomView), the "owner" is the host, not "You".
  ownerLabel = OWNER_LABEL, ownerEmail = undefined,
  // When the parent floats its tab bar over this view (project view), the calendar
  // column needs top clearance so its heading clears the floating tabs — while the
  // inspector still bleeds to the very top edge.
  floatingHeader = false,
  // Optional content rendered at the top of the calendar column (left side) — e.g.
  // the guest's connect-calendar panel + people chips. Keeping it in the column
  // (rather than above the whole view) lets the day inspector bleed to the top.
  headerSlot = null,
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

  const grid = useMemo(() => trimBlankWeeks(getMonthGrid(year, month)), [year, month])

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
      avail.push({ date: inspected, is_available: true, guest_name: ownerLabel })
    }
    return { reqs, avail }
  }, [inspected, rooms, fReq, fAvail, includedOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  function goToday() { setMonth(today.getMonth()); setYear(today.getFullYear()) }

  const todayStr = dateToStr(today)

  return (
    // True two-pane: the calendar column scrolls on its own; the day inspector is a
    // full-height pane (top→bottom of the available area) on lg, a bottom sheet on mobile.
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
      {/* Calendar column scrolls independently and carries the page padding.
          With a floating header, add lg top clearance so the heading clears the tabs. */}
      <div className={`flex-1 min-w-0 min-h-0 overflow-y-auto no-scrollbar px-5 sm:px-8 lg:px-12 pb-8 sm:pb-12 pt-8 sm:pt-12 ${floatingHeader ? 'lg:pt-[88px]' : ''}`}>

      {headerSlot}

      {/* Schedule a meeting — calm, spacious, one question at a time (booking aesthetic) */}
      {includedKnown > 0 ? (
        <div className="mb-5">
          {/* Thin work area: the question, time-of-day filter, and the best days inline */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
            <h2 className="text-[17px] font-semibold text-zinc-100 tracking-tight">
              When can everyone meet{windowKey !== 'any' ? <> in the <span className="text-accent">{win.label.toLowerCase()}</span></> : ''}?
            </h2>
            <span className="text-[12px] text-zinc-500">{includedKnown} {includedKnown === 1 ? 'person' : 'people'} · next 60 days</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Time-of-day filter */}
            <div className="inline-flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.05] rounded-lg p-0.5">
              {WINDOW_ORDER.map(key => (
                <button key={key} onClick={() => setWindowKey(key)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 ${
                    windowKey === key ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400 hover:text-zinc-100'
                  }`}>
                  {WINDOWS[key].label}
                </button>
              ))}
            </div>

            {bestDays.length > 0 && <span className="text-zinc-700 mx-0.5">·</span>}

            {/* Best days — compact inline pills */}
            {bestDays.map(({ ds, date, freeCount, knownCount }) => {
              const allFree = freeCount === knownCount
              return (
                <button key={ds} onClick={() => setInspected(ds)}
                  className={`inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-[12px] font-medium border transition-all duration-150 active:scale-[0.98] text-zinc-100 ${
                    allFree
                      ? 'bg-green-500/[0.10] border-green-500/25 hover:bg-green-500/[0.16]'
                      : 'border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] hover:border-white/[0.16]'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${allFree ? 'bg-green-400' : 'bg-zinc-500'}`} />
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  <span className="opacity-60 tabular-nums">{freeCount}/{knownCount}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : totalPeople <= 1 ? (
        <div className="mb-5 border border-dashed border-white/10 rounded-xl px-5 py-4 max-w-md">
          <p className="text-[14px] font-medium text-zinc-200 mb-0.5">No availability yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed">
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

      {/* Calendar — Apple-style: true square cells, subtle continuous grid lines,
          dates in circles (teal = today, green = everyone free). */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/[0.07]">
          {DOW.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] py-2.5 border-r border-white/[0.04] last:border-r-0">
              <span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map(({ date, inMonth }, i) => {
            const ds = dateToStr(date)
            const info = dayInfo[ds]
            const isToday = ds === todayStr
            const hasData = info && info.knownCount > 0
            const allFree = hasData && info.freeCount === info.knownCount
            const isSelected = inMonth && ds === inspected
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            return (
              <button
                key={i}
                disabled={!inMonth}
                onClick={() => inMonth && setInspected(ds)}
                title={hasData ? `${info.freeCount} of ${info.knownCount} free` : undefined}
                className={`relative min-h-[64px] sm:min-h-[84px] border-r border-b border-white/[0.04] flex items-start justify-start p-2 sm:p-2.5 transition-colors ${
                  !inMonth ? 'pointer-events-none' :
                  allFree ? 'bg-green-500/[0.09] hover:bg-green-500/[0.15] cursor-pointer' :
                  'hover:bg-white/[0.03] cursor-pointer'
                } ${isSelected ? 'ring-2 ring-inset ring-accent bg-accent/[0.04]' : ''} ${loading ? 'opacity-60' : ''}`}
              >
                {inMonth && (
                  <span className={`text-[13px] sm:text-[15px] font-medium ${isToday ? 'text-accent' : isWeekend ? 'text-zinc-600' : 'text-zinc-200'}`}>
                    {date.getDate()}
                  </span>
                )}
                {/* Dot only when the whole group is free that day */}
                {inMonth && allFree && (
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>
      </div>{/* /calendar column */}

      {inspected && inspectorData && (
        <DayInspectorPanel
          dateStr={inspected}
          roomIds={rooms.map(r => r.id)}
          slots={slots}
          dateRequests={inspectorData.reqs}
          sharedAvailability={inspectorData.avail}
          actionLabel="Schedule meeting"
          ownerLabel={ownerLabel}
          ownerEmail={ownerEmail}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  )
}

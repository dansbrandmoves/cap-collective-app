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

// Day-cell tints per signal. Kept inline (not slotStates) — this is a distinct,
// project-level traffic-light language: everyone clear → mostly → conflict → unknown.
const SIGNAL = {
  green: { dot: '#22c55e', cell: 'bg-green-500/[0.06] border-green-500/15 hover:bg-green-500/[0.12] hover:border-green-500/35', count: 'text-green-400/90' },
  amber: { dot: '#f59e0b', cell: 'bg-amber-500/[0.05] border-amber-500/15 hover:bg-amber-500/[0.10] hover:border-amber-500/35', count: 'text-amber-400/90' },
  red:   { dot: '#ef4444', cell: 'bg-red-500/[0.04] border-red-500/12 hover:bg-red-500/[0.09] hover:border-red-500/30', count: 'text-red-400/90' },
  gray:  { dot: '#52525b', cell: 'bg-white/[0.02] border-white/[0.05] hover:border-white/12', count: 'text-zinc-600' },
}

function signalFor(freeCount, knownCount) {
  if (knownCount === 0) return 'gray'
  if (freeCount === knownCount) return 'green'
  if (freeCount > 0) return 'amber'
  return 'red'
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

  function ownerFreeOn(date) {
    return slots.some(slot =>
      deriveSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules, businessHours).state === 'available')
  }

  const dayInfo = useMemo(() => {
    const map = {}
    for (const { date, inMonth } of grid) {
      if (!inMonth) continue
      const ds = dateToStr(date)
      const base = aggregateProjectDay(ds, rooms, fReq, fAvail)
      const knownCount = base.knownCount + (includedOwner ? 1 : 0)
      const freeCount = base.freeCount + (includedOwner && ownerFreeOn(date) ? 1 : 0)
      map[ds] = { freeCount, knownCount, signal: signalFor(freeCount, knownCount) }
    }
    return map
  }, [grid, rooms, fReq, fAvail, includedOwner, slots, calendarEvents, connectedCalendars, prefixRules, businessHours]) // eslint-disable-line react-hooks/exhaustive-deps

  const includedKnown = useMemo(
    () => projectKnownPeople(rooms, fReq, fAvail).size + (includedOwner ? 1 : 0),
    [rooms, fReq, fAvail, includedOwner]
  )

  // Best days: scan next 60 days for highest free-counts; owner folded in.
  const bestDays = useMemo(() => {
    if (includedKnown === 0) return []
    const out = []
    for (let i = 0; i < 60; i++) {
      const date = new Date(today); date.setDate(today.getDate() + i)
      const ds = dateToStr(date)
      const base = aggregateProjectDay(ds, rooms, fReq, fAvail)
      const knownCount = base.knownCount + (includedOwner ? 1 : 0)
      const freeCount = base.freeCount + (includedOwner && ownerFreeOn(date) ? 1 : 0)
      if (freeCount > 0) out.push({ ds, date, freeCount, knownCount })
    }
    return out.sort((a, b) => b.freeCount - a.freeCount || new Date(a.ds) - new Date(b.ds)).slice(0, 3)
  }, [includedKnown, includedOwner, rooms, fReq, fAvail, slots, calendarEvents, connectedCalendars, prefixRules, businessHours]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (includedOwner && ownerFreeOn(new Date(inspected + 'T00:00:00'))) {
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

      {/* Best days */}
      {includedKnown > 0 && bestDays.length > 0 ? (
        <div className="mb-6 bg-surface-800/40 border border-white/[0.06] rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Best days for everyone</span>
            <span className="text-[11px] text-zinc-600">· {includedKnown} {includedKnown === 1 ? 'person' : 'people'} included</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {bestDays.map(({ ds, date, freeCount, knownCount }) => (
              <button key={ds} onClick={() => setInspected(ds)}
                className="text-left bg-surface-900 hover:bg-surface-800 border border-white/[0.06] hover:border-white/[0.14] rounded-lg px-3 py-2 transition-all duration-150 ease-ios">
                <p className="text-[13px] font-semibold text-zinc-100 tracking-tight">
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className={`text-[11px] mt-0.5 ${freeCount === knownCount ? 'text-green-400' : 'text-amber-400'}`}>
                  {freeCount}/{knownCount} free
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : totalPeople <= 1 ? (
        <div className="mb-6 border border-dashed border-white/10 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-zinc-200 mb-0.5">No availability yet</p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Add people in the panel on the left and share their links. As they connect a calendar or tap their free days, the best days for everyone appear here.
          </p>
        </div>
      ) : null}

      {/* Legend */}
      <div className="flex items-center gap-x-4 gap-y-2 mb-4 flex-wrap">
        {[['green', 'Everyone free'], ['amber', 'Most free'], ['red', 'Conflict'], ['gray', 'No data']].map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full ring-2 ring-surface-900" style={{ backgroundColor: SIGNAL[key].dot }} />
            <span className="text-[13px] text-zinc-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-[15px] font-semibold text-zinc-100 tracking-tight">{MONTH_NAMES[month]} {year}</h3>
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
          const sig = info ? SIGNAL[info.signal] : SIGNAL.gray
          const isToday = ds === todayStr
          if (!inMonth) {
            return <div key={i} className="min-h-[52px] sm:min-h-[72px] rounded-lg" />
          }
          return (
            <button
              key={i}
              onClick={() => setInspected(ds)}
              className={`min-h-[52px] sm:min-h-[72px] rounded-lg border p-1.5 sm:p-2 text-left transition-all duration-150 ${sig.cell} ${loading ? 'opacity-60' : ''}`}
            >
              <span className={`text-[12px] sm:text-[13px] font-medium ${isToday ? 'text-accent' : 'text-zinc-300'}`}>
                {date.getDate()}
              </span>
              {info && info.knownCount > 0 && info.signal !== 'gray' && (
                <span className={`block text-[10px] sm:text-[11px] font-semibold mt-1 ${sig.count}`}>
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

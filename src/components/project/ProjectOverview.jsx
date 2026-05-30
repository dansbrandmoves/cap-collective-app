import { useState, useMemo } from 'react'
import { Users, CalendarDays, Check, ChevronDown } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { DayInspectorPanel } from '../availability/AvailabilityCalendar'
import { useProjectAvailability } from '../../hooks/useProjectAvailability'
import {
  getMonthGrid, dateToStr, deriveSlotState,
  aggregateProjectDay, projectDaySignal, projectKnownPeople,
} from '../../utils/availability'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Day-cell tints per signal. Kept inline (not slotStates) — this is a distinct,
// project-level traffic-light language: everyone clear → mostly → conflict → unknown.
const SIGNAL = {
  green: { dot: '#22c55e', cell: 'bg-green-500/15 border-green-500/25 hover:border-green-500/45', count: 'text-green-400' },
  amber: { dot: '#f59e0b', cell: 'bg-amber-500/12 border-amber-500/25 hover:border-amber-500/45', count: 'text-amber-400' },
  red:   { dot: '#ef4444', cell: 'bg-red-500/10 border-red-500/20 hover:border-red-500/40', count: 'text-red-400' },
  gray:  { dot: '#52525b', cell: 'bg-white/[0.02] border-white/[0.05] hover:border-white/12', count: 'text-zinc-600' },
}

const isActiveReq = r => r.status !== 'declined' && r.status !== 'archived'

export function ProjectOverview({ production, slots, calendarEvents, connectedCalendars, prefixRules, businessHours }) {
  const { loading, dateRequestsByRoom, sharedAvailByRoom } = useProjectAvailability(production)
  const rooms = production.rooms || []

  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [inspected, setInspected] = useState(null) // dateStr
  const [excluded, setExcluded] = useState(() => new Set()) // names left out of the aggregate
  const [showPeople, setShowPeople] = useState(false)

  // Everyone with any signal, grouped, plus how they shared (calendar vs tapped days).
  const peopleByRoom = useMemo(() => {
    return rooms.map(room => {
      const map = new Map() // name -> Set of sources
      for (const r of (dateRequestsByRoom[room.id] || []).filter(isActiveReq)) {
        if (!r.requester_name) continue
        ;(map.get(r.requester_name) || map.set(r.requester_name, new Set()).get(r.requester_name)).add('tapped')
      }
      for (const a of (sharedAvailByRoom[room.id] || [])) {
        if (!a.is_available || !a.guest_name) continue
        ;(map.get(a.guest_name) || map.set(a.guest_name, new Set()).get(a.guest_name)).add('calendar')
      }
      return { room, people: [...map.entries()].map(([name, sources]) => ({ name, sources: [...sources] })) }
    }).filter(g => g.people.length > 0)
  }, [rooms, dateRequestsByRoom, sharedAvailByRoom])

  const totalPeople = useMemo(
    () => new Set(peopleByRoom.flatMap(g => g.people.map(p => p.name))).size,
    [peopleByRoom]
  )

  function togglePerson(name) {
    setExcluded(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }
  function toggleGroup(group) {
    const names = group.people.map(p => p.name)
    const allIn = names.every(n => !excluded.has(n))
    setExcluded(prev => {
      const n = new Set(prev)
      if (allIn) names.forEach(name => n.add(name))   // exclude whole group
      else names.forEach(name => n.delete(name))      // include whole group
      return n
    })
  }

  // Filtered copies of the room maps with excluded people removed — everything
  // downstream (signals, best days, inspector) computes from these.
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

  // Per-day aggregate for the visible grid.
  const dayInfo = useMemo(() => {
    const map = {}
    for (const { date, inMonth } of grid) {
      if (!inMonth) continue
      const ds = dateToStr(date)
      const agg = aggregateProjectDay(ds, rooms, fReq, fAvail)
      const signal = projectDaySignal(ownerFreeOn(date), agg.freeCount, agg.knownCount)
      map[ds] = { ...agg, signal }
    }
    return map
  }, [grid, rooms, fReq, fAvail, slots, calendarEvents, connectedCalendars, prefixRules, businessHours]) // eslint-disable-line react-hooks/exhaustive-deps

  const includedKnown = useMemo(
    () => projectKnownPeople(rooms, fReq, fAvail).size,
    [rooms, fReq, fAvail]
  )

  // Best days: scan next 60 days for the highest free-counts where owner is free.
  const bestDays = useMemo(() => {
    if (includedKnown === 0) return []
    const out = []
    for (let i = 0; i < 60; i++) {
      const date = new Date(today); date.setDate(today.getDate() + i)
      if (!ownerFreeOn(date)) continue
      const ds = dateToStr(date)
      const agg = aggregateProjectDay(ds, rooms, fReq, fAvail)
      if (agg.freeCount > 0) out.push({ ds, date, freeCount: agg.freeCount, knownCount: agg.knownCount })
    }
    return out.sort((a, b) => b.freeCount - a.freeCount).slice(0, 3)
  }, [includedKnown, rooms, fReq, fAvail, slots, calendarEvents, connectedCalendars, prefixRules, businessHours]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build the combined, date-filtered data the inspector expects (respects the filter).
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
    return { reqs, avail }
  }, [inspected, rooms, fReq, fAvail])

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  function goToday() { setMonth(today.getMonth()); setYear(today.getFullYear()) }

  const todayStr = dateToStr(today)

  return (
    <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8">
      {/* Best days */}
      {totalPeople > 0 ? (
        bestDays.length > 0 && (
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
        )
      ) : (
        <div className="mb-6 border border-dashed border-white/10 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-zinc-200 mb-0.5">No availability yet</p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Share a group link. As people connect their calendar or tap their free days, the best days for everyone appear here automatically.
          </p>
        </div>
      )}

      {/* Who's included — choose which people count toward the calendar */}
      {totalPeople > 0 && (
        <div className="mb-5">
          <button
            onClick={() => setShowPeople(s => !s)}
            className="flex items-center gap-2 text-[13px] text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <Users size={14} strokeWidth={1.75} />
            <span>Who&rsquo;s included</span>
            <span className="text-zinc-600">· {includedKnown} of {totalPeople}</span>
            <ChevronDown size={14} strokeWidth={2} className={`transition-transform ${showPeople ? 'rotate-180' : ''}`} />
          </button>

          {showPeople && (
            <div className="mt-3 bg-surface-900 border border-white/[0.06] rounded-xl p-3 space-y-3">
              {peopleByRoom.map(({ room, people }) => {
                const allIn = people.every(p => !excluded.has(p.name))
                return (
                  <div key={room.id}>
                    <button
                      onClick={() => toggleGroup({ room, people })}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-1.5 hover:text-zinc-300 transition-colors"
                    >
                      {room.name}
                      <span className="text-zinc-600 normal-case tracking-normal font-normal">· {allIn ? 'all in' : 'tap to include all'}</span>
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      {people.map(({ name, sources }) => {
                        const inc = !excluded.has(name)
                        const viaCalendar = sources.includes('calendar')
                        return (
                          <button
                            key={name}
                            onClick={() => togglePerson(name)}
                            title={viaCalendar ? 'Shared via Google Calendar' : 'Tapped their free days'}
                            className={`flex items-center gap-1.5 text-[12px] font-medium pl-2 pr-2.5 py-1 rounded-full border transition-colors ${
                              inc
                                ? 'bg-accent/10 border-accent/25 text-zinc-100'
                                : 'bg-white/[0.02] border-white/[0.06] text-zinc-600 line-through'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${inc ? 'bg-accent text-white' : 'border border-white/20'}`}>
                              {inc && <Check size={9} strokeWidth={3} />}
                            </span>
                            {viaCalendar && <CalendarDays size={11} strokeWidth={2} className={inc ? 'text-accent' : 'text-zinc-600'} />}
                            {name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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

      {inspected && inspectorData && (
        <DayInspectorPanel
          dateStr={inspected}
          roomIds={rooms.map(r => r.id)}
          slots={slots}
          dateRequests={inspectorData.reqs}
          sharedAvailability={inspectorData.avail}
          actionLabel="Lock this date"
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  )
}

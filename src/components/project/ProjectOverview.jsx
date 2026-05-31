import { useState, useMemo } from 'react'
import { Users, CalendarDays, Check, UserPlus, Copy, X } from 'lucide-react'
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
// Tints are deliberately gentle at rest so the month grid reads calm; they firm up
// on hover. The legend dots and the count text carry the stronger color signal.
const SIGNAL = {
  green: { dot: '#22c55e', cell: 'bg-green-500/[0.06] border-green-500/15 hover:bg-green-500/[0.12] hover:border-green-500/35', count: 'text-green-400/90' },
  amber: { dot: '#f59e0b', cell: 'bg-amber-500/[0.05] border-amber-500/15 hover:bg-amber-500/[0.10] hover:border-amber-500/35', count: 'text-amber-400/90' },
  red:   { dot: '#ef4444', cell: 'bg-red-500/[0.04] border-red-500/12 hover:bg-red-500/[0.09] hover:border-red-500/30', count: 'text-red-400/90' },
  gray:  { dot: '#52525b', cell: 'bg-white/[0.02] border-white/[0.05] hover:border-white/12', count: 'text-zinc-600' },
}

const isActiveReq = r => r.status !== 'declined' && r.status !== 'archived'

export function ProjectOverview({ production, slots, calendarEvents, connectedCalendars, prefixRules, businessHours }) {
  const { loading, dateRequestsByRoom, sharedAvailByRoom } = useProjectAvailability(production)
  const { roomMembers, addRoomMember, removeRoomMember, getRoomLink } = useApp()
  const rooms = production.rooms || []
  // One project = one flat people list. People live on the project's primary room;
  // multiple rooms are a legacy implementation detail we no longer surface.
  const primaryRoom = rooms[0] || null

  // The owner is a first-class participant in the joint view — their connected
  // calendar counts as one of the people, not just a yes/no gate. This is what
  // makes "you + one guest" produce a real overlap.
  const OWNER_LABEL = 'You'

  // Day signal when the owner is folded into the counts (owner is just a person).
  function signalFor(freeCount, knownCount) {
    if (knownCount === 0) return 'gray'
    if (freeCount === knownCount) return 'green'
    if (freeCount > 0) return 'amber'
    return 'red'
  }

  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [inspected, setInspected] = useState(null) // dateStr
  const [excluded, setExcluded] = useState(() => new Set()) // names left out of the aggregate
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [copiedToken, setCopiedToken] = useState(null)

  // The roster: everyone the owner has added (room_members) plus anyone who has
  // responded (tapped days or connected a calendar), merged by name. Added-but-not-
  // yet-responded people still appear so the owner can select them and share a link.
  const members = useMemo(
    () => roomMembers.filter(m => primaryRoom && (m.room_id === primaryRoom.id || m.roomId === primaryRoom.id)),
    [roomMembers, primaryRoom]
  )

  const people = useMemo(() => {
    const map = new Map() // name -> { sources:Set, memberId, inviteToken }
    const ensure = (name) => map.get(name) || map.set(name, { sources: new Set() }).get(name)
    for (const m of members) {
      if (!m.name) continue
      const e = ensure(m.name)
      e.memberId = m.id
      e.inviteToken = m.inviteToken || m.invite_token || null
    }
    for (const arr of Object.values(dateRequestsByRoom)) {
      for (const r of arr.filter(isActiveReq)) {
        if (r.requester_name) ensure(r.requester_name).sources.add('tapped')
      }
    }
    for (const arr of Object.values(sharedAvailByRoom)) {
      for (const a of arr) {
        if (a.is_available && a.guest_name) ensure(a.guest_name).sources.add('calendar')
      }
    }
    const guests = [...map.entries()]
      .map(([name, v]) => ({ name, sources: [...v.sources], memberId: v.memberId, inviteToken: v.inviteToken }))
      .sort((a, b) => a.name.localeCompare(b.name))
    // Owner first, always — it's "you" in the overlap.
    return [{ name: OWNER_LABEL, isOwner: true, sources: [], memberId: null, inviteToken: null }, ...guests]
  }, [members, dateRequestsByRoom, sharedAvailByRoom])

  const includedOwner = !excluded.has(OWNER_LABEL)
  const totalPeople = people.length
  const includedCount = useMemo(() => people.filter(p => !excluded.has(p.name)).length, [people, excluded])

  function togglePerson(name) {
    setExcluded(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  async function handleAddPerson(e) {
    e?.preventDefault()
    const name = newName.trim()
    if (!name || !primaryRoom) return
    addRoomMember(primaryRoom.id, { name, email: '' })
    setNewName('')
    setAdding(false)
  }

  function copyInvite(token) {
    if (!token) return
    navigator.clipboard.writeText(getRoomLink(token))
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
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

  // Best days: scan next 60 days for the highest free-counts where owner is free.
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
    // Most people free first; break ties by soonest.
    return out.sort((a, b) => b.freeCount - a.freeCount || new Date(a.ds) - new Date(b.ds)).slice(0, 3)
  }, [includedKnown, includedOwner, rooms, fReq, fAvail, slots, calendarEvents, connectedCalendars, prefixRules, businessHours]) // eslint-disable-line react-hooks/exhaustive-deps

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
    // Surface the owner ("You") in the inspector too, so it matches the day's
    // count. Reuses the shared-availability shape the panel already renders.
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

      {/* People roster — always visible. Add people, then tap to include/exclude
          them from the calendar below. This is the core "pick people → see when
          they're free" loop. */}
      <div className="mb-6 bg-surface-900 border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Users size={15} strokeWidth={1.75} className="text-zinc-500" />
            <span className="text-[13px] font-semibold text-zinc-200">People</span>
            {totalPeople > 0 && (
              <span className="text-[12px] text-zinc-600">· {includedCount} of {totalPeople} selected</span>
            )}
          </div>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              disabled={!primaryRoom}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:text-accent/80 transition-colors disabled:opacity-40"
            >
              <UserPlus size={14} strokeWidth={2} /> Add person
            </button>
          )}
        </div>

        {adding && (
          <form onSubmit={handleAddPerson} className="flex items-center gap-2 mb-3">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
              placeholder="Name"
              className="flex-1 bg-surface-800 border border-white/[0.08] rounded-lg px-3 py-1.5 text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all"
            />
            <button type="submit" disabled={!newName.trim()}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-accent text-white disabled:opacity-40 transition-opacity">
              Add
            </button>
            <button type="button" onClick={() => { setAdding(false); setNewName('') }}
              className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
              <X size={15} />
            </button>
          </form>
        )}

        {totalPeople > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {people.map(({ name, sources, memberId, inviteToken, isOwner }) => {
              const inc = !excluded.has(name)
              const viaCalendar = sources.includes('calendar')
              const responded = sources.length > 0
              return (
                <span
                  key={name}
                  className={`group inline-flex items-center gap-1.5 text-[12px] font-medium pl-2 pr-1.5 py-1 rounded-full border transition-colors ${
                    inc
                      ? 'bg-accent/10 border-accent/25 text-zinc-100'
                      : 'bg-white/[0.02] border-white/[0.06] text-zinc-600'
                  }`}
                >
                  <button
                    onClick={() => togglePerson(name)}
                    title={isOwner ? 'Your calendar' : (responded ? (viaCalendar ? 'Shared via Google Calendar' : 'Tapped their free days') : 'Hasn’t responded yet')}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${inc ? 'bg-accent text-white' : 'border border-white/20'}`}>
                      {inc && <Check size={9} strokeWidth={3} />}
                    </span>
                    {(viaCalendar || isOwner) && <CalendarDays size={11} strokeWidth={2} className={inc ? 'text-accent' : 'text-zinc-600'} />}
                    <span className={inc ? '' : 'line-through'}>{name}</span>
                    {isOwner
                      ? <span className="text-[10px] text-zinc-500">you</span>
                      : (!responded && <span className="text-[10px] text-zinc-600 italic">invited</span>)}
                  </button>
                  {inviteToken && (
                    <button
                      onClick={() => copyInvite(inviteToken)}
                      title="Copy invite link"
                      className="text-zinc-500 hover:text-accent transition-colors"
                    >
                      {copiedToken === inviteToken ? <Check size={11} strokeWidth={3} className="text-green-400" /> : <Copy size={11} strokeWidth={2} />}
                    </button>
                  )}
                  {memberId && (
                    <button
                      onClick={() => removeRoomMember(memberId)}
                      title="Remove person"
                      className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        ) : (
          !adding && (
            <p className="text-[13px] text-zinc-500 leading-relaxed">
              Add the people you’re coordinating with. Each gets a private link to share their free days — then their availability shows up on the calendar below.
            </p>
          )
        )}
      </div>

      {/* Best days */}
      {includedKnown > 0 && bestDays.length > 0 && (
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
      </div>{/* /main column */}

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
      </div>{/* /split row */}
    </div>
  )
}

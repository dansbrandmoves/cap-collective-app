import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { useApp } from '../../contexts/AppContext'
import { DEFAULT_SLOT_STATES } from '../../utils/availability'

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${period}`
}

const SNAP = 30 // snap to 30-minute increments
function snapMinutes(mins) {
  return Math.round(mins / SNAP) * SNAP
}

export function SlotTimeline({ slots, businessHours, interactive = true, slotStates = null }) {
  // slotStates: optional { [slotId]: { state, drivingEvent } } for coloring by derived state
  const { updateSlot, createSlot } = useApp()
  const containerRef = useRef(null)
  const [dragState, setDragState] = useState(null) // { slotId, handle: 'left'|'right'|'move', startX, origStart, origEnd }
  const [hoverTime, setHoverTime] = useState(null)

  const { rangeStart, rangeEnd, hours } = useMemo(() => {
    let earliest = 6 * 60
    let latest = 22 * 60

    if (businessHours?.schedule) {
      for (const day of Object.values(businessHours.schedule)) {
        if (!day) continue
        const s = timeToMinutes(day.start)
        const e = timeToMinutes(day.end)
        if (s < earliest) earliest = s
        if (e > latest) latest = e
      }
    }

    for (const slot of slots) {
      const s = timeToMinutes(slot.startTime)
      const e = timeToMinutes(slot.endTime)
      if (s < earliest) earliest = s - 30
      if (e > latest) latest = e + 30
    }

    earliest = Math.floor(earliest / 60) * 60
    latest = Math.ceil(latest / 60) * 60

    const hrs = []
    for (let m = earliest; m <= latest; m += 60) hrs.push(m)

    return { rangeStart: earliest, rangeEnd: latest, hours: hrs }
  }, [slots, businessHours])

  const totalMinutes = rangeEnd - rangeStart

  const pxToMinutes = useCallback((px) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const ratio = px / rect.width
    return rangeStart + ratio * totalMinutes
  }, [rangeStart, totalMinutes])

  const clientXToMinutes = useCallback((clientX) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return rangeStart + ratio * totalMinutes
  }, [rangeStart, totalMinutes])

  // Detect overlaps for row stacking
  const rows = useMemo(() => {
    const sorted = [...slots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    const result = []
    for (const slot of sorted) {
      const slotStart = timeToMinutes(slot.startTime)
      const slotEnd = timeToMinutes(slot.endTime)
      let placed = false
      for (const row of result) {
        const overlaps = row.some(s => {
          const rs = timeToMinutes(s.startTime)
          const re = timeToMinutes(s.endTime)
          return slotStart < re && slotEnd > rs
        })
        if (!overlaps) { row.push(slot); placed = true; break }
      }
      if (!placed) result.push([slot])
    }
    return result
  }, [slots])

  // Mouse handlers for drag interactions
  function handleMouseDown(e, slotId, handle) {
    e.preventDefault()
    e.stopPropagation()
    const slot = slots.find(s => s.id === slotId)
    if (!slot) return
    setDragState({
      slotId, handle,
      startX: e.clientX,
      origStart: timeToMinutes(slot.startTime),
      origEnd: timeToMinutes(slot.endTime),
    })
  }

  useEffect(() => {
    if (!dragState) return

    function handleMouseMove(e) {
      const deltaPx = e.clientX - dragState.startX
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const deltaMinutes = (deltaPx / rect.width) * totalMinutes

      let newStart = dragState.origStart
      let newEnd = dragState.origEnd

      if (dragState.handle === 'left') {
        newStart = snapMinutes(dragState.origStart + deltaMinutes)
        newStart = Math.max(rangeStart, Math.min(newStart, newEnd - SNAP))
      } else if (dragState.handle === 'right') {
        newEnd = snapMinutes(dragState.origEnd + deltaMinutes)
        newEnd = Math.max(newStart + SNAP, Math.min(newEnd, rangeEnd))
      } else if (dragState.handle === 'move') {
        const duration = dragState.origEnd - dragState.origStart
        newStart = snapMinutes(dragState.origStart + deltaMinutes)
        newStart = Math.max(rangeStart, Math.min(newStart, rangeEnd - duration))
        newEnd = newStart + duration
      }

      updateSlot(dragState.slotId, {
        startTime: minutesToTime(newStart),
        endTime: minutesToTime(newEnd),
      })
    }

    function handleMouseUp() {
      setDragState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, totalMinutes, rangeStart, rangeEnd, updateSlot])

  // Click empty space to add
  function handleBarClick(e) {
    if (!interactive || dragState) return
    // Don't create if we clicked on a slot
    if (e.target !== containerRef.current && !e.target.classList.contains('timeline-bg')) return

    const mins = snapMinutes(clientXToMinutes(e.clientX))
    const startMins = Math.max(rangeStart, mins - 60)
    const endMins = Math.min(rangeEnd, startMins + 120)

    // Check if this space is already occupied
    const occupied = slots.some(s => {
      const ss = timeToMinutes(s.startTime)
      const se = timeToMinutes(s.endTime)
      return startMins < se && endMins > ss
    })
    if (occupied) return

    createSlot({
      name: 'New Slot',
      startTime: minutesToTime(startMins),
      endTime: minutesToTime(endMins),
      color: ['#22c55e', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4'][slots.length % 5],
      defaultState: 'available',
    })
  }

  // Hover time indicator
  function handleMouseMoveBar(e) {
    if (dragState || !interactive) { setHoverTime(null); return }
    const mins = snapMinutes(clientXToMinutes(e.clientX))
    setHoverTime(mins)
  }

  if (slots.length === 0 && !interactive) return null

  const rowHeight = 32
  const barHeight = Math.max(rows.length, 1) * rowHeight + 8

  return (
    <div className="mb-5">
      {/* Hour markers */}
      <div className="relative h-5 mb-1">
        {hours.map(m => {
          const left = ((m - rangeStart) / totalMinutes) * 100
          return (
            <span key={m} className="absolute text-[9px] text-zinc-600 -translate-x-1/2 select-none"
              style={{ left: `${left}%` }}>
              {formatTime(m)}
            </span>
          )
        })}
      </div>

      {/* Timeline bar */}
      <div
        ref={containerRef}
        onClick={handleBarClick}
        onMouseMove={handleMouseMoveBar}
        onMouseLeave={() => setHoverTime(null)}
        className={`relative bg-surface-800 border border-surface-700 rounded-lg overflow-hidden timeline-bg ${
          interactive ? 'cursor-crosshair' : ''
        } ${dragState ? 'select-none' : ''}`}
        style={{ height: `${barHeight}px` }}
      >
        {/* Hour grid lines */}
        {hours.map(m => {
          const left = ((m - rangeStart) / totalMinutes) * 100
          return <div key={m} className="absolute top-0 bottom-0 w-px bg-surface-700/50 timeline-bg" style={{ left: `${left}%` }} />
        })}

        {/* Hover time indicator */}
        {hoverTime !== null && !dragState && (
          <div className="absolute top-0 bottom-0 w-px bg-accent/30 pointer-events-none z-10"
            style={{ left: `${((hoverTime - rangeStart) / totalMinutes) * 100}%` }}>
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-accent bg-surface-900 px-1 rounded">
              {formatTime(hoverTime)}
            </span>
          </div>
        )}

        {/* Slot blocks */}
        {rows.map((row, rowIdx) =>
          row.map(slot => {
            const startMins = timeToMinutes(slot.startTime)
            const endMins = timeToMinutes(slot.endTime)
            const left = ((startMins - rangeStart) / totalMinutes) * 100
            const width = ((endMins - startMins) / totalMinutes) * 100
            const isDragging = dragState?.slotId === slot.id

            return (
              <div
                key={slot.id}
                className={`absolute rounded-md flex items-center overflow-hidden transition-shadow group/block ${
                  isDragging ? 'shadow-lg shadow-black/30 z-20' : 'z-10'
                } ${interactive ? '' : 'pointer-events-none'}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top: `${rowIdx * rowHeight + 4}px`,
                  height: `${rowHeight - 8}px`,
                  backgroundColor: (slotStates?.[slot.id] ? (DEFAULT_SLOT_STATES[slotStates[slot.id].state]?.color || slot.color) : slot.color) + '35',
                  borderLeft: `3px solid ${slotStates?.[slot.id] ? (DEFAULT_SLOT_STATES[slotStates[slot.id].state]?.color || slot.color) : slot.color}`,
                }}
              >
                {/* Left resize handle */}
                {interactive && (
                  <div
                    onMouseDown={e => handleMouseDown(e, slot.id, 'left')}
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-20 hover:bg-white/10"
                  />
                )}

                {/* Move handle (center) */}
                <div
                  onMouseDown={interactive ? e => handleMouseDown(e, slot.id, 'move') : undefined}
                  className={`flex-1 flex items-center justify-center min-w-0 h-full ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <span className="text-[10px] font-medium text-zinc-200 truncate px-2 select-none">
                    {slot.name}
                  </span>
                </div>

                {/* Right resize handle */}
                {interactive && (
                  <div
                    onMouseDown={e => handleMouseDown(e, slot.id, 'right')}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize z-20 hover:bg-white/10"
                  />
                )}
              </div>
            )
          })
        )}

        {/* Empty state */}
        {slots.length === 0 && interactive && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600 pointer-events-none">
            Click anywhere to add a time slot
          </div>
        )}
      </div>
    </div>
  )
}

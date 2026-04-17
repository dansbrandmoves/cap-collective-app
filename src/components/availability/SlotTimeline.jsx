import { useMemo } from 'react'

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${period}`
}

export function SlotTimeline({ slots, businessHours }) {
  const { rangeStart, rangeEnd, hours } = useMemo(() => {
    // Determine visible range from business hours or slots
    let earliest = 6 * 60  // 6am default
    let latest = 22 * 60   // 10pm default

    if (businessHours?.schedule) {
      for (const day of Object.values(businessHours.schedule)) {
        if (!day) continue
        const s = timeToMinutes(day.start)
        const e = timeToMinutes(day.end)
        if (s < earliest) earliest = s
        if (e > latest) latest = e
      }
    }

    // Also expand to fit any slot that's outside business hours
    for (const slot of slots) {
      const s = timeToMinutes(slot.startTime)
      const e = timeToMinutes(slot.endTime)
      if (s < earliest) earliest = s - 30
      if (e > latest) latest = e + 30
    }

    // Round to nearest hour
    earliest = Math.floor(earliest / 60) * 60
    latest = Math.ceil(latest / 60) * 60

    // Generate hour markers
    const hrs = []
    for (let m = earliest; m <= latest; m += 60) {
      hrs.push(m)
    }

    return { rangeStart: earliest, rangeEnd: latest, hours: hrs }
  }, [slots, businessHours])

  const totalMinutes = rangeEnd - rangeStart

  // Detect overlaps — group slots into rows
  const rows = useMemo(() => {
    const sorted = [...slots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    const result = []
    for (const slot of sorted) {
      const slotStart = timeToMinutes(slot.startTime)
      const slotEnd = timeToMinutes(slot.endTime)
      // Find first row where this slot fits without overlap
      let placed = false
      for (const row of result) {
        const overlaps = row.some(s => {
          const rs = timeToMinutes(s.startTime)
          const re = timeToMinutes(s.endTime)
          return slotStart < re && slotEnd > rs
        })
        if (!overlaps) {
          row.push(slot)
          placed = true
          break
        }
      }
      if (!placed) result.push([slot])
    }
    return result
  }, [slots])

  if (slots.length === 0) return null

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
      <div className="relative bg-surface-800 border border-surface-700 rounded-lg overflow-hidden"
        style={{ minHeight: `${Math.max(rows.length, 1) * 28 + 8}px` }}>

        {/* Hour grid lines */}
        {hours.map(m => {
          const left = ((m - rangeStart) / totalMinutes) * 100
          return (
            <div key={m} className="absolute top-0 bottom-0 w-px bg-surface-700/50"
              style={{ left: `${left}%` }} />
          )
        })}

        {/* Slot blocks */}
        {rows.map((row, rowIdx) =>
          row.map(slot => {
            const startMins = timeToMinutes(slot.startTime)
            const endMins = timeToMinutes(slot.endTime)
            const left = ((startMins - rangeStart) / totalMinutes) * 100
            const width = ((endMins - startMins) / totalMinutes) * 100

            return (
              <div
                key={slot.id}
                className="absolute rounded-md flex items-center justify-center overflow-hidden transition-all"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top: `${rowIdx * 28 + 4}px`,
                  height: '24px',
                  backgroundColor: slot.color + '30',
                  borderLeft: `3px solid ${slot.color}`,
                }}
              >
                <span className="text-[10px] font-medium text-zinc-200 truncate px-1.5 select-none">
                  {slot.name}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

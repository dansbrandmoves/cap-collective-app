import { useState, useMemo } from 'react'
import { useApp } from '../../contexts/AppContext'
import { explainSlotState, dateToStr } from '../../utils/availability'
import { CheckCircle2, AlertCircle, MinusCircle, ChevronRight, CalendarClock } from 'lucide-react'

// Availability Inspector — the "eyes" on derivation. Pick a date and see, for
// every slot, exactly how the engine arrived at its state: which events were
// considered, whether each overlapped (with stored UTC time vs. the local time
// the math actually used — so timezone bugs are obvious), which calendar
// governed, and which event drove the result. Plus a data-health panel that
// flags the usual suspects (orphan events, missing providers, empty governors).
//
// This reuses the SAME engine (explainSlotState wraps deriveSlotState's logic and
// the real eventOverlapsSlot), so what you see here is exactly what the calendar
// surfaces compute — never a separate, drifting reimplementation.

const STATE_TONE = {
  available: 'text-green-400 bg-green-500/10 border-green-500/20',
  booked:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  hold:      'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  blocked:   'text-red-400 bg-red-500/10 border-red-500/20',
}

const SKIP_LABEL = {
  'unknown-calendar': 'Event on a calendar that is NOT in your connected list — it can never affect availability',
  'no-overlap': 'Does not overlap this slot',
  ignored: 'Calendar role = ignored',
  informational: 'Calendar role = informational (visible only, never blocks)',
  'non-governing': 'Calendar does not govern',
}

function browserTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'unknown' }
}

function EventRow({ ev }) {
  const considered = !ev.skippedReason || ev.becameDriving
  return (
    <div className={`text-[12px] rounded-lg border px-2.5 py-2 ${ev.becameDriving ? 'border-accent/40 bg-accent/[0.06]' : ev.skippedReason ? 'border-white/[0.05] bg-white/[0.01]' : 'border-white/[0.08] bg-white/[0.03]'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ev.provider === 'microsoft' ? 'text-sky-300 bg-sky-500/10' : 'text-rose-300 bg-rose-500/10'}`}>
          {ev.provider === 'microsoft' ? 'Outlook' : 'Google'}
        </span>
        <span className="text-zinc-100 font-medium truncate">{ev.title}</span>
        {ev.becameDriving && <span className="text-[10px] font-semibold text-accent">← DRIVES STATE ({ev.eventState})</span>}
        {ev.overlaps && !ev.becameDriving && <span className="text-[10px] text-zinc-500">overlaps · {ev.eventState}</span>}
        {ev.skippedReason && <span className="text-[10px] text-zinc-500">skipped</span>}
      </div>
      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-zinc-500">
        <span>Calendar: <span className="text-zinc-400">{ev.calendarName || ev.calendarId}</span> {ev.role && <span className="text-zinc-600">({ev.role})</span>}</span>
        <span>All-day: <span className="text-zinc-400">{ev.isAllDay ? 'yes' : 'no'}</span></span>
        <span>Stored (raw): <span className="text-zinc-400 font-mono">{ev.rawStart} → {ev.rawEnd}</span></span>
        <span>Local: <span className="text-zinc-400">{ev.localStart} → {ev.localEnd}</span></span>
        {ev.evMinutes && (
          <span className="sm:col-span-2">Overlap math (min-of-day): <span className="text-zinc-400 font-mono">event {ev.evMinutes.start}–{ev.evMinutes.end}</span></span>
        )}
      </div>
      {ev.skippedReason && (
        <p className="mt-1 text-[11px] text-amber-500/80">{SKIP_LABEL[ev.skippedReason] || ev.skippedReason}</p>
      )}
    </div>
  )
}

function SlotCard({ result, slotMinLabel }) {
  const [open, setOpen] = useState(false)
  const { state, trace } = result
  const tone = STATE_TONE[state] || STATE_TONE.available
  const overlapping = trace.events.filter(e => e.overlaps).length
  const considered = trace.events.filter(e => !e.skippedReason).length
  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-surface-900">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors">
        <ChevronRight size={14} className={`text-zinc-600 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tone}`}>{state}</span>
        <span className="text-[13px] text-zinc-200 font-medium">{trace.slotName || trace.slotId}</span>
        <span className="text-[11px] text-zinc-600 font-mono">{trace.slotTime}</span>
        <span className="text-[11px] text-zinc-600 ml-auto">{overlapping} overlapping · {trace.events.length} events</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-[11px] text-zinc-500 flex flex-wrap gap-x-4">
            <span>Default tier: <span className="text-zinc-400">{trace.defaultState}</span></span>
            {trace.businessHours?.applied && (
              <span className="text-amber-500/80">Business hours: {trace.businessHours.reason || 'within hours'}</span>
            )}
            <span>Considered (governing): <span className="text-zinc-400">{considered}</span></span>
          </div>
          {trace.events.length === 0 ? (
            <p className="text-[12px] text-zinc-600">No calendar events loaded in range for this evaluation.</p>
          ) : (
            <div className="space-y-1.5">
              {trace.events.map((ev, i) => <EventRow key={i} ev={ev} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Health({ items }) {
  if (!items.length) return (
    <div className="flex items-center gap-2 text-[12px] text-green-400"><CheckCircle2 size={14} /> No data-health issues detected.</div>
  )
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className={`flex items-start gap-2 text-[12px] ${it.level === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
          {it.level === 'error' ? <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> : <MinusCircle size={14} className="mt-0.5 flex-shrink-0" />}
          <span>{it.msg}</span>
        </div>
      ))}
    </div>
  )
}

export function AvailabilityInspector() {
  const { calendarEvents, connectedCalendars, effectiveSlots, slots, prefixRules, businessHours, timezone } = useApp()
  const slotList = (effectiveSlots && effectiveSlots.length ? effectiveSlots : slots) || []
  const [dateStr, setDateStr] = useState(() => dateToStr(new Date()))

  const date = useMemo(() => new Date(dateStr + 'T00:00:00'), [dateStr])

  const results = useMemo(
    () => slotList.map(slot => explainSlotState(date, slot, calendarEvents, connectedCalendars, prefixRules, businessHours, timezone)),
    [slotList, date, calendarEvents, connectedCalendars, prefixRules, businessHours, timezone]
  )

  // All events landing on the chosen calendar day (regardless of slot), for a
  // raw "what's on this day" readout.
  const dayEvents = useMemo(() => {
    return (calendarEvents || []).filter(e => {
      const s = (e.start || '').slice(0, 10)
      const en = (e.end || '').slice(0, 10)
      return s <= dateStr && dateStr <= en || s === dateStr
    })
  }, [calendarEvents, dateStr])

  const health = useMemo(() => {
    const out = []
    const knownIds = new Set(connectedCalendars.map(c => c.googleCalendarId))
    const orphans = (calendarEvents || []).filter(e => !knownIds.has(e.calendarId))
    if (orphans.length) out.push({ level: 'error', msg: `${orphans.length} event(s) reference a calendar not in your connected list (calendarId: ${[...new Set(orphans.map(o => o.calendarId))].slice(0, 3).join(', ')}…). These can never affect availability — usually a sync/key mismatch.` })
    const governing = connectedCalendars.filter(c => c.role === 'governs')
    if (!governing.length) out.push({ level: 'error', msg: 'No connected calendar has role "governs" — nothing will ever block availability.' })
    for (const c of connectedCalendars) {
      if (!c.provider) out.push({ level: 'warn', msg: `Calendar "${c.name || c.googleCalendarId}" has no provider set — defaults to Google. If it's an Outlook calendar this is wrong.` })
    }
    const providers = new Set(connectedCalendars.map(c => c.provider || 'google'))
    const evByProvider = { google: 0, microsoft: 0 }
    for (const e of (calendarEvents || [])) {
      const p = String(e.calendarId || '').startsWith('ms:') ? 'microsoft' : 'google'
      evByProvider[p]++
    }
    if (providers.has('microsoft') && evByProvider.microsoft === 0) out.push({ level: 'warn', msg: 'An Outlook calendar is connected but zero Microsoft events are loaded — sync may not have run, or all events are in the past/future window.' })
    if (providers.has('google') && evByProvider.google === 0) out.push({ level: 'warn', msg: 'A Google calendar is connected but zero Google events are loaded.' })
    return out
  }, [calendarEvents, connectedCalendars])

  const tzMismatch = timezone && timezone !== browserTz()

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <CalendarClock size={18} className="text-accent" />
          <h2 className="text-[17px] font-semibold text-zinc-100">Availability inspector</h2>
        </div>
        <p className="text-[12px] text-zinc-500">Live trace of the derivation engine — exactly what every calendar surface computes. Pick a day, expand a slot to see why it resolved the way it did.</p>
      </div>

      {/* Snapshot */}
      <div className="bg-surface-900 border border-white/[0.06] rounded-xl p-3.5 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
          <div><p className="text-[10px] uppercase tracking-wide text-zinc-600">Timezone</p><p className="text-zinc-300">{timezone || '—'}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-zinc-600">Browser TZ</p><p className={tzMismatch ? 'text-amber-400' : 'text-zinc-300'}>{browserTz()}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-zinc-600">Calendars</p><p className="text-zinc-300">{connectedCalendars.length} ({connectedCalendars.filter(c => c.role === 'governs').length} govern)</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-zinc-600">Events loaded</p><p className="text-zinc-300">{(calendarEvents || []).length}</p></div>
        </div>
        {tzMismatch && (
          <p className="text-[11px] text-amber-400/90">⚠ Configured timezone differs from this browser. Overlap math uses browser-local time, so derivation here may differ from a user in {timezone}.</p>
        )}
        <div className="border-t border-white/[0.05] pt-3">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600 mb-1.5">Data health</p>
          <Health items={health} />
        </div>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <label className="text-[12px] text-zinc-500">Inspect date</label>
        <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
          className="bg-surface-800 border border-white/[0.08] rounded-lg px-3 py-1.5 text-[13px] text-zinc-100 focus:outline-none focus:border-accent/60" />
        <span className="text-[12px] text-zinc-600">{date.toLocaleDateString('en-US', { weekday: 'long' })} · {dayEvents.length} event(s) this day</span>
      </div>

      {/* Per-slot trace */}
      {slotList.length === 0 ? (
        <p className="text-[13px] text-zinc-500">No slots defined.</p>
      ) : (
        <div className="space-y-2">
          {results.map((r, i) => <SlotCard key={r.trace.slotId || i} result={r} />)}
        </div>
      )}
    </div>
  )
}

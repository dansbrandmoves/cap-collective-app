import { useState, useEffect, useRef } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  CalendarDays, Users, CheckCircle2, ArrowRight, LayoutGrid, Shapes,
  ChevronLeft, ChevronRight, Check, UserPlus, GripVertical, MoreHorizontal,
  Plus, CheckSquare, MessageSquare, X, CalendarPlus,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Users,
    title: 'When can everyone meet?',
    desc: 'Add everyone to a project and the days the whole group is free are marked. Filter by morning, afternoon, or evening.',
    art: MiniOverlap,
  },
  {
    icon: CalendarDays,
    title: 'Calendar-driven availability',
    desc: 'Connect Google or Outlook and your busy times are excluded automatically, for you and everyone you invite.',
    art: MiniCalendars,
  },
  {
    icon: LayoutGrid,
    title: 'Shared tasks',
    desc: 'A Trello-style board with lists, cards, and assignees, shared with everyone on the project.',
    art: MiniTasks,
  },
  {
    icon: Shapes,
    title: 'A shared whiteboard',
    desc: 'An infinite canvas with sticky notes, shapes, images, and arrows.',
    art: MiniBoard,
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Create a project', desc: 'Name it and add the clients, vendors, and crew.' },
  { step: '02', title: 'Connect calendars', desc: 'Each person connects a calendar or taps their free days. No account needed.' },
  { step: '03', title: 'Skip the back-and-forth', desc: 'The days the whole group is free are marked. Pick one and send the meeting.' },
]

// Fades content in on first scroll into view. Skipped entirely for users who
// prefer reduced motion.
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }
    const el = ref.current
    if (!el) { setShown(true); return }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShown(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-ios will-change-transform ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${className}`}
    >
      {children}
    </div>
  )
}

function Hairline() {
  return (
    <div
      className="h-px w-full max-w-5xl mx-auto"
      style={{ background: 'linear-gradient(to right, transparent, rgb(30 36 41 / 0.12), transparent)' }}
    />
  )
}

// Renders real-size app markup miniaturized with a uniform transform, so the
// vignettes are literally the app's own rendering, scaled.
function Shrink({ w, h, scale, children }) {
  return (
    <div style={{ width: w * scale, height: h * scale }} className="relative">
      <div
        style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        className="absolute top-0 left-0"
      >
        {children}
      </div>
    </div>
  )
}

/* ── Feature vignettes ──
   Markup and class strings below are copied from the real components
   (ProjectOverview calendar, timeWindows filter, SlotRow, Board, Whiteboard)
   and rendered at real size inside a Shrink, so they match the app. */

// The project month calendar: time-of-day filter + lined grid; a day the whole
// group is free gets the green tint + green dot (ProjectOverview.jsx).
function MiniOverlap() {
  const allFree = [16, 23]
  return (
    <Shrink w={460} h={352} scale={0.46}>
      <div aria-hidden>
        <div className="inline-flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.05] rounded-lg p-0.5 mb-4">
          {['Any time', 'Morning', 'Afternoon', 'Evening'].map((label, i) => (
            <span key={label} className={`px-3 py-1.5 rounded-md text-[12px] font-medium ${i === 0 ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400'}`}>
              {label}
            </span>
          ))}
        </div>
        <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] py-2.5 border-r border-white/[0.04] last:border-r-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 28 }, (_, i) => {
              const day = i + 1
              const isAllFree = allFree.includes(day)
              const isWeekend = i % 7 === 0 || i % 7 === 6
              return (
                <div key={day} className={`relative min-h-[64px] border-r border-b border-white/[0.04] flex items-start justify-start p-2 ${isAllFree ? 'bg-green-500/[0.09]' : ''}`}>
                  <span className={`text-[13px] font-medium ${isWeekend ? 'text-zinc-600' : 'text-zinc-200'}`}>{day}</span>
                  {isAllFree && (
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Shrink>
  )
}

// The day inspector's slot rows (SlotRow.jsx tones): a busy morning is dimmed
// out automatically; the open afternoon is selected teal.
function MiniCalendars() {
  const rows = [
    { name: 'Morning', time: '9 AM to 12 PM', tone: 'border-white/[0.05] text-zinc-600 opacity-50', busy: true },
    { name: 'Afternoon', time: '12 to 3 PM', tone: 'bg-accent/10 border-accent/45 text-zinc-50' },
    { name: 'Evening', time: '5 to 8 PM', tone: 'border-white/10 text-zinc-200' },
  ]
  return (
    <Shrink w={340} h={252} scale={0.58}>
      <div aria-hidden>
        <div className="flex items-center gap-2 mb-3">
          {['Google', 'Outlook'].map(p => (
            <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-[12px] font-medium text-zinc-300">
              <CheckCircle2 size={12} strokeWidth={2.25} className="text-green-400" />
              {p}
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.name} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left ${r.tone}`}>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-tight truncate">{r.name}</p>
                <p className="text-[12px] text-zinc-500 mt-0.5">{r.time}</p>
              </div>
              {r.busy && <span className="text-[11px] text-zinc-600">Busy</span>}
            </div>
          ))}
        </div>
      </div>
    </Shrink>
  )
}

// Two real board lists (Board.jsx column + TaskCard classes).
function MiniTasks() {
  return (
    <Shrink w={616} h={196} scale={0.5}>
      <div aria-hidden className="flex gap-4 items-start">
        <div className="w-[300px] flex-shrink-0 flex flex-col rounded-2xl bg-surface-900/50 border border-white/[0.06]">
          <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
            <GripVertical size={14} strokeWidth={2} className="text-zinc-600 -ml-0.5" />
            <span className="flex-1 min-w-0 text-left text-[13px] font-semibold text-zinc-200 truncate px-1 py-1">To do</span>
            <span className="text-[11px] text-zinc-600 tabular-nums flex-shrink-0">2</span>
            <MoreHorizontal size={14} strokeWidth={2} className="text-zinc-600 flex-shrink-0" />
          </div>
          <div className="px-2.5 pb-1 space-y-2">
            <div className="rounded-xl border border-zinc-500/20 bg-surface-800/80 px-3 py-2.5 shadow-sm shadow-black/5">
              <div className="flex flex-wrap gap-1 mb-1.5">
                <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: '#5e9c8c' }} />
              </div>
              <p className="text-[13px] leading-snug text-zinc-100">Scout locations</p>
            </div>
            <div className="rounded-xl border border-zinc-500/20 bg-surface-800/80 px-3 py-2.5 shadow-sm shadow-black/5">
              <p className="text-[13px] leading-snug text-zinc-100">Confirm crew</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500">
                  <CheckSquare size={11} strokeWidth={2} />1/3
                </span>
              </div>
            </div>
          </div>
          <div className="m-2 mt-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-zinc-500">
            <Plus size={13} strokeWidth={2} /> Add a card
          </div>
        </div>
        <div className="w-[300px] flex-shrink-0 flex flex-col rounded-2xl bg-surface-900/50 border border-white/[0.06]">
          <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
            <GripVertical size={14} strokeWidth={2} className="text-zinc-600 -ml-0.5" />
            <span className="flex-1 min-w-0 text-left text-[13px] font-semibold text-zinc-200 truncate px-1 py-1">Doing</span>
            <span className="text-[11px] text-zinc-600 tabular-nums flex-shrink-0">1</span>
            <MoreHorizontal size={14} strokeWidth={2} className="text-zinc-600 flex-shrink-0" />
          </div>
          <div className="px-2.5 pb-1">
            <div className="rounded-xl border border-zinc-500/20 bg-surface-800/80 px-3 py-2.5 shadow-sm shadow-black/5">
              <div className="flex flex-wrap gap-1 mb-1.5">
                <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: '#60a5fa' }} />
              </div>
              <p className="text-[13px] leading-snug text-zinc-100">Shot list</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="ml-auto rounded-full bg-accent/25 text-accent flex items-center justify-center font-bold w-5 h-5 text-[10px]">P</span>
              </div>
            </div>
          </div>
          <div className="m-2 mt-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-zinc-500">
            <Plus size={13} strokeWidth={2} /> Add a card
          </div>
        </div>
      </div>
    </Shrink>
  )
}

// Real whiteboard elements at their real default sizes (Whiteboard.jsx):
// sticky 180x180 #fde68a with the paper gradient, rect 220x130 #bfdbfe r12,
// connector #94a3b8 at 2.5 anchored to side dots, comment pin, 24px dot grid.
function MiniBoard() {
  const stickyBg = 'linear-gradient(155deg, rgba(255,255,255,0.18), rgba(0,0,0,0.06)), #fde68a'
  // The app keeps grid dots at 1px and scales their spacing with zoom
  // (backgroundSize = GRID * zoom), so the grid lives on the unscaled wrapper.
  const scale = 0.55
  return (
    <div
      aria-hidden
      className="relative overflow-hidden"
      style={{
        width: 470 * scale, height: 264 * scale,
        backgroundImage: 'radial-gradient(circle, rgba(15,23,42,0.16) 1px, transparent 1px)',
        backgroundSize: `${24 * scale}px ${24 * scale}px`,
      }}
    >
      <Shrink w={470} h={264} scale={scale}>
      <div className="relative w-full h-full">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 470 264">
          <path d="M 196 114 C 234 114, 212 172, 250 172" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="250,172 239,165 239,179" fill="#94a3b8" />
        </svg>
        <div
          className="absolute"
          style={{ left: 16, top: 24, width: 180, height: 180, background: stickyBg, borderRadius: 3, boxShadow: '0 10px 22px -8px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.12) inset' }}
        >
          <div
            className="w-full h-full flex items-center justify-center p-3 overflow-hidden text-center break-words"
            style={{ color: '#1a1a1e', fontSize: 18, fontWeight: 500, fontFamily: "'Caveat', cursive" }}
          >
            Shot ideas
          </div>
        </div>
        <div className="absolute" style={{ left: 250, top: 107, width: 220, height: 130, background: '#bfdbfe', borderRadius: 12 }} />
        <span
          className="absolute w-7 h-7 rounded-full flex items-center justify-center shadow-md"
          style={{ left: 384, top: 26, backgroundColor: '#5e9c8c' }}
        >
          <MessageSquare size={14} strokeWidth={2.2} className="text-surface-950" />
        </span>
      </div>
      </Shrink>
    </div>
  )
}

/* ── Hero demo — a faithful miniature of the project Schedule view ── */

// Each person's free days are real overlapping sets. As people are checked
// into the overlap (the roster's include toggle), it narrows exactly the way
// the product computes it: Sarah alone → 8 green days; with Diego → 9/16/23;
// all three → 16 & 23.
const TEAM = [
  { name: 'Sarah Chen',   sub: 'Coordinator · you', free: [2, 3, 9, 16, 17, 23, 24, 30] },
  { name: 'Diego Rivera', free: [8, 9, 15, 16, 22, 23, 29] },
  { name: 'Priya Patel',  free: [3, 10, 16, 17, 23, 24, 30] },
]

// April 2026 (April 1 is a Wednesday) — pill labels match the product's format.
function pillLabel(day) {
  return new Date(2026, 3, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// The final beat: the converged day is clicked and the day inspector opens,
// ending on the real "Schedule meeting" action.
const INSPECT_DAY = 16

const PROJECT_PHASES = [
  { included: 1, duration: 2000 },
  { included: 2, duration: 1800 },
  { included: 3, duration: 2200 },
  { included: 3, inspect: true, duration: 5400 },
]

function HeroProjectMockup() {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const { included, inspect } = PROJECT_PHASES[phaseIdx]
  const joined = TEAM.slice(0, included)

  const cardRef = useRef(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(entries => setInView(entries[0].isIntersecting), { threshold: 0.25 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const t = setTimeout(() => setPhaseIdx(p => (p + 1) % PROJECT_PHASES.length), PROJECT_PHASES[phaseIdx].duration)
    return () => clearTimeout(t)
  }, [phaseIdx, inView])

  function isAllFree(day) {
    return joined.every(p => p.free.includes(day))
  }

  // Soonest days everyone who has responded is free — the best-day pills.
  const bestDays = []
  for (let d = 1; d <= 30 && bestDays.length < 3; d++) {
    if (isAllFree(d)) bestDays.push(d)
  }

  return (
    <div className="relative" aria-hidden>
      <div className="absolute -inset-8 sm:-inset-16 pointer-events-none opacity-60"
        style={{ background: 'radial-gradient(ellipse at center, rgb(94 156 140 / 0.18), transparent 70%)' }} />

      <div ref={cardRef} className="relative bg-surface-900 border border-white/[0.08] rounded-3xl shadow-[0_24px_80px_-24px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[230px_1fr]">

          {/* LEFT — the People panel (PeopleRoster.jsx) */}
          <div className="px-4 py-5 sm:px-5 sm:py-6 border-b md:border-b-0 md:border-r border-white/[0.06]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Users size={14} strokeWidth={1.75} className="text-zinc-500" />
                <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">People</p>
              </div>
              <span className="text-[11px] text-zinc-600">{included} of 3</span>
            </div>

            <div className="space-y-0.5">
              {TEAM.map((p, i) => {
                const inc = i < included
                return (
                  <div key={p.name} className={`flex items-center gap-2.5 rounded-lg px-2 py-2 transition-opacity duration-500 ${inc ? '' : 'opacity-60'}`}>
                    <span className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                      <span className={`w-full h-full flex items-center justify-center text-[11px] font-bold transition-colors duration-500 ${inc ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-zinc-500'}`}>
                        {p.name[0]}
                      </span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[13px] truncate transition-colors duration-500 ${inc ? 'text-zinc-100' : 'text-zinc-500'}`}>{p.name}</span>
                      {p.sub && <span className="block text-[11px] truncate text-zinc-600">{p.sub}</span>}
                    </span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors duration-500 ${inc ? 'bg-accent border-accent text-white' : 'border-white/15 text-transparent'}`}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                  </div>
                )
              })}
            </div>

            <span className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent">
              <UserPlus size={14} strokeWidth={2} /> Add person
            </span>
          </div>

          {/* RIGHT — the Schedule work area (ProjectOverview.jsx). Shrinks while
              the day inspector is open, like the app's in-flow panel. */}
          <div className={`px-4 py-5 sm:px-7 sm:py-6 min-w-0 transition-[margin] duration-300 ease-ios delay-[350ms] ${inspect ? 'md:mr-[290px]' : ''}`}>
            {/* WorkspaceTabs */}
            <div className="inline-flex items-center gap-0.5 bg-surface-900/80 border border-white/[0.05] rounded-xl p-1 mb-5">
              {['Schedule', 'Tasks', 'Whiteboard'].map((label, i) => (
                <span key={label} className={`px-4 py-1.5 rounded-lg text-[13px] font-medium ${i === 0 ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400'}`}>
                  {label}
                </span>
              ))}
            </div>

            <h2 className="text-[17px] font-semibold text-zinc-100 tracking-tight mb-3">When can everyone meet?</h2>

            {/* Time-of-day filter + best-day pills */}
            <div className="flex flex-wrap items-center gap-2 mb-5 min-h-[38px]">
              <div className="inline-flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.05] rounded-lg p-0.5">
                {['Any time', 'Morning', 'Afternoon', 'Evening'].map((label, i) => (
                  <span key={label} className={`px-3 py-1.5 rounded-md text-[12px] font-medium ${i === 0 ? 'bg-surface-700 text-zinc-100 shadow-ring-sm' : 'text-zinc-400'}`}>
                    {label}
                  </span>
                ))}
              </div>
              <span key={bestDays.join()} className="contents">
                {bestDays.map(d => (
                  <span key={d} className="animate-fadeIn inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-[12px] font-medium border text-zinc-100 bg-green-500/[0.10] border-green-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    {pillLabel(d)}
                  </span>
                ))}
              </span>
            </div>

            {/* Month nav */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <h3 className="text-[18px] font-semibold text-zinc-100 tracking-tight">April 2026</h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-zinc-400 px-3">Today</span>
                <span className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400"><ChevronLeft size={18} strokeWidth={1.75} /></span>
                <span className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400"><ChevronRight size={18} strokeWidth={1.75} /></span>
              </div>
            </div>

            {/* Calendar — the real grid: green tint + dot only when the whole
                group (everyone who has responded) is free that day */}
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-7 border-b border-white/[0.06]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] py-2.5 border-r border-white/[0.04] last:border-r-0">
                    <span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }, (_, i) => {
                  const day = i - 2
                  const inMonth = day >= 1 && day <= 30
                  const allFree = inMonth && isAllFree(day)
                  const isWeekend = i % 7 === 0 || i % 7 === 6
                  const isSelected = inspect && day === INSPECT_DAY
                  return (
                    <div
                      key={i}
                      className={`relative min-h-[44px] sm:min-h-[56px] border-r border-b border-white/[0.04] flex items-start justify-start p-2 transition-colors duration-500 ${allFree ? 'bg-green-500/[0.09]' : ''} ${isSelected ? 'ring-2 ring-inset ring-accent bg-accent/[0.04]' : ''}`}
                    >
                      {inMonth && (
                        <span className={`text-[13px] font-medium ${isWeekend ? 'text-zinc-600' : 'text-zinc-200'}`}>{day}</span>
                      )}
                      {allFree && (
                        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Day inspector (DayInspectorPanel) — slides in from the right edge
            when the converged day is selected. Desktop beat only. */}
        {inspect && (
          <div
            className="hidden md:flex absolute inset-y-0 right-0 w-[290px] flex-col bg-surface-900 border-l border-white/[0.06] animate-slideIn"
            style={{ animationDelay: '0.45s', animationFillMode: 'backwards' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.05]">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-1.5">Thursday</p>
                <h3 className="text-[26px] font-semibold text-zinc-50 tracking-tight leading-tight">April 16</h3>
              </div>
              <span className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 -mr-2 flex-shrink-0">
                <X size={16} strokeWidth={1.75} />
              </span>
            </div>

            {/* Best times */}
            <div className="flex-1 px-5 py-5 overflow-hidden">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">Best times for everyone</p>
              <div className="space-y-2">
                <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-accent/10 border-accent/45 text-zinc-50">
                  <div className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: '#5e9c8c' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium leading-tight truncate">9 to 11 AM</p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="text-[13px] font-bold tabular-nums text-accent">3/3</span>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center bg-accent text-white">
                      <Check size={12} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
                <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/10 text-zinc-200">
                  <div className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: '#5e9c8c' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium leading-tight truncate">2 to 4 PM</p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="text-[13px] font-bold tabular-nums text-zinc-400">3/3</span>
                    <div className="w-5 h-5 rounded-full border border-white/20" />
                  </div>
                </div>
              </div>
              <div className="w-full flex items-center justify-between px-3 py-2 mt-3 rounded-lg text-[13px] text-zinc-500">
                <span>Pick a different time</span>
                <span className="text-zinc-600">↓</span>
              </div>
            </div>

            {/* Schedule */}
            <div className="px-5 py-4 border-t border-white/[0.05] space-y-3">
              <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-white text-[15px] font-semibold shadow-[0_8px_24px_-8px_rgb(94_156_140/0.55)]">
                <CalendarPlus size={16} strokeWidth={2} />
                Schedule meeting
              </div>
              <p className="text-[12px] text-zinc-500 text-center leading-relaxed">
                9:00 AM – 11:00 AM · opens in Google Calendar · 3 attendees{' · '}
                <span className="text-zinc-400 underline decoration-zinc-600 underline-offset-2">use Outlook</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function HomePage() {
  const { theme } = useApp()
  // The marketing landing is always light (Arro brand), regardless of the app theme.
  // Restore the user's theme when leaving the page.
  useEffect(() => {
    document.documentElement.classList.add('light')
    return () => { document.documentElement.classList.toggle('light', theme === 'light') }
  }, [theme])
  // The whiteboard vignette's sticky uses the app's real sticky font.
  useEffect(() => {
    if (document.getElementById('coordie-caveat-font')) return
    const link = document.createElement('link')
    link.id = 'coordie-caveat-font'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap'
    document.head.appendChild(link)
  }, [])
  const logoFilter = 'none'

  return (
    <div className="min-h-dvh bg-surface-950 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 sm:px-8 py-5 border-b border-white/5 sticky top-0 bg-surface-950/80 backdrop-blur-xl z-40">
        <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: logoFilter }} />
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:inline">Features</a>
          <a href="#how-it-works" className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:inline">How it works</a>
          <a href="/docs" className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:inline">Docs</a>
          <a
            href="/signin"
            className="text-sm font-medium text-zinc-300 hover:text-white bg-surface-800 hover:bg-surface-700 border border-surface-600 px-4 py-1.5 rounded-lg transition-colors"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* Hero — a faint calendar grid fades out behind the headline */}
      <section className="relative flex flex-col items-center justify-center text-center px-5 pt-24 pb-14 sm:pt-36 sm:pb-16">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(to right, rgb(30 36 41 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(30 36 41 / 0.05) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 75% 70% at 50% 0%, black 25%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 0%, black 25%, transparent 72%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 0%, rgb(94 156 140 / 0.08), transparent 65%)' }}
        />

        <Reveal>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-zinc-100 leading-tight tracking-tight max-w-3xl mb-6">
            Find the day that works for{' '}
            <span className="text-accent">everyone.</span>
          </h1>
        </Reveal>

        <Reveal delay={100}>
          <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed max-w-xl mb-10">
            Add your clients, vendors, and crew to a project, see the days everyone's free,
            and plan the work with shared tasks and a whiteboard.
          </p>
        </Reveal>

        <Reveal delay={200}>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <a
              href="/signin"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors shadow-lg shadow-accent/20"
            >
              Get started free
              <ArrowRight size={15} strokeWidth={2} />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-6 py-3"
            >
              See how it works
            </a>
          </div>

          <p className="text-xs text-zinc-600 mt-5">No credit card required. Room links work without an account.</p>
        </Reveal>
      </section>

      {/* Product Preview — single hero mockup */}
      <section className="px-5 sm:px-8 pt-6 sm:pt-10 pb-16 sm:pb-24 max-w-5xl mx-auto w-full">
        <Reveal>
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">The overlap</p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 max-w-2xl mx-auto leading-tight tracking-tight">
              Everyone shares when they're free, and the days the whole group is free are marked.
            </h2>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <HeroProjectMockup />
        </Reveal>
      </section>

      <Hairline />

      {/* Features */}
      <section id="features" className="px-5 sm:px-8 py-20 sm:py-28 max-w-6xl mx-auto w-full">
        <Reveal>
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">Scheduling, tasks, and a whiteboard in one workspace.</h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {FEATURES.map(({ icon: Icon, title, desc, art: Art }, i) => (
            <Reveal key={title} delay={i * 75}>
              <div className="h-full bg-surface-900 border border-surface-700 rounded-2xl overflow-hidden hover:border-surface-500 hover:shadow-[0_12px_32px_-16px_rgba(30,36,41,0.18)] transition-all group">
                <div className="h-44 border-b border-surface-700/60 flex items-center justify-center px-5 relative overflow-hidden">
                  <Art />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/15 transition-colors">
                      <Icon size={14} strokeWidth={1.75} className="text-accent" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
                  </div>
                  <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Hairline />

      {/* How it works */}
      <section id="how-it-works" className="px-5 sm:px-8 py-20 sm:py-28 max-w-5xl mx-auto w-full">
        <Reveal>
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">Create a project, connect calendars, skip the back-and-forth.</h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
            <Reveal key={step} delay={i * 100}>
              <div className="relative">
                <div className="flex items-center gap-4 mb-4">
                  <p className="text-4xl font-bold text-surface-600 leading-none select-none">{step}</p>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-surface-700 to-transparent" />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Hairline />

      {/* FAQ — a few plain answers; full detail lives in the docs */}
      <section id="faq" className="px-5 sm:px-8 py-20 sm:py-28 max-w-2xl mx-auto w-full">
        <Reveal>
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">Common questions</h2>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="space-y-6">
            {[
              ['Can other people see my calendar events?', 'They see whether you are free, not what you have scheduled. Your event titles are used only to work out your busy times.'],
              ['Does Coordie change my calendar?', 'No. Calendar access is read-only. Scheduling a meeting opens a prefilled event in your own calendar that you send yourself.'],
              ['Do the people I invite need an account?', 'No. Anyone with a project link can join with a name and email. They can create a free account later to keep the project.'],
              ['Who can see a project?', 'The owner, the people they invite, and anyone with the project’s link. Share the link only with people you want in the project.'],
              ['Google or Outlook?', 'Both. Connect either or both, and busy times from all connected calendars are combined.'],
            ].map(([q, a]) => (
              <div key={q} className="border-b border-surface-800 pb-6">
                <p className="text-sm font-semibold text-zinc-100 mb-1.5">{q}</p>
                <p className="text-sm text-zinc-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-zinc-500 mt-10">
            More in the <a href="/docs" className="text-accent hover:underline underline-offset-2">documentation</a>.
          </p>
        </Reveal>
      </section>

      <Hairline />

      {/* CTA */}
      <section className="relative px-5 sm:px-8 py-20 sm:py-28 flex flex-col items-center text-center">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 45% 60% at 50% 100%, rgb(94 156 140 / 0.07), transparent 65%)' }}
        />
        <Reveal className="relative flex flex-col items-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight mb-6 max-w-lg">
            Sign in with Google, Microsoft, or email.
          </h2>
          <a
            href="/signin"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-accent/20"
          >
            Get started free
            <ArrowRight size={15} strokeWidth={2} />
          </a>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="px-5 sm:px-8 py-6 border-t border-surface-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/coordie-logo.svg" alt="Coordie" className="h-4" style={{ filter: logoFilter }} />
            <span className="text-xs text-zinc-600">© {new Date().getFullYear()} Coordie</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <a href="/docs" className="hover:text-zinc-400 transition-colors">Docs</a>
            <a href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
            <a href="/signin" className="hover:text-zinc-400 transition-colors">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

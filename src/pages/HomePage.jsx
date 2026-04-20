import { useState, useEffect } from 'react'
import { useApp } from '../contexts/AppContext'
import { CalendarDays, Users, Link2, CheckCircle2, ArrowRight, Inbox, LayoutGrid, Zap, ChevronLeft, ChevronRight } from 'lucide-react'

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Calendar-driven availability',
    desc: 'Connect Google Calendar and your real schedule drives everything — no manual updates. Events block or hold slots automatically.',
  },
  {
    icon: Users,
    title: 'Rooms for every group',
    desc: "Clients, vendors, and crew each get their own scoped room. They see only what's relevant to them.",
  },
  {
    icon: Link2,
    title: 'Shareable room links',
    desc: 'Copy a link and paste it in your email. Guests join in one click — no account, no app to download.',
  },
  {
    icon: Inbox,
    title: 'Date requests, handled',
    desc: 'Guests select dates from your calendar and send a request. You review, approve, or decline — all in one place.',
  },
  {
    icon: LayoutGrid,
    title: 'Projects, not chaos',
    desc: 'Every production lives in its own space. Groups, notes, messages, and availability — all together.',
  },
  {
    icon: Zap,
    title: 'Real-time collaboration',
    desc: 'Shared notes and messages update live. Both sides are always looking at the same thing.',
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Create a project', desc: 'Add your production with dates, description, and groups for each set of collaborators.' },
  { step: '02', title: 'Connect your calendar', desc: 'Link Google Calendar once. Your real availability updates automatically — no extra work.' },
  { step: '03', title: 'Share a room link', desc: 'Each group gets a unique link. Paste it in your own email. They open it and see their space.' },
  { step: '04', title: 'Coordinate together', desc: 'Guests view availability, request dates, and message you — all without creating an account.' },
]

// Each persona picks a different day, with different owner-available slots
// and a different guest-busy pattern. `slots` are the slots the owner offers
// that day; `busy` means this guest's own calendar conflicts.
const PERSONAS = [
  {
    name: 'Sarah Chen',     day: 17, selectedIdx: 4,
    slots: [
      { time: '9:00 AM',  busy: false },
      { time: '9:30 AM',  busy: true  },
      { time: '10:00 AM', busy: true  },
      { time: '10:30 AM', busy: false },
      { time: '11:00 AM', busy: false },
      { time: '1:00 PM',  busy: false },
      { time: '1:30 PM',  busy: true  },
      { time: '2:00 PM',  busy: false },
    ],
  },
  {
    name: 'Amara Okafor',   day: 22, selectedIdx: 5,
    slots: [
      { time: '10:00 AM', busy: false },
      { time: '10:30 AM', busy: false },
      { time: '11:00 AM', busy: true  },
      { time: '11:30 AM', busy: true  },
      { time: '12:00 PM', busy: false },
      { time: '2:00 PM',  busy: false },
      { time: '2:30 PM',  busy: false },
      { time: '3:00 PM',  busy: true  },
    ],
  },
  {
    name: 'Diego Rivera',   day: 8,  selectedIdx: 2,
    slots: [
      { time: '8:00 AM',  busy: true  },
      { time: '8:30 AM',  busy: false },
      { time: '9:00 AM',  busy: false },
      { time: '9:30 AM',  busy: true  },
      { time: '10:00 AM', busy: false },
      { time: '10:30 AM', busy: true  },
      { time: '11:00 AM', busy: false },
    ],
  },
  {
    name: 'Priya Patel',    day: 15, selectedIdx: 4,
    slots: [
      { time: '12:00 PM', busy: false },
      { time: '12:30 PM', busy: true  },
      { time: '1:00 PM',  busy: true  },
      { time: '1:30 PM',  busy: false },
      { time: '2:00 PM',  busy: false },
      { time: '2:30 PM',  busy: false },
      { time: '3:00 PM',  busy: true  },
      { time: '3:30 PM',  busy: false },
    ],
  },
  {
    name: 'Zainab Ali',     day: 24, selectedIdx: 1,
    slots: [
      { time: '9:00 AM',  busy: false },
      { time: '9:30 AM',  busy: false },
      { time: '10:00 AM', busy: true  },
      { time: '11:00 AM', busy: true  },
      { time: '11:30 AM', busy: false },
      { time: '12:00 PM', busy: false },
    ],
  },
  {
    name: 'Mei Tanaka',     day: 10, selectedIdx: 1,
    slots: [
      { time: '10:30 AM', busy: true  },
      { time: '11:00 AM', busy: false },
      { time: '11:30 AM', busy: false },
      { time: '1:00 PM',  busy: true  },
      { time: '1:30 PM',  busy: true  },
      { time: '2:00 PM',  busy: false },
      { time: '2:30 PM',  busy: false },
    ],
  },
]

// April 2026 day labels (April 1 is a Wednesday)
function weekdayLabel(day, format = 'long') {
  const d = new Date(2026, 3, day)
  return d.toLocaleDateString('en-US', { weekday: format })
}

// Phase sequence: fully-scripted booking flow demo
// idle → click-date → click-connect → click-slot → form → type → submit → success → loop
const PHASES = [
  { name: 'idle',              duration: 1400 },
  { name: 'cursor-to-date',    duration: 1200 },
  { name: 'click-date',        duration: 700  },
  { name: 'cursor-to-connect', duration: 1100 },
  { name: 'click-connect',     duration: 700  },
  { name: 'cursor-to-slot',    duration: 1300 },
  { name: 'click-slot',        duration: 700  },
  { name: 'form-entering',     duration: 700  },
  { name: 'cursor-to-name',    duration: 800  },
  { name: 'typing-name',       duration: 1800 },
  { name: 'cursor-to-submit',  duration: 900  },
  { name: 'click-submit',      duration: 700  },
  { name: 'success',           duration: 2400 },
]

function HeroBookingMockup() {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const phase = PHASES[phaseIdx].name

  // Random persona each cycle — different name, day, slots, busy pattern
  const [personaIdx, setPersonaIdx] = useState(() => Math.floor(Math.random() * PERSONAS.length))
  const persona = PERSONAS[personaIdx]
  const guestName = persona.name
  const slots = persona.slots
  const selectedSlotIdx = persona.selectedIdx
  const pickedDay = persona.day

  useEffect(() => {
    const t = setTimeout(() => {
      const next = (phaseIdx + 1) % PHASES.length
      setPhaseIdx(next)
      if (next === 0) {
        setPersonaIdx(prev => {
          let pick = Math.floor(Math.random() * PERSONAS.length)
          if (pick === prev) pick = (pick + 1) % PERSONAS.length
          return pick
        })
      }
    }, PHASES[phaseIdx].duration)
    return () => clearTimeout(t)
  }, [phaseIdx])

  // Derived state
  const isDateSelected = phaseIdx >= 2         // after click-date
  const isConnected    = phaseIdx >= 4         // after click-connect
  const isSlotSelected = phaseIdx >= 6         // after click-slot
  const showForm       = phaseIdx >= 7 && phaseIdx <= 11
  const showSuccess    = phaseIdx >= 12

  // Typing animation: characters appear progressively during the 'typing-name' phase
  const [typedChars, setTypedChars] = useState(0)
  useEffect(() => {
    if (phase !== 'typing-name') {
      setTypedChars(showForm && phaseIdx > 9 ? guestName.length : 0)
      return
    }
    setTypedChars(0)
    const start = Date.now()
    const tick = setInterval(() => {
      const chars = Math.min(guestName.length, Math.floor((Date.now() - start) / 150))
      setTypedChars(chars)
      if (chars >= guestName.length) clearInterval(tick)
    }, 70)
    return () => clearInterval(tick)
  }, [phase, phaseIdx, showForm])

  return (
    <div className="relative">
      {/* Ambient purple glow behind the card */}
      <div className="absolute -inset-8 sm:-inset-16 pointer-events-none opacity-60"
        style={{ background: 'radial-gradient(ellipse at center, rgb(139 92 246 / 0.16), transparent 70%)' }} />

      <div className="relative bg-surface-900 border border-white/[0.08] rounded-3xl shadow-[0_24px_80px_-24px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr]">

          {/* LEFT — month calendar */}
          <div className="px-6 sm:px-8 py-7 sm:py-9 border-b md:border-b-0 md:border-r border-white/[0.06]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-zinc-50 tracking-tight">April 2026</h3>
              <div className="flex items-center gap-1 text-zinc-600">
                <ChevronLeft size={14} strokeWidth={1.75} />
                <ChevronRight size={14} strokeWidth={1.75} />
              </div>
            </div>
            <div className="grid grid-cols-7 mb-2">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: 35 }, (_, i) => {
                const day = i - 2
                const inMonth = day >= 1 && day <= 30
                const isThisDate = day === pickedDay
                const isSelected = isThisDate && isDateSelected
                const isToday = day === 12
                const hasFree = inMonth && isConnected && [2,3,8,9,10,15,16,17,21,22,23,24,28,29,30].includes(day)
                const isClickFlash = isThisDate && phase === 'click-date'

                return (
                  <div
                    key={i}
                    className={`relative aspect-square flex items-center justify-center text-[12px] rounded-full font-medium transition-all duration-300 ease-ios
                      ${!inMonth ? 'text-transparent' :
                        isSelected ? 'bg-accent text-white shadow-[0_3px_10px_-3px_rgb(139_92_246/0.35)]' :
                        isClickFlash ? 'bg-accent/20 text-zinc-50' :
                        'text-zinc-200'}`}
                  >
                    {inMonth && <span>{day}</span>}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                    )}
                    {hasFree && !isSelected && !isToday && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-400/80" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT — dynamic content by phase */}
          <div className="relative px-6 sm:px-8 py-7 sm:py-9 flex flex-col min-h-[400px]">
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">{weekdayLabel(pickedDay, 'long')}</p>
              <p className="text-2xl font-semibold text-zinc-100 tracking-tight leading-none mt-0.5">{pickedDay}</p>
            </div>

            {/* Slot list view (phases 0-7) */}
            {!showForm && !showSuccess && (
              <>
                <div className="h-7 mb-4 flex items-center">
                  {!isConnected ? (
                    <button
                      className={`inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-200 border border-white/10 rounded-full px-3 py-1.5 transition-all
                        ${phase === 'click-connect' ? 'bg-accent/25 border-accent/50' : 'bg-white/[0.04]'}`}
                    >
                      <CalendarDays size={10} strokeWidth={2} />
                      Connect Calendar
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1 animate-fadeIn">
                      <CheckCircle2 size={10} strokeWidth={2.25} />
                      Your calendar connected
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  {slots.map((slot, i) => {
                    const isThisSlotSelected = i === selectedSlotIdx && isSlotSelected
                    const isClickFlash = i === selectedSlotIdx && phase === 'click-slot' && !isThisSlotSelected
                    const showBusy = isConnected && slot.busy
                    return (
                      <div key={slot.time}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-300 ease-ios ${
                          isThisSlotSelected
                            ? 'bg-accent text-white shadow-[0_3px_10px_-3px_rgb(139_92_246/0.3)]'
                            : isClickFlash
                            ? 'bg-accent/15 border border-accent/40 text-zinc-100'
                            : showBusy
                            ? 'border border-white/[0.04] text-zinc-600'
                            : 'border border-white/10 text-zinc-200'
                        }`}>
                        <span>{slot.time}</span>
                        {showBusy && !isThisSlotSelected && !isClickFlash && (
                          <span className="flex items-center gap-1 text-[9px] text-zinc-700">
                            <span className="w-1 h-1 rounded-full bg-zinc-700" />
                            busy
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Form view (phases 7-11) */}
            {showForm && !showSuccess && (
              <div className="flex-1 flex flex-col animate-fadeIn">
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-zinc-100">{slots[selectedSlotIdx].time}</p>
                    <p className="text-[10px] text-zinc-500">30 minutes · {weekdayLabel(pickedDay, 'long')}, April {pickedDay}</p>
                  </div>
                </div>

                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-1.5">Your name</p>
                <div
                  className={`w-full flex items-center bg-white/[0.03] border rounded-lg px-3 py-2.5 text-[13px] text-zinc-100 transition-all
                    ${phase === 'cursor-to-name' || phase === 'typing-name' ? 'border-accent/50 shadow-[0_0_0_2px_rgba(139,92,246,0.12)]' : 'border-white/10'}`}
                >
                  <span>{guestName.slice(0, typedChars)}</span>
                  {phase === 'typing-name' && typedChars < guestName.length && (
                    <span className="inline-block w-px h-4 bg-zinc-300 ml-0.5 animate-pulse" />
                  )}
                  {typedChars === 0 && phase !== 'typing-name' && (
                    <span className="text-zinc-600">Your name</span>
                  )}
                </div>

                <div className="flex-1" />

                <button
                  className={`w-full mt-5 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold transition-all
                    ${phase === 'click-submit'
                      ? 'bg-accent text-white shadow-[0_3px_10px_-3px_rgb(139_92_246/0.35)] scale-[0.99]'
                      : 'bg-accent text-white'}`}
                >
                  Book it
                  <ArrowRight size={12} strokeWidth={2.25} />
                </button>
              </div>
            )}

            {/* Success view (phase 12) */}
            {showSuccess && (
              <div className="flex-1 flex flex-col items-center justify-center text-center animate-fadeIn">
                <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mb-4">
                  <CheckCircle2 size={22} strokeWidth={2} className="text-green-400" />
                </div>
                <p className="text-[18px] font-semibold text-zinc-50 tracking-tight mb-1">You're booked</p>
                <p className="text-[12px] text-zinc-500">{guestName} · {weekdayLabel(pickedDay, 'short')} Apr {pickedDay}, {slots[selectedSlotIdx].time}</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

export function HomePage() {
  const { theme } = useApp()
  const logoFilter = theme === 'dark' ? 'invert(1)' : 'none'

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 sm:px-8 py-5 border-b border-white/5 sticky top-0 bg-surface-950/80 backdrop-blur-xl z-40">
        <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: logoFilter }} />
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:inline">Features</a>
          <a href="#how-it-works" className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:inline">How it works</a>
          <a
            href="/signin"
            className="text-sm font-medium text-zinc-300 hover:text-white bg-surface-800 hover:bg-surface-700 border border-surface-600 px-4 py-1.5 rounded-lg transition-colors"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-5 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-accent text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
          Built for creative productions
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-zinc-100 leading-tight max-w-3xl mb-6">
          Coordinate your projects,{' '}
          <span className="text-accent">beautifully.</span>
        </h1>

        <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed max-w-xl mb-10">
          Share availability, manage groups, and keep every production organized —
          without the back-and-forth.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
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
      </section>

      {/* Product Preview — single hero mockup */}
      <section className="px-5 sm:px-8 py-16 sm:py-24 max-w-5xl mx-auto w-full">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">The magic</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 max-w-2xl mx-auto leading-tight tracking-tight">
            Guests connect their calendar — and instantly see which times actually work.
          </h2>
          <p className="text-zinc-500 text-base mt-4 max-w-lg mx-auto">
            No more "let me check and get back to you." The slots they're already busy in dim out automatically.
          </p>
        </div>
        <HeroBookingMockup />
      </section>

      {/* Divider */}
      <div className="w-full border-t border-surface-800" />

      {/* Features */}
      <section id="features" className="px-5 sm:px-8 py-20 sm:py-28 max-w-6xl mx-auto w-full">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-3">Everything you need to coordinate</h2>
          <p className="text-zinc-500 text-base max-w-xl mx-auto">
            One tool for availability, communication, and scheduling — designed around how creative productions actually work.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-surface-900 border border-surface-700 rounded-2xl p-6 hover:border-surface-500 transition-colors group"
            >
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/15 transition-colors">
                <Icon size={16} strokeWidth={1.75} className="text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-surface-800" />

      {/* How it works */}
      <section id="how-it-works" className="px-5 sm:px-8 py-20 sm:py-28 max-w-5xl mx-auto w-full">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-3">Up and running in minutes</h2>
          <p className="text-zinc-500 text-base max-w-xl mx-auto">
            No onboarding, no setup calls. Create a project, connect your calendar, share a link.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div key={step} className="relative">
              <p className="text-4xl font-bold text-surface-700 mb-4 leading-none select-none">{step}</p>
              <h3 className="text-sm font-semibold text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-surface-800" />

      {/* CTA */}
      <section className="px-5 sm:px-8 py-20 sm:py-28 flex flex-col items-center text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-4 max-w-lg">
          Ready to coordinate better?
        </h2>
        <p className="text-zinc-500 text-base mb-8 max-w-sm">
          Sign in with Google and have your first project set up in under five minutes.
        </p>
        <a
          href="/signin"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-accent/20"
        >
          Get started free
          <ArrowRight size={15} strokeWidth={2} />
        </a>
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-sm text-zinc-600">
          {['No credit card required', 'Room links work without an account', 'Free to use'].map(text => (
            <span key={text} className="flex items-center gap-1.5">
              <CheckCircle2 size={13} strokeWidth={2} className="text-zinc-600" />
              {text}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 sm:px-8 py-6 border-t border-surface-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/coordie-logo.svg" alt="Coordie" className="h-4" style={{ filter: logoFilter }} />
            <span className="text-xs text-zinc-600">© {new Date().getFullYear()} Coordie</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <a href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
            <a href="/signin" className="hover:text-zinc-400 transition-colors">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

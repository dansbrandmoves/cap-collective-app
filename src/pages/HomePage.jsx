import { useState, useEffect, useRef } from 'react'
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

// busy=true means guest's calendar shows them busy — slot dims
const HERO_SLOTS = [
  { time: '9:00 AM',  busy: false },
  { time: '9:30 AM',  busy: true  },
  { time: '10:00 AM', busy: true  },
  { time: '10:30 AM', busy: false },
  { time: '11:00 AM', busy: false },
  { time: '1:00 PM',  busy: false },
  { time: '1:30 PM',  busy: true  },
  { time: '2:00 PM',  busy: false },
]

const HERO_FREE_INDICES = HERO_SLOTS
  .map((s, i) => s.busy ? -1 : i)
  .filter(i => i >= 0)

function MockupCursor() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="#1a1a1a" strokeWidth="1.4"
      style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
    </svg>
  )
}

function HeroBookingMockup() {
  // step 0 = not connected (cursor on Connect button)
  // step 1..N = connected, cursor on free slot (step-1)
  const TOTAL_STEPS = HERO_FREE_INDICES.length + 1
  const [step, setStep] = useState(0)

  useEffect(() => {
    const delay = step === 0 ? 2400 : 1600
    const t = setTimeout(() => setStep(s => (s + 1) % TOTAL_STEPS), delay)
    return () => clearTimeout(t)
  }, [step, TOTAL_STEPS])

  const isConnected = step > 0
  const selected = isConnected ? HERO_FREE_INDICES[step - 1] : null

  // Track cursor position relative to the right column
  const rightColRef = useRef(null)
  const slotElRefs = useRef([])
  const connectBtnRef = useRef(null)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const target = isConnected ? slotElRefs.current[selected] : connectBtnRef.current
    const container = rightColRef.current
    if (target && container) {
      const tRect = target.getBoundingClientRect()
      const cRect = container.getBoundingClientRect()
      setCursorPos({
        x: tRect.left - cRect.left + 28,
        y: tRect.top - cRect.top + tRect.height / 2 - 6,
      })
    }
  }, [step, selected, isConnected])

  return (
    <div className="relative">
      {/* Ambient purple glow behind the card */}
      <div className="absolute -inset-8 sm:-inset-16 pointer-events-none opacity-60"
        style={{ background: 'radial-gradient(ellipse at center, rgb(139 92 246 / 0.18), transparent 70%)' }} />

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
                const isSelected = day === 17
                const isToday = day === 12
                // Days the guest has free time (sample: weekdays not heavily booked)
                const hasFree = inMonth && [2,3,8,9,10,15,16,17,21,22,23,24,28,29,30].includes(day)
                return (
                  <div key={i} className={`relative aspect-square flex items-center justify-center text-[12px] rounded-full font-medium transition-colors
                    ${!inMonth ? 'text-transparent' :
                      isSelected ? 'bg-accent text-white shadow-[0_4px_16px_-4px_rgb(139_92_246/0.5)]' :
                      'text-zinc-200'}`}>
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

          {/* RIGHT — time slots with personal calendar overlay */}
          <div ref={rightColRef} className="relative px-6 sm:px-8 py-7 sm:py-9 flex flex-col">
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">Friday</p>
              <p className="text-2xl font-semibold text-zinc-100 tracking-tight leading-none mt-0.5">17</p>
            </div>

            {/* Pre/post-connect swap — fixed-height row so layout doesn't shift */}
            <div className="h-7 mb-4 flex items-center">
              {!isConnected ? (
                <button
                  ref={connectBtnRef}
                  className="inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-full px-3 py-1.5 transition-colors"
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
              {HERO_SLOTS.map((slot, i) => {
                const isSelected = isConnected && i === selected
                const showBusy = isConnected && slot.busy
                return (
                  <div key={slot.time}
                    ref={el => { slotElRefs.current[i] = el }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-300 ease-ios ${
                      isSelected
                        ? 'bg-accent text-white shadow-[0_8px_24px_-8px_rgb(139_92_246/0.5)]'
                        : showBusy
                        ? 'border border-white/[0.04] text-zinc-600'
                        : 'border border-white/10 text-zinc-200'
                    }`}>
                    <span>{slot.time}</span>
                    {showBusy && !isSelected && (
                      <span className="flex items-center gap-1 text-[9px] text-zinc-700">
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        busy
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Animated cursor — flies to Connect button, then between free slots */}
            <div
              className="absolute pointer-events-none z-10 transition-transform duration-700 ease-ios"
              style={{ transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)` }}
            >
              <MockupCursor />
            </div>
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

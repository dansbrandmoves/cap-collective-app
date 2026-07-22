import { useState, useEffect, useRef } from 'react'
import { useApp } from '../contexts/AppContext'
import { CalendarDays, Users, CheckCircle2, ArrowRight, LayoutGrid, Shapes, ChevronLeft, ChevronRight } from 'lucide-react'

const FEATURES = [
  {
    icon: Users,
    title: 'When can everyone meet?',
    desc: 'Add everyone to a project and the days the whole group is free are marked. Filter by morning, afternoon, or evening.',
  },
  {
    icon: CalendarDays,
    title: 'Calendar-driven availability',
    desc: 'Connect Google or Outlook and your busy times are excluded automatically, for you and everyone you invite.',
  },
  {
    icon: LayoutGrid,
    title: 'Shared tasks',
    desc: 'A Trello-style board with lists, cards, and assignees, shared with everyone on the project.',
  },
  {
    icon: Shapes,
    title: 'A shared whiteboard',
    desc: 'An infinite canvas with sticky notes, shapes, images, and arrows.',
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Create a project', desc: 'Name it and add the clients, vendors, and crew.' },
  { step: '02', title: 'Everyone shares their time', desc: 'Each person connects a calendar or taps their free days. No account needed.' },
  { step: '03', title: 'See the day that works', desc: 'The days the whole group is free are marked. Pick one to send the meeting and plan the work.' },
]

// The group whose availability converges in the hero demo. Each person's free
// days are real overlapping sets — the intersection (everyone free) is 16 & 23.
const TEAM = [
  { name: 'Sarah Chen',   role: 'Client', via: 'calendar', free: [2, 3, 9, 16, 17, 23, 24, 30] },
  { name: 'Diego Rivera', role: 'Vendor', via: 'tapped',   free: [8, 9, 15, 16, 22, 23, 29] },
  { name: 'Priya Patel',  role: 'Crew',   via: 'calendar', free: [3, 10, 16, 17, 23, 24, 30] },
]
const HERO_DAY = 16 // the day everyone lands on

// April 2026 day labels (April 1 is a Wednesday)
function weekdayLabel(day, format = 'long') {
  const d = new Date(2026, 3, day)
  return d.toLocaleDateString('en-US', { weekday: format })
}

// Scripted "when can everyone meet" demo: people share availability one by one,
// the calendar converges, and the day everyone's free turns green.
const PROJECT_PHASES = [
  { joined: 0, duration: 1500 },
  { joined: 1, duration: 1400 },
  { joined: 2, duration: 1400 },
  { joined: 3, duration: 1600 },
  { joined: 3, answer: true, duration: 2800 },
]

function HeroProjectMockup() {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const phase = PROJECT_PHASES[phaseIdx]
  const joined = phase.joined
  const showAnswer = !!phase.answer
  const joinedTeam = TEAM.slice(0, joined)

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
    const t = setTimeout(() => setPhaseIdx(p => (p + 1) % PROJECT_PHASES.length), phase.duration)
    return () => clearTimeout(t)
  }, [phaseIdx, inView, phase.duration])

  // How many of the joined people are free on a given day.
  function freeCount(day) {
    return joinedTeam.filter(p => p.free.includes(day)).length
  }

  return (
    <div className="relative">
      <div className="absolute -inset-8 sm:-inset-16 pointer-events-none opacity-60"
        style={{ background: 'radial-gradient(ellipse at center, rgb(94 156 140 / 0.18), transparent 70%)' }} />

      <div ref={cardRef} className="relative bg-surface-900 border border-white/[0.08] rounded-3xl shadow-[0_24px_80px_-24px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr]">

          {/* LEFT — month calendar that converges on green */}
          <div className="px-6 sm:px-8 py-7 sm:py-9 border-b md:border-b-0 md:border-r border-white/[0.06]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-zinc-50 tracking-tight">April 2026</h3>
              <div className="flex items-center gap-1 text-zinc-600">
                <ChevronLeft size={14} strokeWidth={1.75} />
                <ChevronRight size={14} strokeWidth={1.75} />
              </div>
            </div>
            {/* Same lined grid + green circles as the product */}
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <div className="grid grid-cols-7 border-b border-white/[0.07]">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                  <div key={d} className="text-center text-[9px] font-semibold text-zinc-500 uppercase tracking-[0.1em] py-1.5 border-r border-white/[0.04] last:border-r-0">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }, (_, i) => {
                  const day = i - 2
                  const inMonth = day >= 1 && day <= 30
                  const fc = inMonth ? freeCount(day) : 0
                  const allFree = joined > 0 && fc === joined
                  return (
                    <div
                      key={i}
                      className={`relative min-h-[40px] sm:min-h-[48px] border-r border-b border-white/[0.04] flex items-start justify-start p-1.5 transition-colors duration-500 ${allFree ? 'bg-green-500/[0.09]' : ''}`}
                    >
                      {inMonth && (
                        allFree ? (
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white font-bold text-[11px]">{day}</span>
                        ) : (
                          <span className="text-[12px] font-medium text-zinc-300">{day}</span>
                        )
                      )}
                      {inMonth && !allFree && fc > 0 && (
                        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-400/60" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* RIGHT — roster fills in, then the answer */}
          <div className="relative px-6 sm:px-8 py-7 sm:py-9 flex flex-col min-h-[400px]">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-4">Who can make it</p>

            <div className="space-y-1.5">
              {TEAM.map((p, i) => {
                const isIn = i < joined
                return (
                  <div key={p.name}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-500 ease-ios ${
                      isIn ? 'bg-white/[0.03] border-white/[0.08]' : 'border-white/[0.04] opacity-40'
                    }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${
                      isIn ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/[0.04] text-zinc-600 border border-white/10'
                    }`}>
                      {p.name[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${isIn ? 'text-zinc-100' : 'text-zinc-500'}`}>{p.name}</p>
                      <p className="text-[10px] text-zinc-500">{p.role}</p>
                    </div>
                    {isIn ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-green-400 flex-shrink-0">
                        <CheckCircle2 size={11} strokeWidth={2.25} />
                        {p.via === 'calendar' ? 'Synced' : 'Shared'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-600 italic flex-shrink-0">waiting…</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex-1" />

            {/* The answer */}
            {showAnswer ? (
              <div className="animate-fadeIn rounded-xl border border-green-500/30 bg-green-500/[0.08] px-4 py-3.5">
                <p className="text-[10px] font-semibold text-green-400/80 uppercase tracking-[0.12em] mb-1">Best day for everyone</p>
                <div className="flex items-center justify-between">
                  <p className="text-[17px] font-semibold text-zinc-50 tracking-tight">
                    {weekdayLabel(HERO_DAY, 'long')}, Apr {HERO_DAY}
                  </p>
                  <span className="text-[12px] font-bold text-green-400 tabular-nums">3/3 free</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] px-4 py-3.5">
                <p className="text-[13px] text-zinc-500">
                  {joined === 0 ? 'Add your people and share their links.' : `${joined} of 3 shared. Finding the overlap…`}
                </p>
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
  // The marketing landing is always light (Arro brand), regardless of the app theme.
  // Restore the user's theme when leaving the page.
  useEffect(() => {
    document.documentElement.classList.add('light')
    return () => { document.documentElement.classList.toggle('light', theme === 'light') }
  }, [theme])
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

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-5 pt-24 pb-24 sm:pt-36 sm:pb-32">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-zinc-100 leading-tight max-w-3xl mb-6">
          Find the day that works for{' '}
          <span className="text-accent">everyone.</span>
        </h1>

        <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed max-w-xl mb-10">
          Add your clients, vendors, and crew to a project, see the days everyone's free,
          and plan the work with shared tasks and a whiteboard.
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
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">The overlap</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 max-w-2xl mx-auto leading-tight tracking-tight">
            Everyone shares when they're free, and the days the whole group is free are marked.
          </h2>
        </div>
        <HeroProjectMockup />
      </section>

      {/* Divider */}
      <div className="w-full border-t border-surface-800" />

      {/* Features */}
      <section id="features" className="px-5 sm:px-8 py-20 sm:py-28 max-w-6xl mx-auto w-full">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100">Scheduling, tasks, and a whiteboard in one workspace.</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
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
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100">Create a project, everyone shares their time, see the day.</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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

      {/* FAQ — a few plain answers; full detail lives in the docs */}
      <section id="faq" className="px-5 sm:px-8 py-20 sm:py-28 max-w-2xl mx-auto w-full">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100">Common questions</h2>
        </div>
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
      </section>

      {/* Divider */}
      <div className="w-full border-t border-surface-800" />

      {/* CTA */}
      <section className="px-5 sm:px-8 py-20 sm:py-28 flex flex-col items-center text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-6 max-w-lg">
          Sign in with Google, Microsoft, or email.
        </h2>
        <a
          href="/signin"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-accent/20"
        >
          Get started free
          <ArrowRight size={15} strokeWidth={2} />
        </a>
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

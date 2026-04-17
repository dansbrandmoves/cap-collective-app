import { useApp } from '../contexts/AppContext'
import { CalendarDays, Users, Link2, CheckCircle2, ArrowRight, Inbox, LayoutGrid, Zap } from 'lucide-react'

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

export function HomePage() {
  const { theme } = useApp()
  const logoFilter = theme === 'dark' ? 'invert(1)' : 'none'

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-12 py-5 border-b border-surface-800/60 sticky top-0 bg-surface-950/90 backdrop-blur-sm z-40">
        <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: logoFilter }} />
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:inline">Features</a>
          <a href="#how-it-works" className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:inline">How it works</a>
          <a
            href="/"
            className="text-sm font-medium text-zinc-300 hover:text-white bg-surface-800 hover:bg-surface-700 border border-surface-600 px-4 py-1.5 rounded-lg transition-colors"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
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
            href="/"
            className="inline-flex items-center gap-2 bg-accent hover:bg-amber-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors shadow-lg shadow-accent/20"
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

      {/* Divider */}
      <div className="w-full border-t border-surface-800" />

      {/* Features */}
      <section id="features" className="px-6 sm:px-12 py-20 sm:py-28 max-w-6xl mx-auto w-full">
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
      <section id="how-it-works" className="px-6 sm:px-12 py-20 sm:py-28 max-w-5xl mx-auto w-full">
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
      <section className="px-6 sm:px-12 py-20 sm:py-28 flex flex-col items-center text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 mb-4 max-w-lg">
          Ready to coordinate better?
        </h2>
        <p className="text-zinc-500 text-base mb-8 max-w-sm">
          Sign in with Google and have your first project set up in under five minutes.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 bg-accent hover:bg-amber-500 text-white font-semibold text-sm px-7 py-3.5 rounded-xl transition-colors shadow-lg shadow-accent/20"
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
      <footer className="px-6 sm:px-12 py-6 border-t border-surface-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/coordie-logo.svg" alt="Coordie" className="h-4" style={{ filter: logoFilter }} />
            <span className="text-xs text-zinc-600">© {new Date().getFullYear()} Coordie</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <a href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
            <a href="/" className="hover:text-zinc-400 transition-colors">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

import { useApp } from '../contexts/AppContext'

export function HomePage() {
  const { theme } = useApp()

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-12 py-5">
        <img
          src="/coordie-logo.svg"
          alt="Coordie"
          className="h-6"
          style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }}
        />
        <a
          href="/"
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Sign in
        </a>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold text-zinc-100 leading-tight mb-4">
            Coordinate your projects, beautifully.
          </h1>
          <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
            Coordie helps you manage availability, share schedules with clients,
            and keep every project organized — all in one place.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
          >
            Get Started →
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 sm:px-12 py-6 border-t border-surface-700">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <span>© {new Date().getFullYear()} Coordie</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

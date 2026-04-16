import { NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'

const NAV = [
  { to: '/', label: 'Projects', icon: '⬡' },
  { to: '/availability', label: 'Availability', icon: '◷' },
  { to: '/calendars', label: 'Settings', icon: '⚙' },
]

export function Sidebar({ mobileOpen = false, onMobileClose }) {
  const { productions, user, signOut, theme, toggleTheme, getTotalPendingRequests, getPendingRequestCount } = useApp()
  const navigate = useNavigate()

  const totalPending = getTotalPendingRequests()

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onMobileClose} />
      )}
    <aside className={`w-56 flex-shrink-0 bg-surface-900 border-r border-surface-700 flex flex-col h-screen
      fixed inset-y-0 left-0 z-50 transition-transform duration-200
      md:sticky md:translate-x-0 md:z-auto
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-700">
        <div className="flex items-center gap-2.5">
          <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-surface-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-800'
              }`
            }
          >
            <span className="text-base opacity-70">{icon}</span>
            <span className="flex-1">{label}</span>
            {label === 'Projects' && totalPending > 0 && (
              <span className="bg-accent text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                {totalPending > 9 ? '9+' : totalPending}
              </span>
            )}
          </NavLink>
        ))}

        {/* Projects list */}
        {productions.length > 0 && (
          <div className="pt-4">
            <p className="px-3 text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Projects</p>
            {productions.map(p => {
              const pending = getPendingRequestCount(p.id)
              return (
                <NavLink
                  key={p.id}
                  to={`/production/${p.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-surface-700 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-800'
                    }`
                  }
                >
                  <span className="flex-1 truncate">{p.name}</span>
                  {pending > 0 && (
                    <span className="bg-accent text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {pending > 9 ? '9+' : pending}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        )}
      </nav>

      {/* Footer: user + theme toggle */}
      <div className="px-4 py-4 border-t border-surface-700 space-y-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors"
        >
          <span className="text-sm">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        {user && (
          <div className="flex items-center gap-2 px-3 py-2">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {(user.user_metadata?.full_name || user.email)?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className="text-xs text-zinc-400 truncate flex-1">
              {user.user_metadata?.full_name || user.email}
            </span>
            <button onClick={signOut} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  )
}

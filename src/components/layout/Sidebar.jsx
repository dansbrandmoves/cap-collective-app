import { NavLink } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import { NotificationsDropdown } from '../ui/NotificationsDropdown'
import { LayoutGrid, Inbox, CalendarDays, Settings, Sun, Moon, LogOut } from 'lucide-react'

const NAV = [
  { to: '/', label: 'Projects', icon: LayoutGrid, showBadge: false },
  { to: '/inbox', label: 'Inbox', icon: Inbox, showBadge: true },
  { to: '/availability', label: 'Availability', icon: CalendarDays, showBadge: false },
  { to: '/calendars', label: 'Settings', icon: Settings, showBadge: false },
]

export function Sidebar({ mobileOpen = false, onMobileClose }) {
  const { productions, user, signOut, theme, toggleTheme, getTotalPendingRequests, getPendingRequestCount } = useApp()

  const totalPending = getTotalPendingRequests()

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onMobileClose} />
      )}
      <aside className={`w-56 flex-shrink-0 bg-surface-900 border-r border-surface-700 flex flex-col
        fixed inset-y-0 left-0 z-50 transition-transform duration-200
        md:sticky md:top-0 md:h-screen md:translate-x-0 md:z-auto
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-surface-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
            <NotificationsDropdown />
          </div>
        </div>

        {/* Scrollable nav — everything goes here so nothing gets cut off */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, showBadge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-surface-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-800'
                }`
              }
            >
              <Icon size={16} strokeWidth={1.75} className="flex-shrink-0 opacity-80" />
              <span className="flex-1">{label}</span>
              {showBadge && totalPending > 0 && (
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
                    onClick={onMobileClose}
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

          {/* Sign out — inside the scrollable area so it's never cut off */}
          <div className="pt-4 border-t border-surface-800 mt-4">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors"
            >
              {theme === 'dark'
                ? <Sun size={16} strokeWidth={1.75} className="flex-shrink-0" />
                : <Moon size={16} strokeWidth={1.75} className="flex-shrink-0" />
              }
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>

            {user && (
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={16} strokeWidth={1.75} className="flex-shrink-0" />
                Sign out
              </button>
            )}
          </div>
        </nav>

        {/* Footer: user info only */}
        {user && (
          <div className="px-4 py-3 border-t border-surface-700 flex-shrink-0 flex items-center gap-2">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {(user.user_metadata?.full_name || user.email)?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className="text-xs text-zinc-400 truncate">{user.user_metadata?.full_name || user.email}</span>
          </div>
        )}
      </aside>
    </>
  )
}

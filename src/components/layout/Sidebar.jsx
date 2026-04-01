import { NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⬡' },
  { to: '/calendars', label: 'Calendars', icon: '◷' },
]

export function Sidebar({ mobileOpen = false, onMobileClose }) {
  const { productions, getTotalUnread, isOwner, setIsOwner } = useApp()
  const navigate = useNavigate()

  const totalUnread = productions.reduce((sum, p) => sum + getTotalUnread(p.id), 0)

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
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-black text-xs font-bold">CC</span>
          </div>
          <span className="text-sm font-semibold text-zinc-100 tracking-wide">Cap Collective</span>
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
            <span>{label}</span>
            {label === 'Dashboard' && totalUnread > 0 && (
              <span className="ml-auto bg-accent text-black text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </NavLink>
        ))}

        {/* Productions list */}
        {productions.length > 0 && (
          <div className="pt-4">
            <p className="px-3 text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Productions</p>
            {productions.map(p => {
              const unread = getTotalUnread(p.id)
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
                  {unread > 0 && (
                    <span className="bg-accent text-black text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        )}
      </nav>

      {/* Owner mode toggle */}
      <div className="px-4 py-4 border-t border-surface-700">
        <button
          onClick={() => setIsOwner(v => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-surface-800 transition-colors"
        >
          <span className="text-sm">{isOwner ? '🔒' : '👤'}</span>
          <span>{isOwner ? 'Owner view' : 'Guest preview'}</span>
          <span className="ml-auto text-zinc-600 text-xs">switch</span>
        </button>
      </div>
    </aside>
    </>
  )
}

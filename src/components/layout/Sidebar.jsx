import { NavLink } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import { useResizablePanel, ResizeHandle } from '../../hooks/useResizablePanel'
import { LayoutGrid, CalendarCheck, LogOut, Shield, PanelLeft } from 'lucide-react'

// Primary destinations live at the top ("what you do"); configuration/utility is
// pinned to the bottom ("settings"). Keeps the nav uncluttered and scannable.
const PRIMARY_NAV = [
  { to: '/', label: 'Projects', icon: LayoutGrid },
]
const UTILITY_NAV = [
  { to: '/booking-pages', label: 'Booking', icon: CalendarCheck },
]

const RAIL = 60 // collapsed icon-rail width

export function Sidebar({ mobileOpen = false, onMobileClose }) {
  const { productions, user, signOut, theme, isAdmin, avatarUrl } = useApp()
  const panel = useResizablePanel('coordie-nav', { defaultWidth: 224, min: 200, max: 340, side: 'right' })
  const railed = panel.collapsed

  // Split into projects I own vs. projects shared with me (I'm a member, not owner).
  const ownedProjects = productions.filter(p => p.ownerId === user?.id)
  const sharedProjects = productions.filter(p => p.ownerId && p.ownerId !== user?.id)

  const projectLink = (p) => (
    <NavLink
      key={p.id}
      to={`/project/${p.id}`}
      onClick={onMobileClose}
      className={({ isActive }) =>
        `block px-3 py-1.5 rounded-lg text-[13px] truncate transition-colors ${
          isActive
            ? 'bg-surface-700 text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-200 hover:bg-surface-800'
        }`
      }
    >
      {p.name}
    </NavLink>
  )

  const navItem = ({ to, label, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      onClick={onMobileClose}
      title={railed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${railed ? 'justify-center' : ''} ${
          isActive
            ? 'bg-accent/10 text-zinc-100 border border-accent/15'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-800 border border-transparent'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} strokeWidth={1.75} className={`flex-shrink-0 ${isActive ? 'text-accent' : 'opacity-70'}`} />
          {!railed && <span className="flex-1">{label}</span>}
        </>
      )}
    </NavLink>
  )

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onMobileClose} />
      )}
      <aside
        style={{ width: railed ? RAIL : panel.width }}
        className={`flex-shrink-0 bg-surface-900 border-r border-surface-700 flex flex-col
        ${panel.dragging ? '' : 'transition-[width] duration-150'}
        fixed inset-y-0 left-0 z-50
        md:sticky md:top-0 md:h-dvh md:translate-x-0 md:z-auto
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Desktop drag-resize handle (hidden when railed) */}
        {!railed && <ResizeHandle onPointerDown={panel.startDrag} onDoubleClick={panel.reset} side="right" dragging={panel.dragging} />}

        {/* Logo + collapse toggle */}
        <div className={`py-5 border-b border-surface-700 flex-shrink-0 flex items-center ${railed ? 'px-0 justify-center' : 'px-5 justify-between'}`}>
          {!railed && <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />}
          <button
            onClick={panel.toggle}
            title={railed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-surface-800"
          >
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Nav — primary at top, project list beneath, utility pinned to the bottom */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
          <div className="space-y-0.5">
            {PRIMARY_NAV.map(navItem)}
          </div>

          {/* Projects sub-list — grouped into mine + shared. Hidden when railed. */}
          {!railed && productions.length > 0 && (
            <div className="mt-1.5 ml-3 pl-2 border-l border-surface-700/60 space-y-0.5">
              {ownedProjects.map(projectLink)}

              {sharedProjects.length > 0 && (
                <>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">
                    Shared with me
                  </p>
                  {sharedProjects.map(projectLink)}
                </>
              )}
            </div>
          )}

          {/* Bottom cluster: configuration + account, pinned to the bottom */}
          <div className="mt-auto pt-4 space-y-0.5">
            <div className="space-y-0.5">
              {UTILITY_NAV.map(navItem)}
            </div>

            <div className="pt-2 mt-2 border-t border-surface-800 space-y-0.5">
              {isAdmin && (
                <NavLink
                  to="/admin"
                  onClick={onMobileClose}
                  title={railed ? 'Admin' : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${railed ? 'justify-center' : ''} ${
                      isActive ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-400 hover:text-amber-400 hover:bg-amber-500/5 border border-transparent'
                    }`
                  }
                >
                  <Shield size={16} strokeWidth={1.75} className="flex-shrink-0 opacity-80" />
                  {!railed && <span>Admin</span>}
                </NavLink>
              )}

              {user && (
                <button
                  onClick={signOut}
                  title={railed ? 'Sign out' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ${railed ? 'justify-center' : ''}`}
                >
                  <LogOut size={16} strokeWidth={1.75} className="flex-shrink-0" />
                  {!railed && 'Sign out'}
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Footer: account entry — click to open the Account hub (settings, calendars, billing) */}
        {user && (
          <NavLink
            to="/account"
            onClick={onMobileClose}
            title={railed ? 'Account' : undefined}
            className={({ isActive }) =>
              `border-t border-surface-700 flex-shrink-0 flex items-center gap-2 safe-bottom-sm py-3 transition-colors ${railed ? 'px-0 justify-center' : 'px-5'} ${
                isActive ? 'bg-surface-800' : 'hover:bg-surface-800'
              }`
            }
          >
            {(avatarUrl || user.user_metadata?.avatar_url) ? (
              <img src={avatarUrl || user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {(user.user_metadata?.full_name || user.email)?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            {!railed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-300 truncate leading-tight">{user.user_metadata?.full_name || user.email}</p>
                <p className="text-[10px] text-zinc-600 leading-tight">Account & settings</p>
              </div>
            )}
          </NavLink>
        )}
      </aside>
    </>
  )
}

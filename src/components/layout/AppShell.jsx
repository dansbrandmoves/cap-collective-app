import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useApp } from '../../contexts/AppContext'
import { NotificationsDropdown } from '../ui/NotificationsDropdown'
import { Menu } from 'lucide-react'

export function AppShell() {
  const { isOwner, theme } = useApp()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-surface-950">
      {isOwner && (
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      )}
      <main className="flex-1 min-w-0 flex flex-col">
        {isOwner && (
          <div className="md:hidden flex items-center justify-between px-4 py-3 bg-surface-900 border-b border-surface-700 sticky top-0 z-30 safe-top">
            <div className="flex items-center gap-2">
              <img src="/coordie-logo.svg" alt="Coordie" className="h-4" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
            </div>
            <div className="flex items-center gap-1">
              <NotificationsDropdown />
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-800 transition-colors"
                aria-label="Open menu"
              >
                <Menu size={18} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}

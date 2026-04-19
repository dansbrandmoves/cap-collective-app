import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useApp } from '../../contexts/AppContext'
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
          <div className="md:hidden flex items-center justify-between px-5 h-14 bg-surface-900/95 backdrop-blur-xl border-b border-white/[0.05] sticky top-0 z-30 safe-top">
            <div className="flex items-center gap-2">
              <img src="/coordie-logo.svg" alt="Coordie" className="h-5" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
            </div>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-11 h-11 -mr-1.5 flex items-center justify-center rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-white/5 active:bg-white/10 transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} strokeWidth={1.75} />
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}

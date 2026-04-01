import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useApp } from '../../contexts/AppContext'

export function AppShell() {
  const { isOwner } = useApp()

  return (
    <div className="flex min-h-screen bg-surface-950">
      {isOwner && <Sidebar />}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}

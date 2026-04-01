import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './contexts/AppContext'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './pages/Dashboard'
import { ProductionView } from './pages/ProductionView'
import { RoomView } from './pages/RoomView'
import { AvailabilityRules } from './pages/AvailabilityRules'
import { CalendarSettings } from './pages/CalendarSettings'

function AppRoutes() {
  const { isOwner } = useApp()

  return (
    <Routes>
      {/* Room is accessible without owner shell (shareable link) */}
      <Route path="/room/:token" element={<RoomView />} />

      {/* Owner shell wraps all other routes */}
      <Route element={<AppShell />}>
        {isOwner ? (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/production/:id" element={<ProductionView />} />
            <Route path="/availability" element={<AvailabilityRules />} />
            <Route path="/calendars" element={<CalendarSettings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          // Guest: redirect everything to dashboard placeholder
          <Route path="*" element={<GuestHome />} />
        )}
      </Route>
    </Routes>
  )
}

function GuestHome() {
  const { setIsOwner } = useApp()
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
        <span className="text-black font-bold text-sm">CC</span>
      </div>
      <h1 className="text-xl font-semibold text-zinc-100">Cap Collective</h1>
      <p className="text-sm text-zinc-500">You're in guest preview mode.</p>
      <button
        onClick={() => setIsOwner(true)}
        className="text-xs text-accent hover:underline mt-2"
      >
        Switch to owner view
      </button>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}

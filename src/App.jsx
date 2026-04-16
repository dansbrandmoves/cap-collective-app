import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './contexts/AppContext'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './pages/Dashboard'
import { ProductionView } from './pages/ProductionView'
import { RoomView } from './pages/RoomView'
import { AvailabilityRules } from './pages/AvailabilityRules'
import { CalendarSettings } from './pages/CalendarSettings'
import { Inbox } from './pages/Inbox'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'

function AppRoutes() {
  const { isOwner, authLoading } = useApp()

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-sm">Co</span>
          </div>
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public pages */}
      <Route path="/home" element={<HomePage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      {/* Room is accessible without auth (shareable link) */}
      <Route path="/room/:token" element={<RoomView />} />

      {isOwner ? (
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/production/:id" element={<ProductionView />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/availability" element={<AvailabilityRules />} />
          <Route path="/calendars" element={<CalendarSettings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<AuthPage />} />
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}

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
import { BillingPage } from './pages/BillingPage'
import { BookingPages } from './pages/BookingPages'
import { BookingPageView } from './pages/BookingPageView'
import { AdminDashboard } from './pages/AdminDashboard'
import { PageLoader } from './components/ui/PageLoader'

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface-950">
      <PageLoader />
    </div>
  )
}

function AuthGate() {
  const { isOwner, authLoading } = useApp()
  if (authLoading) return <LoadingScreen />
  if (!isOwner) return <AuthPage />
  return <AppShell />
}

// Root: marketing for visitors, dashboard for signed-in users
function RootRoute() {
  const { isOwner, authLoading } = useApp()
  if (authLoading) return <LoadingScreen />
  if (!isOwner) return <HomePage />
  return <AppShell />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public pages — render immediately, no auth wait */}
      <Route path="/signin" element={<AuthPage />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/room/:token" element={<RoomView />} />
      <Route path="/book/:slug" element={<BookingPageView />} />

      {/* Root: marketing or dashboard based on auth */}
      <Route element={<RootRoute />}>
        <Route path="/" element={<Dashboard />} />
      </Route>

      {/* Auth-gated routes with AppShell layout */}
      <Route element={<AuthGate />}>
        <Route path="/project/:id" element={<ProductionView />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/availability" element={<AvailabilityRules />} />
        <Route path="/calendars" element={<CalendarSettings />} />
        <Route path="/booking-pages" element={<BookingPages />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
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

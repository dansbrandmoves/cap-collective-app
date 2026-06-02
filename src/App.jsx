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
import { AdminDiagnostics } from './pages/AdminDiagnostics'
import { AccountPage } from './pages/AccountPage'
import { PageLoader } from './components/ui/PageLoader'

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-dvh bg-surface-950">
      <PageLoader />
    </div>
  )
}

// True if Supabase stored a session on a previous visit — used to skip the
// auth-loading blank screen for returning users. Checked once at module load.
const hadStoredSession = !!localStorage.getItem('sb-xwuekcysigkujhyucugi-auth-token')

function AuthGate() {
  const { isOwner, authLoading } = useApp()
  // Returning user: render the shell immediately while auth resolves in the
  // background. If auth comes back negative they'll be redirected to login.
  if (authLoading && hadStoredSession) return <AppShell />
  // New visitor or cleared session: show a brief spinner (unavoidable).
  if (authLoading) return <LoadingScreen />
  if (!isOwner) return <AuthPage />
  return <AppShell />
}

// Root: marketing for visitors, dashboard for signed-in users
function RootRoute() {
  const { isOwner, authLoading } = useApp()
  if (authLoading && hadStoredSession) return <AppShell />
  if (authLoading) return <LoadingScreen />
  if (!isOwner) return <HomePage />
  return <AppShell />
}

// Room route: signed-in users get the AppShell frame (main nav) with RoomView in
// the outlet; account-less guests get RoomView standalone (full-screen, no nav).
function RoomRoute() {
  const { isOwner, authLoading } = useApp()
  if (authLoading && hadStoredSession) return <AppShell />
  if (authLoading) return <RoomView />
  if (!isOwner) return <RoomView />
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
      {/* Signed-in users keep their main app nav (AppShell) while viewing a room
          they're a member of; account-less guests get the standalone room. */}
      <Route path="/room/:token" element={<RoomRoute />}>
        <Route index element={<RoomView />} />
      </Route>
      <Route path="/book/:slug" element={<BookingPageView />} />

      {/* Root: marketing or dashboard based on auth */}
      <Route element={<RootRoute />}>
        <Route path="/" element={<Dashboard />} />
      </Route>

      {/* Auth-gated routes with AppShell layout */}
      <Route element={<AuthGate />}>
        <Route path="/project/:id" element={<ProductionView />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/account" element={<AccountPage />} />
        {/* Old standalone settings routes now live as Account tabs */}
        <Route path="/availability" element={<Navigate to="/account?tab=availability" replace />} />
        <Route path="/calendars" element={<Navigate to="/account?tab=calendars" replace />} />
        <Route path="/billing" element={<Navigate to="/account?tab=billing" replace />} />
        <Route path="/booking-pages" element={<BookingPages />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/diagnostics" element={<AdminDiagnostics />} />
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

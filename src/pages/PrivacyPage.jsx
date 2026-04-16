import { useApp } from '../contexts/AppContext'

export function PrivacyPage() {
  const { theme } = useApp()

  return (
    <div className="min-h-screen bg-surface-950">
      <nav className="flex items-center justify-between px-6 sm:px-12 py-5 border-b border-surface-700">
        <a href="/">
          <img
            src="/coordie-logo.svg"
            alt="Coordie"
            className="h-6"
            style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }}
          />
        </a>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Privacy Policy</h1>
        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
          <p>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">What We Collect</h2>
          <p>
            When you sign in with Google, we receive your name, email address, and profile picture.
            If you connect your Google Calendar, we read calendar event titles, times, and dates to
            derive your availability. We do not store the full content of your calendar events on our servers.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">How We Use Your Data</h2>
          <p>
            Your information is used solely to operate Coordie — showing your availability to project
            collaborators you invite, and managing your projects. We do not sell, share, or monetize
            your personal data.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Google Calendar Data</h2>
          <p>
            Coordie requests read-only access to your Google Calendar. Calendar data is processed
            in your browser to determine availability slots. Event details are only visible to you
            (the project owner) — guests see availability status only, not event names or details.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Data Storage</h2>
          <p>
            Project data (names, dates, shared notes, date requests) is stored in our database.
            Calendar settings and preferences are stored locally in your browser. You can delete
            your account and data at any time by contacting us.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Contact</h2>
          <p>
            For privacy questions, contact us at privacy@coordie.app.
          </p>
        </div>
      </div>
    </div>
  )
}

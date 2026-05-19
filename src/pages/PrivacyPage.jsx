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
          <p>Last updated: May 19, 2026</p>

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
            your personal data. Your Google user data is never used for advertising, profiling, or
            any purpose unrelated to providing the Coordie service to you.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Google Calendar Data</h2>
          <p>
            Coordie requests read-only access to your Google Calendar. Calendar data is processed
            in your browser to determine availability slots. Event details are only visible to you
            (the project owner) — guests see availability status only, not event names or details.
            Raw calendar event data is not transmitted to or stored on our servers; it is processed
            locally in your browser session only.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Data Sharing and Disclosure</h2>
          <p>
            We do not sell, rent, trade, or share your Google user data with any third parties for
            their own purposes. Your Google data is never disclosed to advertisers, data brokers,
            or other users of Coordie beyond what you explicitly share.
          </p>
          <p>
            To operate the service, we use the following infrastructure provider:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-zinc-300">Supabase</span> — our cloud database and authentication
              provider. Your account information and OAuth tokens are stored in Supabase's
              infrastructure. Supabase processes this data solely on our behalf to operate Coordie.
              Supabase's privacy policy is available at{' '}
              <a href="https://supabase.com/privacy" className="text-accent underline" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>.
            </li>
          </ul>
          <p>
            Beyond the infrastructure provider above, we do not transfer or disclose Google user data
            to any other party, except as required by law or to protect the safety and security of
            our users and service.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Data Protection</h2>
          <p>
            We take the following measures to protect your data:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>All data transmitted between your browser and our service is encrypted using HTTPS/TLS.</li>
            <li>
              Data stored in our database (Supabase) is encrypted at rest using AES-256 encryption
              provided by Supabase's infrastructure.
            </li>
            <li>
              Google Calendar event data is processed entirely in your browser and is never sent
              to our servers — it cannot be accessed by other users or our team.
            </li>
            <li>
              Google OAuth tokens (used to maintain your calendar connection) are stored securely
              in our database and are never exposed to other users or included in any API responses
              served to guests.
            </li>
            <li>
              Your account profile and Google OAuth tokens are protected by row-level security
              policies in our database — only you can read or modify your own profile record.
            </li>
          </ul>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Data Retention and Deletion</h2>
          <p>
            We retain your data only as long as your account is active or as needed to provide
            the service. Specific rules for Google user data:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-zinc-300">Google OAuth tokens</span> (refresh token and access token)
              are retained in our database for as long as your Google Calendar remains connected.
              Disconnecting your calendar from Calendar Settings immediately removes these tokens
              from our database.
            </li>
            <li>
              <span className="text-zinc-300">Google Calendar events</span> are never stored on our servers.
              They are fetched from Google's API, processed in your browser, and cached temporarily
              in your browser's local storage only. Clearing your browser's local storage removes
              this cache immediately.
            </li>
            <li>
              <span className="text-zinc-300">Google account information</span> (name, email, profile picture)
              is retained in your profile for as long as your account exists.
            </li>
          </ul>
          <p>
            You can disconnect Google Calendar at any time from{' '}
            <span className="text-zinc-300">Calendar Settings</span> inside the app. This immediately
            revokes our access and removes your OAuth tokens from our database.
          </p>
          <p>
            To delete your account and all associated data — including any stored Google user data —
            contact us at{' '}
            <a href="mailto:privacy@coordie.app" className="text-accent underline">privacy@coordie.app</a>.
            We will process deletion requests within 30 days.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Data Storage</h2>
          <p>
            Project data (names, dates, shared notes, date requests) is stored in our database.
            Calendar settings and preferences are stored locally in your browser. You can delete
            your account and data at any time by contacting us.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Contact</h2>
          <p>
            For privacy questions or data deletion requests, contact us at{' '}
            <a href="mailto:privacy@coordie.app" className="text-accent underline">privacy@coordie.app</a>.
          </p>
        </div>
      </div>
    </div>
  )
}

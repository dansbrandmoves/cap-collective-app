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
        <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 mb-8">Effective Date: June 1, 2026 &nbsp;·&nbsp; Provider: Moves and Measures, LLC</p>
        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">

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
            Coordie requests access to your Google Calendar to determine availability slots. Calendar
            data is processed to derive availability and facilitate scheduling. Event details are only
            visible to you (the project owner) — collaborators see availability status only, not event
            names or details.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Google API Services — Limited Use Disclosure</h2>
          <p>
            Coordie's use and transfer to any other app of information received from Google APIs will
            adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
            including the Limited Use requirements. Specifically: we access Google Calendar data only
            to provide scheduling features within the Service; we do not use this data for advertising;
            we do not allow humans to read this data except as needed to provide or improve the Service
            or as required by law; and we do not share this data with third parties except as necessary
            to provide the Service.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Data Storage</h2>
          <p>
            Project data (names, dates, shared notes, date requests) is stored in our database.
            Calendar settings and preferences are stored locally in your browser. You can delete
            your account and data at any time by contacting us.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Parent Company</h2>
          <p>
            Coordie is a service provided by Moves and Measures, LLC. To learn more about our
            company's broader privacy practices, visit{' '}
            <a href="https://www.movesandmeasures.com/privacy-policy" className="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer">movesandmeasures.com/privacy-policy</a>.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make material changes, we
            will notify you by email at the address associated with your account at least 14 days
            before the changes take effect. We will also post the updated policy at this URL with a
            new effective date. Your continued use of Coordie after the effective date constitutes
            your acceptance of the updated policy.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Contact</h2>
          <p>
            For privacy questions, contact us at{' '}
            <a href="mailto:privacy@movesandmeasures.com" className="text-accent underline underline-offset-2">privacy@movesandmeasures.com</a>.
          </p>

        </div>
      </div>
    </div>
  )
}

import { useApp } from '../contexts/AppContext'

// Plain reference page. Facts, not a pitch. Linked from the landing footer, the
// sign-in page, and the landing FAQ. Section anchors let those link deep (e.g.
// /docs#security). Mirrors the Privacy/Terms page layout.

const SECTIONS = [
  ['what', 'What Coordie is'],
  ['how', 'How it works'],
  ['calendars', 'Calendars'],
  ['sharing', 'Guests and share links'],
  ['data', 'Where your data lives'],
  ['security', 'Security'],
  ['delete', 'Deleting your data'],
  ['faq', 'FAQ'],
  ['contact', 'Contact'],
]

function H({ id, children }) {
  return (
    <h2 id={id} className="text-base font-semibold text-zinc-200 mt-8 scroll-mt-24">{children}</h2>
  )
}

export function DocsPage() {
  const { theme } = useApp()
  return (
    <div className="min-h-dvh bg-surface-950">
      <nav className="flex items-center justify-between px-6 sm:px-12 py-5 border-b border-surface-700">
        <a href="/">
          <img src="/coordie-logo.svg" alt="Coordie" className="h-6" style={{ filter: theme === 'dark' ? 'invert(1)' : 'none' }} />
        </a>
        <a href="/signin" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">Sign in</a>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Documentation</h1>
        <p className="text-sm text-zinc-500 mb-8">How Coordie works, what it can access, and where your data lives.</p>

        {/* Contents */}
        <nav className="mb-10 rounded-xl border border-surface-700 bg-surface-900/50 px-5 py-4">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-[13px] text-zinc-400 hover:text-accent transition-colors">{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">

          <H id="what">What Coordie is</H>
          <p>
            Coordie finds a day that works for a group and gives that group a shared place to plan.
            Everything lives inside a project: a schedule, a task board, and a whiteboard. You add the
            people you need, and the days everyone is free surface on their own.
          </p>

          <H id="how">How it works</H>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Create a project and add the people you want to coordinate with.</li>
            <li>Each person connects a calendar or taps the days they are free. No account is required to join.</li>
            <li>The days the whole group is free are marked. You can filter by morning, afternoon, or evening.</li>
            <li>Pick a day and time to open a prefilled event in your own calendar, and plan the work on the board and whiteboard.</li>
          </ol>

          <H id="calendars">Calendars</H>
          <p>
            Coordie connects to Google Calendar and Microsoft Outlook. Access is <span className="text-zinc-300">read-only</span>:
            Coordie can read your events to work out when you are busy, and it cannot create, change, or delete anything
            on your calendar.
          </p>
          <p>
            Only your <span className="text-zinc-300">free/busy</span> availability is shared with the people in a project.
            Event titles and details are used to calculate your busy times and are never shown to anyone else. Other
            people see whether you are free, not what you have scheduled.
          </p>
          <p>
            "Schedule meeting" opens a new event that is prefilled with the day, time, and attendees in your own
            calendar (Google or Outlook). You review and send it yourself; Coordie does not write to your calendar.
          </p>

          <H id="sharing">Guests and share links</H>
          <p>
            You invite people with a link. Anyone who opens a project's link can view that project and add their
            availability, so share links only with the people you want in the project. Links use long, random tokens
            that are not guessable. Guests enter a name and email so the group knows whose availability is whose; a
            guest's email is shown only to the project's host, for sending the meeting invite.
          </p>
          <p>
            Guests can save a project to a free account at any time. Account sign-in uses Google, Microsoft, or a
            one-time email link. Coordie does not store passwords.
          </p>

          <H id="data">Where your data lives</H>
          <p>
            The app is served by Vercel. Data is stored in a Postgres database hosted by Supabase in the United States
            (AWS US East, Ohio). Project details, tasks, notes, and derived availability are stored in that database.
            Calendar settings and a short-lived copy of your availability are also cached in your browser to make the
            app load quickly; clearing your browser storage removes that cache.
          </p>
          <p>
            Your calendar events themselves are not stored as a copy of your calendar. Coordie reads them to derive
            busy times and keeps only what it needs to show availability.
          </p>

          <H id="security">Security</H>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>All traffic between your browser and Coordie is encrypted with HTTPS/TLS.</li>
            <li>Data stored in the database is encrypted at rest (AES-256) by the hosting provider.</li>
            <li>
              The tokens that keep your calendar connected are stored server-side and are readable only by you and the
              background job that syncs your availability. They are never included in anything shown to other people or
              to guests.
            </li>
            <li>Calendar access is read-only, so a calendar connection cannot be used to change your calendar.</li>
            <li>You can disconnect a calendar at any time, which removes its tokens immediately.</li>
          </ul>
          <p>
            Coordie is a collaboration tool: people you invite to a project can see that project's shared content
            (the availability overlap, tasks, whiteboard, and notes). It is not built to hide project content from the
            people who hold that project's link.
          </p>

          <H id="delete">Deleting your data</H>
          <p>
            Disconnecting a calendar (Account → Calendars) removes its stored tokens right away. To delete your account
            and everything associated with it, email{' '}
            <a href="mailto:contact@movesandmeasures.com" className="text-accent underline underline-offset-2">contact@movesandmeasures.com</a>.
            Requests are processed within 30 days. Full details are in the{' '}
            <a href="/privacy" className="text-accent underline underline-offset-2">Privacy Policy</a>.
          </p>

          <H id="faq">FAQ</H>
          <div className="space-y-4">
            <div>
              <p className="text-zinc-300 font-medium">Can other people see my calendar events?</p>
              <p>No. They see whether you are free, never your event titles or details.</p>
            </div>
            <div>
              <p className="text-zinc-300 font-medium">Can Coordie change my calendar?</p>
              <p>No. Access is read-only. "Schedule meeting" opens a prefilled event in your own calendar that you send yourself.</p>
            </div>
            <div>
              <p className="text-zinc-300 font-medium">Do guests need an account?</p>
              <p>No. Anyone with a project link can join with a name and email. They can create a free account later if they want to keep the project.</p>
            </div>
            <div>
              <p className="text-zinc-300 font-medium">Google or Outlook?</p>
              <p>Both. You can connect either, or both, and busy times from all connected calendars are combined.</p>
            </div>
            <div>
              <p className="text-zinc-300 font-medium">What does it cost?</p>
              <p>The free plan covers a set number of projects and booking pages. Pro is $10/month for unlimited use.</p>
            </div>
          </div>

          <H id="contact">Contact</H>
          <p>
            Coordie is made by Moves and Measures, LLC. For questions, email{' '}
            <a href="mailto:contact@movesandmeasures.com" className="text-accent underline underline-offset-2">contact@movesandmeasures.com</a>.
          </p>

        </div>
      </div>
    </div>
  )
}

import { useApp } from '../contexts/AppContext'

export function TermsPage() {
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
        <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Terms of Service</h1>
        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
          <p>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Acceptance of Terms</h2>
          <p>
            By accessing or using Coordie, you agree to be bound by these Terms of Service.
            If you do not agree, do not use the service.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Description of Service</h2>
          <p>
            Coordie is a project coordination tool that helps you manage availability,
            share schedules with collaborators, and organize projects. The service
            includes calendar integration, date request management, and shared workspaces.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">User Accounts</h2>
          <p>
            You may sign in using your Google account. You are responsible for maintaining
            the security of your account and for all activity that occurs under it. You
            must provide accurate information and keep it up to date.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Acceptable Use</h2>
          <p>
            You agree to use Coordie only for lawful purposes and in accordance with
            these Terms. You must not misuse the service, attempt to gain unauthorized
            access, or interfere with other users' use of the service.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Intellectual Property</h2>
          <p>
            Content you create in Coordie (projects, notes, requests) remains yours.
            Coordie retains ownership of the service, its design, and underlying technology.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Third-Party Services</h2>
          <p>
            Coordie integrates with Google Calendar and other third-party services.
            Your use of those services is subject to their respective terms and privacy
            policies. Coordie is not responsible for third-party service availability
            or behavior.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Limitation of Liability</h2>
          <p>
            Coordie is provided "as is" without warranties of any kind. We are not
            liable for any damages arising from your use of the service, including
            but not limited to data loss, scheduling errors, or service interruptions.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Termination</h2>
          <p>
            You may stop using Coordie at any time. We reserve the right to suspend
            or terminate accounts that violate these Terms or engage in abusive behavior.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the service
            after changes constitutes acceptance of the revised Terms.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">Contact</h2>
          <p>
            For questions about these Terms, contact us at terms@coordie.com.
          </p>
        </div>
      </div>
    </div>
  )
}

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
        <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Terms of Service</h1>
        <p className="text-sm text-zinc-500 mb-8">Effective Date: June 1, 2026 &nbsp;·&nbsp; Provider: Moves and Measures, LLC</p>
        <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">

          <h2 className="text-base font-semibold text-zinc-200 mt-6">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Coordie ("the Service"), you agree to be bound by these Terms of Service ("Terms").
            If you are using the Service on behalf of an organization, you represent that you have authority to bind
            that organization to these Terms. If you do not agree, do not use the Service.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">2. About Coordie</h2>
          <p>
            Coordie is a project coordination and scheduling tool provided by Moves and Measures, LLC ("we," "our," "us").
            Coordie is one of several services operated by Moves and Measures, LLC. Additional information about our
            company is available at <a href="https://www.movesandmeasures.com" className="text-accent underline underline-offset-2">movesandmeasures.com</a>.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">3. Google Calendar Integration</h2>
          <p>
            The Service integrates with Google Calendar to facilitate scheduling. By connecting your Google account,
            you grant Coordie permission to view and manage calendar events solely for the purpose of providing the
            Service. This integration is subject to{' '}
            <a href="https://policies.google.com/terms" className="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer">Google's Terms of Service</a>.
            Our use and transfer of information received from Google APIs adheres to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
            including the Limited Use requirements. We do not use Google Calendar data for advertising or share it
            with third parties.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">4. Eligibility</h2>
          <p>
            You must be at least 18 years of age to use the Service. By using the Service, you represent that you
            meet this requirement.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">5. Account Security &amp; Acceptable Use</h2>
          <p>You are responsible for all activity under your account. You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the Service for any unlawful purpose or in violation of any applicable regulations</li>
            <li>Transmit harmful, defamatory, obscene, harassing, or otherwise objectionable content</li>
            <li>Reverse engineer, scrape, or attempt to extract source code from the Service</li>
            <li>Interfere with the security, integrity, or performance of the Service or its infrastructure</li>
            <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
          </ul>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">6. Intellectual Property</h2>
          <p>
            <span className="text-zinc-300 font-medium">Your Content:</span> You retain ownership of all projects,
            data, and content you create using the Service. You grant Moves and Measures, LLC a limited, non-exclusive,
            royalty-free license to host, store, and display your content solely as necessary to provide the Service.
          </p>
          <p>
            <span className="text-zinc-300 font-medium">Our Content:</span> All design, code, trademarks, and
            underlying technology of the Service remain the exclusive property of Moves and Measures, LLC. Any
            feedback or suggestions you provide may be used by us without obligation to you.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">7. Limitation of Liability</h2>
          <p>
            The Service is provided "as is" and "as available" without warranties of any kind, express or implied.
            Moves and Measures, LLC is not liable for scheduling errors, data loss, or service interruptions,
            including those caused by third-party integrations such as Google Calendar. In no event shall our total
            liability to you exceed the amount you paid us in the twelve (12) months preceding the claim, or $100,
            whichever is greater.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">8. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Moves and Measures, LLC, its officers, directors,
            employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including
            reasonable attorneys' fees) arising out of or in any way connected with your access to or use of the
            Service, your violation of these Terms, or your violation of any rights of another person or entity.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">9. Governing Law &amp; Dispute Resolution</h2>
          <p>
            These Terms are governed by the laws of the Commonwealth of Pennsylvania, without regard to its conflict
            of law provisions. You agree that any dispute arising from these Terms or your use of the Service shall
            be resolved exclusively in the state or federal courts located in the Middle District of Pennsylvania,
            and you consent to personal jurisdiction in those courts. We reserve the right to require binding
            arbitration for any dispute in lieu of court proceedings.
          </p>
          <p>
            Any claim you have arising out of or relating to these Terms or the Service must be filed within one (1)
            year of the date the claim arose, or it is permanently barred.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">10. Termination</h2>
          <p>
            You may stop using Coordie at any time. We reserve the right to suspend or terminate accounts that
            violate these Terms or engage in abusive behavior, with or without notice.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">11. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. When we make material changes, we will notify you by email
            at the address associated with your account and by posting a notice within the Service at least 14 days
            before the changes take effect. Your continued use of the Service after the effective date of any updated
            Terms constitutes your acceptance of the new Terms. If you do not agree to the updated Terms, you must
            stop using the Service before the effective date.
          </p>

          <h2 className="text-base font-semibold text-zinc-200 mt-6">12. Contact</h2>
          <p>
            For questions about these Terms, contact us at{' '}
            <a href="mailto:legal@movesandmeasures.com" className="text-accent underline underline-offset-2">legal@movesandmeasures.com</a>.
          </p>

        </div>
      </div>
    </div>
  )
}

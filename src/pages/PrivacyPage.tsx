import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="pt-32 pb-20 px-6">
        <article className="max-w-2xl mx-auto prose-invert">
          <h1 className="text-3xl font-semibold mb-2">Privacy Policy</h1>
          <p className="text-text-muted text-sm mb-10">Last updated: April 2026</p>

          <section className="space-y-6 text-text-secondary text-sm leading-relaxed">
            <div>
              <h2 className="text-text font-medium text-base mb-2">Who we are</h2>
              <p>
                Mix Bridge is a product of Braz Sound ("we", "us"). This policy explains how we handle
                your information when you use our website at mixbridge.net and the Mix Bridge desktop application.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">What we collect</h2>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-text">Account data:</strong> email address, display name, and hashed password when you create an account.</li>
                <li><strong className="text-text">Device identifiers:</strong> a hardware-derived ID used solely for licence activation. We store a display name for the device if you provide one.</li>
                <li><strong className="text-text">Usage analytics:</strong> we may collect anonymous, aggregated usage statistics (e.g. bounce counts) to improve the product. No audio content is ever transmitted.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">What we do not collect</h2>
              <p>
                We never access, upload, or transmit your Pro Tools sessions, audio files, or project data.
                Mix Bridge operates entirely on your local machine. Bounced files stay on your disk.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">How we store your data</h2>
              <p>
                Account and licence data is stored in Supabase (PostgreSQL) with row-level security policies.
                Passwords are hashed by Supabase Auth and never stored in plain text.
                We do not sell or share your personal data with third parties.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Cookies</h2>
              <p>
                The website uses a session cookie for authentication. We do not use tracking cookies or
                third-party analytics that set cookies.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Your rights</h2>
              <p>
                You can update or delete your account data from the Account page at any time. If you want us to
                remove all data associated with your email, contact{' '}
                <a href="mailto:support@brazsound.com" className="text-accent hover:underline">
                  support@brazsound.com
                </a>.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Changes</h2>
              <p>
                We may update this policy from time to time. Material changes will be noted on this page
                with an updated date.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Contact</h2>
              <p>
                Questions? Reach us at{' '}
                <a href="mailto:support@brazsound.com" className="text-accent hover:underline">
                  support@brazsound.com
                </a>.
              </p>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}

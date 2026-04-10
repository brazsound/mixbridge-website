import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export function TermsPage() {
  return (
    <>
      <Nav />
      <main className="pt-32 pb-20 px-6">
        <article className="max-w-2xl mx-auto prose-invert">
          <h1 className="text-3xl font-semibold mb-2">Terms of Service</h1>
          <p className="text-text-muted text-sm mb-10">Last updated: April 2026</p>

          <section className="space-y-6 text-text-secondary text-sm leading-relaxed">
            <div>
              <h2 className="text-text font-medium text-base mb-2">Agreement</h2>
              <p>
                By creating an account or downloading Mix Bridge you agree to these terms. If you don't agree,
                don't use the service.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Licence</h2>
              <p>
                Each Mix Bridge licence grants you a non-exclusive, non-transferable right to run the
                software on the number of Macs specified by your plan (Solo: 1, Pro: 3, Team: 10).
                You may deactivate and move a seat at any time through the account page.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Acceptable use</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Do not reverse-engineer, decompile, or modify the application binary.</li>
                <li>Do not share your licence key or account credentials.</li>
                <li>Do not use the software to violate any applicable law.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Availability</h2>
              <p>
                Mix Bridge is provided "as is". We aim for high reliability but do not guarantee uninterrupted
                service. The licence server requires periodic internet access for activation; the application
                itself works offline once activated.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Billing</h2>
              <p>
                Licences are billed annually. Billing details and payment processing will be handled through
                a third-party provider (Paddle or Stripe) when billing goes live. Prices may change with 30
                days' notice before your next renewal.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Refunds</h2>
              <p>
                If you are unsatisfied, contact us within 14 days of purchase for a full refund. After 14 days,
                refunds are at our discretion.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Limitation of liability</h2>
              <p>
                To the maximum extent permitted by law, Braz Sound is not liable for indirect, incidental,
                or consequential damages arising from use of the software, including but not limited to data
                loss or failed bounces.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Termination</h2>
              <p>
                We may suspend or terminate your account if you violate these terms. You may cancel your
                account at any time through the account page or by emailing support.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Changes</h2>
              <p>
                We may update these terms. Material changes will be communicated via email or a notice on the
                website at least 14 days before taking effect.
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

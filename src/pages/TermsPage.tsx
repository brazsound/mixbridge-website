import { Footer } from '@/components/Footer';

export function TermsPage() {
  return (
    <>
      <main className="pt-32 pb-20 px-6">
        <article className="max-w-2xl mx-auto prose-invert">
          <h1 className="text-3xl font-semibold mb-2">Terms of Service</h1>
          <p className="text-text-muted text-sm mb-10">Last updated: April 2026</p>

          <section className="space-y-6 text-text-secondary text-sm leading-relaxed">
            <div>
              <h2 className="text-text font-medium text-base mb-2">Agreement</h2>
              <p>
                By creating an account or downloading MixBridge you agree to these terms. If you don't agree,
                don't use the service.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Licence</h2>
              <p>
                MixBridge is free to use. We grant you a non-exclusive, non-transferable right to run the
                software for your own audio work on as many Macs as you like. A free account is required to
                download and sign in.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Acceptable use</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Do not reverse-engineer, decompile, or modify the application binary.</li>
                <li>Do not share your account credentials.</li>
                <li>Do not use the software to violate any applicable law.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Availability</h2>
              <p>
                MixBridge is provided "as is". We aim for high reliability but do not guarantee uninterrupted
                service. Signing in requires internet access; the application itself works offline once you're
                signed in.
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
                <a href="mailto:support@mixbridge.studio" className="text-accent hover:underline">
                  support@mixbridge.studio
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

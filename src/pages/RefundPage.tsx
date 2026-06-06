import { Footer } from '@/components/Footer';

export function RefundPage() {
  return (
    <>
      <main className="pt-32 pb-20 px-6">
        <article className="max-w-2xl mx-auto prose-invert">
          <h1 className="text-3xl font-semibold mb-2">Refund Policy</h1>
          <p className="text-text-muted text-sm mb-10">Last updated: June 2026</p>

          <section className="space-y-6 text-text-secondary text-sm leading-relaxed">
            <div>
              <h2 className="text-text font-medium text-base mb-2">30-day money-back guarantee</h2>
              <p>
                If you are not satisfied with Mix Bridge for any reason, contact us within 30 days
                of your purchase date and we will issue a full refund — no questions asked.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">How to request a refund</h2>
              <p>
                Email{' '}
                <a href="mailto:support@brazsound.com" className="text-accent hover:underline">
                  support@brazsound.com
                </a>{' '}
                with your order email address and we will process the refund within 3–5 business days.
                Refunds are returned to the original payment method.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">After 30 days</h2>
              <p>
                Refund requests made more than 30 days after purchase are evaluated on a case-by-case basis.
                Please reach out and we'll do our best to make it right.
              </p>
            </div>

            <div>
              <h2 className="text-text font-medium text-base mb-2">Questions</h2>
              <p>
                Contact us at{' '}
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

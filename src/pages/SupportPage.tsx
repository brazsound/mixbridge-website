import { Footer } from '@/components/Footer';
import { SUPPORT_URL } from '@/lib/config';

/**
 * Ko-fi tip panel embed. Third-party iframe, light-themed and fixed-height by
 * Ko-fi's design, so it's framed as a card rather than bled into the page.
 */
const KOFI_EMBED = 'https://ko-fi.com/mixbridge/?hidefeed=true&widget=true&embed=true&preview=true';

export function SupportPage() {
  return (
    <>
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Support development
            </h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              MixBridge is free, and it stays that way. If it saves you time, you can chip in to help
              cover what it costs to run: the Apple developer account, code signing, hosting, and the
              machines it gets tested on.
            </p>
            <p className="text-text-muted text-[13px] leading-relaxed mt-3">
              Completely optional. Nothing in the app is ever locked behind it, and there are no perks,
              tiers, or nags for chipping in.
            </p>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid var(--border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            }}
          >
            <iframe
              id="kofiframe"
              src={KOFI_EMBED}
              title="Support MixBridge on Ko-fi"
              height={712}
              style={{
                border: 'none',
                width: '100%',
                padding: 4,
                background: '#f9f9f9',
                display: 'block',
              }}
            />
          </div>

          <p className="text-[12px] text-text-muted text-center mt-6 leading-relaxed">
            Payments are handled by Ko-fi. You can also open it in a new tab at{' '}
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent)' }}
            >
              ko-fi.com/mixbridge
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

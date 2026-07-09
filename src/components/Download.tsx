import { useState, useEffect } from 'react';
import { useReveal } from '@/lib/useReveal';

const GITHUB_API = 'https://api.github.com/repos/Meteteus/mix-bridge/releases/latest';

interface ReleaseInfo {
  url: string | null;
  version: string;
  error?: string;
}

export function Download() {
  const [release, setRelease] = useState<ReleaseInfo>({ url: null, version: '' });
  const [loading, setLoading] = useState(true);
  const revealRef = useReveal();

  useEffect(() => {
    let cancelled = false;

    async function fetchRelease() {
      try {
        const res = await fetch(GITHUB_API);
        if (!res.ok) throw new Error('Could not fetch release info');
        const data = (await res.json()) as {
          assets?: Array<{ name: string; browser_download_url: string }>;
          tag_name?: string;
        };
        const dmg = data.assets?.find((a) => a.name.endsWith('.dmg'));
        if (!dmg) throw new Error('No Mac installer found');
        if (!cancelled) {
          setRelease({ url: dmg.browser_download_url, version: (data.tag_name ?? '').replace(/^v/, '') });
        }
      } catch {
        if (!cancelled) {
          setRelease({ url: null, version: '', error: 'Download temporarily unavailable.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchRelease();
    return () => { cancelled = true; };
  }, []);

  return (
    <section
      id="download"
      className="px-6 py-24 md:py-32 relative overflow-hidden"
      style={{
        background: [
          'radial-gradient(ellipse 60% 50% at 50% 110%, rgba(123,92,255,0.1) 0%, transparent 55%)',
          'transparent',
        ].join(', '),
      }}
    >
      <div ref={revealRef} className="max-w-lg mx-auto reveal">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Get MixBridge
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Free to use.{' '}
            <span className="text-text-muted">Create a free account, download, and start bouncing.</span>
          </p>
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 0 40px rgba(123,92,255,0.08), 0 16px 48px rgba(0,0,0,0.4)',
          }}
        >
          {/* Download CTA */}
          <div className="p-8 pb-6">
            <div className="mb-2">
              {loading ? (
                <span className="btn-accent w-full cursor-wait opacity-50">Loading…</span>
              ) : release.url ? (
                <a href={release.url} download className="btn-accent btn-accent-glow w-full text-base py-3">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download for Mac
                </a>
              ) : (
                <span className="btn-accent w-full opacity-40 cursor-not-allowed">Download for Mac</span>
              )}
              {release.version && release.url && (
                <p className="text-[11px] text-text-muted text-center mt-3">
                  Version {release.version}
                </p>
              )}
              {release.error && (
                <p className="text-sm text-amber-400 text-center mt-3">{release.error}</p>
              )}
            </div>

            {/* Free info */}
            <div
              className="mt-5 rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border)' }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2.5 text-[12px]"
                style={{ background: 'rgba(123,92,255,0.08)', borderBottom: '1px solid var(--border)' }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'var(--accent)', flexShrink: 0 }}
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                </svg>
                <span style={{ color: 'var(--accent)' }}>100% free — no trial limits</span>
              </div>
              <div className="px-4 py-3 text-[12px] text-text-muted leading-relaxed" style={{ background: 'rgba(255,255,255,0.02)' }}>
                The full app, free forever. We never sell your data and don't profit from MixBridge — your free account just lets us keep track of your feedback. No spam, no card, no device limits.
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border)', margin: '0 24px' }} />

          {/* Requirements */}
          <div className="px-8 py-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-3">
              Requirements
            </h3>
            <ul className="space-y-2.5">
              {[
                ['macOS', '13 Ventura or later'],
                ['Pro Tools', '2025.6 or later'],
                ['Chip', 'Apple Silicon or Intel'],
              ].map(([label, value]) => (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{label}</span>
                  <span className="text-text-secondary">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

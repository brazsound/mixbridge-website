import { useState, useEffect } from 'react';

const GITHUB_API = 'https://api.github.com/repos/Meteteus/mix-bridge/releases/latest';

interface ReleaseInfo {
  url: string | null;
  version: string;
  error?: string;
}

export function Download() {
  const [release, setRelease] = useState<ReleaseInfo>({ url: null, version: '' });
  const [loading, setLoading] = useState(true);

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
          setRelease({
            url: dmg.browser_download_url,
            version: (data.tag_name ?? '').replace(/^v/, ''),
          });
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
    <section id="download" className="px-6 py-24 md:py-32">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Get Mix Bridge
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Free to try. Purchase a licence from your account page after you install.
          </p>
        </div>

        <div className="glass-card p-8">
          {/* Download button */}
          <div className="mb-6">
            {loading ? (
              <span className="btn-accent w-full cursor-wait opacity-60">
                Loading…
              </span>
            ) : release.url ? (
              <a href={release.url} download className="btn-accent w-full">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download for Mac
              </a>
            ) : (
              <span className="btn-accent w-full opacity-50 cursor-not-allowed">
                Download for Mac
              </span>
            )}
            {release.version && release.url && (
              <p className="text-xs text-text-muted text-center mt-3">
                Version {release.version}
              </p>
            )}
            {release.error && (
              <p className="text-sm text-amber-400 text-center mt-3">{release.error}</p>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '20px' }} />

          {/* System requirements */}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
            Requirements
          </h3>
          <ul className="space-y-2">
            {[
              ['macOS', '13 Ventura or later'],
              ['Pro Tools', '2025.6 or later'],
              ['Chip', 'Apple Silicon or Intel'],
            ].map(([label, value]) => (
              <li key={label} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

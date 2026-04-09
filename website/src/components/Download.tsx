import { useState, useEffect } from 'react';

const GITHUB_API = 'https://api.github.com/repos/matheusbraz/mix-bridge/releases/latest';

interface ReleaseInfo {
  url: string | null;
  version: string;
  error?: string;
}

export function Download() {
  const [release, setRelease] = useState<ReleaseInfo>({
    url: null,
    version: '',
  });
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
          setRelease({
            url: null,
            version: '',
            error: 'Download temporarily unavailable. Please try again later.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchRelease();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="download" className="px-6 py-20 md:py-28">
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-semibold mb-4">
          Get Mix Bridge
        </h2>
        <p className="text-text-secondary mb-8">
          Works with Pro Tools 2025.6 or later.
        </p>
        <div className="glass-card p-8">
          {loading ? (
            <span className="btn-accent w-full inline-flex cursor-wait opacity-60">
              Getting download…
            </span>
          ) : release.url ? (
            <a href={release.url} download className="btn-accent w-full">
              Download for Mac
            </a>
          ) : (
            <span className="btn-accent w-full inline-flex opacity-60 cursor-not-allowed">
              Download for Mac
            </span>
          )}
          {release.version && release.url && (
            <p className="text-sm text-text-muted mt-4">
              Version {release.version}
            </p>
          )}
          {release.error && (
            <p className="text-sm text-amber-400 mt-4">{release.error}</p>
          )}
        </div>
      </div>
    </section>
  );
}

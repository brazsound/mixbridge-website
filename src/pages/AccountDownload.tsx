import { useState, useEffect } from 'react';

const GITHUB_API = 'https://api.github.com/repos/Meteteus/mix-bridge/releases';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  assets: ReleaseAsset[];
  prerelease: boolean;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AccountDownload() {
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${GITHUB_API}?per_page=10`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not fetch releases');
        const data = (await res.json()) as GitHubRelease[];
        if (!cancelled) setReleases(data.filter((r) => !r.prerelease));
      })
      .catch(() => { if (!cancelled) setError('Could not load releases. Try again later.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const latest = releases[0];
  const previous = releases.slice(1);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Download Mix Bridge</h1>
      <p className="text-text-muted text-sm mb-8">
        Get the latest version or browse previous releases.
      </p>

      {loading ? (
        <p className="text-text-muted">Loading releases…</p>
      ) : error ? (
        <p className="text-amber-400 text-sm">{error}</p>
      ) : (
        <div className="space-y-6">
          {/* Latest release + system requirements side by side */}
          <div className="grid gap-5 md:grid-cols-2">
            {latest && (
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="font-medium">Latest Release</h2>
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                    {latest.tag_name}
                  </span>
                </div>
                <p className="text-text-muted text-sm mb-4">
                  Released {formatDate(latest.published_at)}
                </p>
                {(() => {
                  const dmg = latest.assets.find((a) => a.name.endsWith('.dmg'));
                  if (!dmg) return <p className="text-text-muted text-sm">No macOS installer found.</p>;
                  return (
                    <a href={dmg.browser_download_url} download className="btn-accent text-sm py-2.5 px-5 inline-flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      macOS ({formatSize(dmg.size)})
                    </a>
                  );
                })()}
              </div>
            )}

            {/* System requirements */}
            <div className="glass-card p-6">
              <h2 className="font-medium mb-4">System Requirements</h2>
              <ul className="space-y-3">
                {[
                  { icon: '\uF8FF', label: 'macOS', value: '13 Ventura or later' },
                  { icon: '\u266B', label: 'Pro Tools', value: '2025.6 or later (PTSL)' },
                  { icon: '\u2699', label: 'Chip', value: 'Apple Silicon or Intel' },
                ].map((req) => (
                  <li key={req.label} className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{req.label}</span>
                    <span className="text-text-secondary">{req.value}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <h3 className="text-xs font-medium text-text-muted mb-2">Pro Tools Compatibility</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399' }} />
                    <span className="text-text-secondary">2025.6 or later</span>
                    <span className="text-xs text-text-muted ml-auto">Recommended</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fbbf24' }} />
                    <span className="text-text-secondary">2023.12 \u2013 2025.3</span>
                    <span className="text-xs text-text-muted ml-auto">Compatible</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Previous releases */}
          {previous.length > 0 && (
            <div>
              <h2 className="font-medium mb-4">Previous Releases</h2>
              <div className="space-y-3">
                {previous.map((rel) => {
                  const dmg = rel.assets.find((a) => a.name.endsWith('.dmg'));
                  return (
                    <div key={rel.id} className="glass-card px-5 py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                            {rel.tag_name}
                          </span>
                          <span className="text-text-muted text-xs">{formatDate(rel.published_at)}</span>
                        </div>
                        {rel.body && (
                          <p className="text-text-muted text-xs mt-1 truncate max-w-md">
                            {rel.body.split('\n')[0].replace(/^#+\s*/, '')}
                          </p>
                        )}
                      </div>
                      {dmg && (
                        <a
                          href={dmg.browser_download_url}
                          download
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                          macOS
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { DOWNLOADS_ENABLED } from '@/lib/config';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_LICENSE_API_URL ?? '';

interface Release {
  id: string;
  version: string;
  released_at: string;
  download_url: string | null;
  changelog: string | null;
  is_prerelease: boolean;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

/** Minimal markdown renderer: headers, bullets, bold, plain paragraphs */
function renderChangelog(md: string): React.ReactNode {
  const lines = md.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`list-${key}`} className="space-y-1 mb-3 ml-1">
        {listItems.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="mt-[5px] w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, i) => {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    const bullet = line.match(/^[-*]\s+(.+)/);

    if (h2) {
      flushList(String(i));
      nodes.push(
        <p key={i} className="text-xs font-semibold uppercase tracking-widest mb-2 mt-4 first:mt-0" style={{ color: 'var(--accent)' }}>
          {h2[1]}
        </p>
      );
    } else if (h3) {
      flushList(String(i));
      nodes.push(
        <p key={i} className="text-sm font-medium mb-1.5 mt-3" style={{ color: 'var(--text)' }}>
          {h3[1]}
        </p>
      );
    } else if (bullet) {
      listItems.push(bullet[1]);
    } else if (line.trim()) {
      flushList(String(i));
      nodes.push(
        <p key={i} className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          {line}
        </p>
      );
    } else {
      flushList(String(i));
    }
  });
  flushList('end');
  return nodes;
}

function DownloadButton({ url, label }: { url: string | null; label: string }) {
  if (!url) {
    return (
      <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium opacity-40 cursor-not-allowed"
        style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        Not yet available
      </span>
    );
  }
  return (
    <a href={url} download
      className="btn-accent text-sm py-2.5 px-5 inline-flex items-center gap-2">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </a>
  );
}

function ChangelogPanel({ release, defaultOpen = false }: { release: Release; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!release.changelog) return null;
  return (
    <div className="mt-4" style={{ borderTop: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between pt-4 text-sm font-medium transition-colors hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>What's new in {release.version}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="pt-4">
          {renderChangelog(release.changelog)}
        </div>
      )}
    </div>
  );
}

export function AccountDownload() {
  const { session } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [betaOptIn, setBetaOptIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!DOWNLOADS_ENABLED) {
      setLoading(false);
      return;
    }
    if (!API_URL) {
      setError('Download service is not configured.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    const headers: Record<string, string> = {};
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    fetchWithRetry(`${API_URL.replace(/\/$/, '')}/api/releases`, { headers })
      .then(async (res) => {
        const data = (await res.json()) as { releases?: Release[]; beta_opt_in?: boolean; error?: string };
        if (!cancelled) {
          if (!res.ok) { setError(data.error ?? 'Could not load releases.'); return; }
          setReleases(data.releases ?? []);
          setBetaOptIn(data.beta_opt_in ?? false);
        }
      })
      .catch(() => { if (!cancelled) setError('Could not reach the download server. Try again later.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session?.access_token]);

  const latest = releases[0];
  const previous = releases.slice(1);

  if (!DOWNLOADS_ENABLED) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Download MixBridge</h1>
        <p className="text-text-muted text-sm mb-8">Public downloads aren't available quite yet.</p>
        <div
          className="rounded-xl p-8 text-center max-w-lg"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p className="text-sm text-text-secondary mb-2">MixBridge is getting ready for release.</p>
          <p className="text-xs text-text-muted leading-relaxed">
            You already have an account, so you're set — we'll email you the moment the first
            public build is available for download here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">Download MixBridge</h1>
        {betaOptIn && (
          <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium mt-1"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
            Beta Program
          </span>
        )}
      </div>
      <p className="text-text-muted text-sm mb-8">
        {betaOptIn
          ? 'You have access to pre-release builds. Manage this in Account & Security settings.'
          : 'Get the latest version or browse previous releases.'}
      </p>

      {loading ? (
        <p className="text-text-muted">Loading releases…</p>
      ) : error ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
          {error}
        </div>
      ) : releases.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-text-muted text-sm">No releases published yet. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Latest release */}
          {latest && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-medium">Latest Release</h2>
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold"
                    style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                    v{latest.version}
                  </span>
                  {latest.is_prerelease && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium"
                      style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                      Pre-release
                    </span>
                  )}
                </div>
                <p className="text-text-muted text-xs mb-5">Released {formatDate(latest.released_at)}</p>
                <DownloadButton url={latest.download_url} label="Download for macOS" />
                <ChangelogPanel release={latest} defaultOpen={true} />
              </div>

              {/* System requirements */}
              <div className="glass-card p-6">
                <h2 className="font-medium mb-4">System Requirements</h2>
                <ul className="space-y-3">
                  {[
                    { label: 'macOS', value: '13 Ventura or later' },
                    { label: 'Pro Tools', value: '2025.6 or later (PTSL)' },
                    { label: 'Chip', value: 'Apple Silicon or Intel' },
                  ].map((req) => (
                    <li key={req.label} className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">{req.label}</span>
                      <span className="text-text-secondary">{req.value}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Pro Tools Compatibility</p>
                  <div className="space-y-1.5">
                    {[
                      { dot: '#34d399', label: '2025.6 or later', note: 'Supported' },
                      { dot: '#f87171', label: 'Earlier versions', note: 'Not supported' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.dot }} />
                        <span className="text-text-secondary">{row.label}</span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{row.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Previous releases */}
          {previous.length > 0 && (
            <div>
              <h2 className="font-medium mb-4">Previous Releases</h2>
              <div className="space-y-3">
                {previous.map((rel) => (
                  <PreviousReleaseRow key={rel.id} release={rel} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviousReleaseRow({ release }: { release: Release }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-card px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <span className="px-1.5 py-0.5 rounded text-xs font-medium shrink-0"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            v{release.version}
          </span>
          <span className="text-text-muted text-xs">{formatDate(release.released_at)}</span>
          {release.changelog && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="text-xs transition-colors hover:opacity-80 shrink-0"
              style={{ color: 'var(--accent)' }}
            >
              {open ? 'Hide notes' : "What's new"}
            </button>
          )}
        </div>
        <DownloadButton url={release.download_url} label="macOS" />
      </div>
      {open && release.changelog && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          {renderChangelog(release.changelog)}
        </div>
      )}
    </div>
  );
}

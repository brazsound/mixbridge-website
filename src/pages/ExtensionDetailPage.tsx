import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CommentThread } from '@/components/CommentThread';
import { loadHighlighter, type Highlighter } from '@/lib/highlight';
import {
  fetchRegistry,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
  type RegistryEntry,
} from '@/lib/extensions';

type CodeTab = 'main' | 'manifest';

/** Tabbed, syntax-highlighted source viewer with a copy button. */
function CodeViewer({ mainCode, manifestCode, loading, error, repository }: {
  mainCode: string | null;
  manifestCode: string | null;
  loading: boolean;
  error: boolean;
  repository?: string;
}) {
  const [tab, setTab] = useState<CodeTab>('main');
  const [hl, setHl] = useState<Highlighter | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    loadHighlighter().then((h) => { if (alive) setHl(h); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const activeCode = tab === 'main' ? mainCode : manifestCode;
  const activeLang = tab === 'main' ? 'javascript' : 'json';

  const highlighted = useMemo(() => {
    if (!hl || activeCode == null) return null;
    try {
      if (!hl.getLanguage(activeLang)) return null;
      return hl.highlight(activeCode, { language: activeLang, ignoreIllegals: true }).value;
    } catch {
      return null;
    }
  }, [hl, activeCode, activeLang]);

  const copy = async () => {
    if (activeCode == null) return;
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const tabBtn = (id: CodeTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className="px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors"
      style={{
        background: tab === id ? 'var(--accent-subtle)' : 'transparent',
        color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div
        className="flex items-center gap-1 px-2 py-1.5"
        style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}
      >
        {tabBtn('main', 'main.js')}
        {tabBtn('manifest', 'plugin.json')}
        <button
          type="button"
          onClick={() => void copy()}
          disabled={activeCode == null}
          className="ml-auto px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors disabled:opacity-40"
          style={{ color: copied ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-sm text-text-muted">Loading source…</p>
      ) : error || activeCode == null ? (
        <div className="px-4 py-6 text-sm text-text-muted">
          <p>Couldn't load the source for this file.</p>
          {repository && (
            <a href={repository} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              View the repository on GitHub →
            </a>
          )}
        </div>
      ) : (
        <pre className="m-0 p-0 text-[13px] leading-relaxed overflow-auto" style={{ maxHeight: 560 }}>
          {highlighted ? (
            <code className={`hljs language-${activeLang}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
          ) : (
            <code className={`hljs language-${activeLang}`}>{activeCode}</code>
          )}
        </pre>
      )}
    </div>
  );
}

export function ExtensionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [entry, setEntry] = useState<RegistryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [voteCount, setVoteCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);

  const [mainCode, setMainCode] = useState<string | null>(null);
  const [manifestCode, setManifestCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(true);
  const [codeError, setCodeError] = useState(false);

  // Registry entry
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const entries = await fetchRegistry();
        if (cancelled) return;
        const found = entries.find((e) => e.id === id) ?? null;
        setEntry(found);
        setNotFound(!found);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Community votes
  const loadVotes = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('extension_vote_counts')
        .select('votes')
        .eq('extension_id', id)
        .maybeSingle();
      setVoteCount((data as { votes: number } | null)?.votes ?? 0);
      if (user) {
        const { data: mine } = await supabase
          .from('extension_votes')
          .select('extension_id')
          .eq('extension_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        setHasVoted(!!mine);
      } else {
        setHasVoted(false);
      }
    } catch {
      /* page works without community data */
    }
  }, [id, user]);

  useEffect(() => { void loadVotes(); }, [loadVotes]);

  // Source code
  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setCodeLoading(true);
    setCodeError(false);
    setMainCode(null);
    setManifestCode(null);

    const grab = async (url?: string) => {
      if (!url) return null;
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      return res.text();
    };

    (async () => {
      try {
        const [main, manifest] = await Promise.all([
          grab(entry.files?.main),
          grab(entry.files?.manifest),
        ]);
        if (cancelled) return;
        setMainCode(main);
        setManifestCode(manifest);
        if (main == null && manifest == null) setCodeError(true);
      } catch {
        if (!cancelled) setCodeError(true);
      } finally {
        if (!cancelled) setCodeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entry]);

  const handleVote = async () => {
    if (!user || !entry) return;
    if (hasVoted) {
      await supabase.from('extension_votes').delete().eq('extension_id', entry.id).eq('user_id', user.id);
      setHasVoted(false);
      setVoteCount((v) => Math.max(0, v - 1));
    } else {
      const { error } = await supabase.from('extension_votes').insert({ extension_id: entry.id, user_id: user.id });
      if (!error) {
        setHasVoted(true);
        setVoteCount((v) => v + 1);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-[56px]">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-sm text-text-muted">Loading extension…</p>
        </div>
      </div>
    );
  }

  if (notFound || !entry) {
    return (
      <div className="min-h-screen pt-[56px]">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold mb-3">Extension not found</h1>
          <p className="text-sm text-text-muted mb-6">
            We couldn't find an extension with the id “{id}”. It may have been renamed or delisted.
          </p>
          <Link to="/extensions" className="btn-accent">Browse all extensions</Link>
        </div>
      </div>
    );
  }

  const permissions = entry.permissions ?? [];
  const domains = entry.allowedDomains ?? [];
  const usesNetwork = permissions.includes('network');

  const metaChip = (label: string) => (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
    >
      {label}
    </span>
  );

  return (
    <div className="min-h-screen pt-[56px]">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <Link to="/extensions" className="text-sm text-text-muted hover:text-text transition-colors">
          ← All extensions
        </Link>

        {/* Header */}
        <div className="mt-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{entry.name}</h1>
            {entry.description && (
              <p className="text-text-secondary text-[15px] leading-relaxed mt-2 max-w-2xl">{entry.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleVote()}
            disabled={!user}
            aria-pressed={hasVoted}
            title={user ? (hasVoted ? 'Remove your vote' : 'Vote for this extension') : 'Sign in to vote'}
            className="flex flex-col items-center justify-center px-4 py-2 rounded-xl text-sm font-medium shrink-0 transition-colors"
            style={{
              background: hasVoted ? 'var(--accent-subtle)' : 'var(--surface)',
              border: `1px solid ${hasVoted ? 'rgba(123,92,255,0.4)' : 'var(--border)'}`,
              color: hasVoted ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: user ? 'pointer' : 'default',
              opacity: user ? 1 : 0.6,
            }}
          >
            <span className="text-base leading-none">▲</span>
            <span className="mt-1 leading-none">{voteCount}</span>
          </button>
        </div>

        {/* Meta chips */}
        <div className="flex items-center gap-2 flex-wrap mt-4">
          {metaChip(`v${entry.version}`)}
          {entry.author && metaChip(`by ${entry.author}`)}
          {entry.license && metaChip(entry.license)}
          {entry.minAppVersion && metaChip(`Requires MixBridge ${entry.minAppVersion}+`)}
        </div>

        {/* Important links */}
        <div className="flex items-center gap-4 flex-wrap mt-5 text-[13px]">
          {entry.repository && (
            <a href={entry.repository} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Source repository ↗
            </a>
          )}
          {entry.files?.manifest && (
            <a href={entry.files.manifest} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text transition-colors">
              plugin.json (raw) ↗
            </a>
          )}
          {entry.files?.main && (
            <a href={entry.files.main} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text transition-colors">
              main.js (raw) ↗
            </a>
          )}
        </div>

        {/* Permissions */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Permissions</h2>
          {permissions.length === 0 ? (
            <p className="text-sm text-text-muted">This extension requests no special permissions.</p>
          ) : (
            <div className="space-y-2">
              {permissions.map((perm) => (
                <div key={perm} className="glass-card px-4 py-3 flex items-start gap-3">
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                    style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(123,92,255,0.2)', color: 'var(--accent)' }}
                  >
                    {PERMISSION_LABELS[perm] ?? perm}
                  </span>
                  <span className="text-sm text-text-secondary leading-relaxed">
                    {PERMISSION_DESCRIPTIONS[perm] ?? 'Grants an additional capability.'}
                  </span>
                </div>
              ))}
              {usesNetwork && (
                <p className="text-[13px] text-text-muted pt-1">
                  Network access is limited to:{' '}
                  <span className="text-text-secondary">
                    {domains.includes('*') ? 'any domain' : domains.join(', ') || '—'}
                  </span>
                </p>
              )}
            </div>
          )}
        </section>

        {/* Source code */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Source code</h2>
          <p className="text-[13px] text-text-muted mb-3">
            Every extension is open source and runs sandboxed. Read exactly what it does before you install it.
          </p>
          <CodeViewer
            mainCode={mainCode}
            manifestCode={manifestCode}
            loading={codeLoading}
            error={codeError}
            repository={entry.repository}
          />
        </section>

        {/* Install */}
        <section className="mt-10 glass-card p-6">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">How to install</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Open MixBridge and go to <span className="text-text">Settings → Extensions → Browse</span> to install
            {' '}{entry.name} in one click. Prefer to do it by hand? Copy the extension folder from the{' '}
            {entry.repository ? (
              <a href={entry.repository} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">repository</a>
            ) : 'repository'}{' '}
            into your extensions folder (Settings → Extensions → “Open extensions folder”), hit Rescan, and enable it.
          </p>
        </section>

        {/* Discussion */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Discussion</h2>
          <CommentThread extensionId={entry.id} />
        </section>
      </div>
    </div>
  );
}

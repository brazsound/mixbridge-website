import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DOWNLOADS_ENABLED } from '@/lib/config';
import { fetchRegistry, PERMISSION_LABELS, type RegistryEntry } from '@/lib/extensions';

export function ExtensionsPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [installs, setInstalls] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchRegistry();
        if (!cancelled) setEntries(list);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: counts } = await supabase.from('extension_vote_counts').select('extension_id, votes');
        if (counts && !cancelled) {
          const map: Record<string, number> = {};
          for (const r of counts as { extension_id: string; votes: number }[]) map[r.extension_id] = r.votes;
          setVotes(map);
        }
        const { data: cc } = await supabase.from('extension_comment_counts').select('extension_id, comments');
        if (cc && !cancelled) {
          const map: Record<string, number> = {};
          for (const r of cc as { extension_id: string; comments: number }[]) map[r.extension_id] = r.comments;
          setCommentCounts(map);
        }
        const { data: inst } = await supabase.from('extensions').select('id, installs');
        if (inst && !cancelled) {
          const map: Record<string, number> = {};
          for (const r of inst as { id: string; installs: number }[]) map[r.id] = r.installs;
          setInstalls(map);
        }
        if (user && !cancelled) {
          const { data: mine } = await supabase.from('extension_votes').select('extension_id').eq('user_id', user.id);
          if (mine) setMyVotes(new Set((mine as { extension_id: string }[]).map((r) => r.extension_id)));
        }
      } catch {
        // Page works without community data.
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleVote = async (id: string) => {
    if (!user) return;
    const hasVoted = myVotes.has(id);
    if (hasVoted) {
      await supabase.from('extension_votes').delete().eq('extension_id', id).eq('user_id', user.id);
      setMyVotes((prev) => { const next = new Set(prev); next.delete(id); return next; });
      setVotes((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 1) - 1) }));
    } else {
      const { error } = await supabase.from('extension_votes').insert({ extension_id: id, user_id: user.id });
      if (!error) {
        setMyVotes((prev) => new Set(prev).add(id));
        setVotes((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
      }
    }
  };

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (votes[b.id] ?? 0) - (votes[a.id] ?? 0) || a.name.localeCompare(b.name)),
    [entries, votes]
  );

  return (
    <div className="min-h-screen pt-[56px]">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">Extensions</h1>
          <p className="text-text-secondary text-sm max-w-xl mx-auto leading-relaxed">
            Community-built add-ons for MixBridge. Every extension is free, with public source, runs
            sandboxed with explicit permissions, and installs right from the app (Settings → Extensions → Browse).
            Click any extension to read its source, links, and discussion.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-text-muted">Loading extensions…</p>
        ) : loadError ? (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-text-secondary">The extension directory isn't reachable right now.</p>
            <p className="text-xs text-text-muted mt-2">Please try again in a bit.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((entry) => {
              const voted = myVotes.has(entry.id);
              return (
                <div key={entry.id} className="glass-card p-6 relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Stretched link — makes the whole card navigate to the detail page */}
                        <Link
                          to={`/extensions/${entry.id}`}
                          className="font-medium text-[15px] hover:text-accent transition-colors after:absolute after:inset-0 after:content-['']"
                        >
                          {entry.name}
                        </Link>
                        <span className="text-xs text-text-muted">v{entry.version}</span>
                        {entry.author && <span className="text-xs text-text-muted">by {entry.author}</span>}
                      </div>
                      {entry.description && (
                        <p className="text-text-muted text-sm leading-relaxed mt-1">{entry.description}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleVote(entry.id)}
                      disabled={!user}
                      aria-pressed={voted}
                      title={user ? (voted ? 'Remove your vote' : 'Vote for this extension') : 'Sign in to vote'}
                      className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-colors"
                      style={{
                        background: voted ? 'var(--accent-subtle)' : 'var(--surface)',
                        border: `1px solid ${voted ? 'rgba(123,92,255,0.4)' : 'var(--border)'}`,
                        color: voted ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: user ? 'pointer' : 'default',
                        opacity: user ? 1 : 0.6,
                      }}
                    >
                      ▲ {votes[entry.id] ?? 0}
                    </button>
                  </div>

                  {(installs[entry.id] ?? 0) > 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {installs[entry.id]!.toLocaleString()} install{installs[entry.id] === 1 ? '' : 's'}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mt-4">
                    {(entry.permissions ?? []).map((perm) => (
                      <span
                        key={perm}
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(123,92,255,0.2)', color: 'var(--accent)' }}
                        title={perm}
                      >
                        {PERMISSION_LABELS[perm] ?? perm}
                      </span>
                    ))}
                    {(entry.permissions ?? []).includes('network') && (
                      <span className="text-[11px] text-text-muted">
                        → {(entry.allowedDomains ?? []).includes('*') ? 'any domain' : (entry.allowedDomains ?? []).join(', ')}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-3 relative z-10">
                      <span className="text-[12px] text-text-muted">
                        💬 {commentCounts[entry.id] ?? 0} comment{(commentCounts[entry.id] ?? 0) === 1 ? '' : 's'}
                      </span>
                      <Link
                        to={`/extensions/${entry.id}`}
                        className="text-[12px] text-accent hover:underline"
                      >
                        View details →
                      </Link>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-12 space-y-3">
          <p className="text-sm text-text-muted">
            Built something? Submit it from your{' '}
            <Link to="/account/extensions" className="text-accent hover:underline">
              account dashboard
            </Link>{' '}
            — or the old-school way, via a{' '}
            <a
              href="https://github.com/brazsound/mixbridge/tree/main/registry"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              registry pull request
            </a>
            .
          </p>
          <a href="/#download" className="btn-accent">
            {DOWNLOADS_ENABLED ? 'Get MixBridge' : 'MixBridge — coming soon'}
          </a>
        </div>
      </div>
    </div>
  );
}

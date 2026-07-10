import { useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DOWNLOADS_ENABLED } from '@/lib/config';

const REGISTRY_URL =
  'https://raw.githubusercontent.com/brazsound/mixbridge/main/registry/registry.json';

interface RegistryEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  repository?: string;
  license?: string;
  permissions?: string[];
  allowedDomains?: string[];
  status?: string;
}

interface CommentRow {
  id: string;
  user_id: string;
  author_name: string;
  body: string;
  author_status: 'planned' | 'fixed' | 'declined' | null;
  created_at: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  'queue:read': 'Read queue',
  'queue:write': 'Edit queue',
  events: 'Lifecycle events',
  naming: 'Naming tokens',
  'files:read': 'Read files',
  'files:write': 'Write files',
  network: 'Network',
  'ui:menus': 'Context menus',
  'ui:panels': 'Panels',
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function CommentThread({ extensionId }: { extensionId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('extension_comments')
        .select('id, user_id, author_name, body, author_status, created_at')
        .eq('extension_id', extensionId)
        .order('created_at', { ascending: false })
        .limit(50);
      setComments((data ?? []) as CommentRow[]);
    } finally {
      setLoading(false);
    }
  }, [extensionId]);

  useEffect(() => { void load(); }, [load]);

  const handlePost = async () => {
    const body = draft.trim();
    if (!body || !user) return;
    setPosting(true);
    setError(null);
    try {
      const authorName =
        ((user.user_metadata as { full_name?: string })?.full_name || user.email?.split('@')[0] || 'User').slice(0, 60);
      const { error: err } = await supabase.from('extension_comments').insert({
        extension_id: extensionId,
        user_id: user.id,
        author_name: authorName,
        body: body.slice(0, 4000),
      });
      if (err) throw new Error(err.message);
      setDraft('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('extension_comments').delete().eq('id', id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
      {user ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handlePost(); }}
            placeholder="Request a feature, report a bug, say thanks…"
            aria-label="Write a comment"
            className="flex-1 px-3 py-2 rounded-lg text-sm min-w-0"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
          />
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={posting || !draft.trim()}
            className="btn-accent text-sm px-4 py-2"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          <Link to="/account" className="text-accent hover:underline">Sign in</Link> to join the discussion.
        </p>
      )}
      {error && <p className="text-xs text-amber-400">{error}</p>}

      {loading ? (
        <p className="text-xs text-text-muted">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-text-muted">No comments yet — be the first.</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-text-secondary">{c.author_name || 'User'}</span>
                <span className="text-[11px] text-text-muted">{timeAgo(c.created_at)}</span>
                {c.author_status && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ border: '1px solid var(--border)', color: 'var(--accent)' }}>
                    {c.author_status === 'planned' ? 'Planned' : c.author_status === 'fixed' ? 'Fixed' : 'Declined'}
                  </span>
                )}
                {user?.id === c.user_id && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(c.id)}
                    aria-label="Delete your comment"
                    className="ml-auto text-[11px] text-text-muted hover:text-text transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-sm mt-1 leading-relaxed break-words text-text-secondary">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExtensionsPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openThread, setOpenThread] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(REGISTRY_URL);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { extensions?: RegistryEntry[] };
        if (!cancelled) {
          setEntries((data.extensions ?? []).filter((e) => e.id && e.status !== 'delisted' && e.status !== 'pending'));
        }
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
            Community-built add-ons for MixBridge. Every extension is open source, runs sandboxed
            with explicit permissions, and installs right from the app (Settings → Extensions → Browse).
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
                <div key={entry.id} className="glass-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-medium text-[15px]">{entry.name}</h2>
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-colors"
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
                    <span className="ml-auto flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOpenThread((cur) => (cur === entry.id ? null : entry.id))}
                        aria-expanded={openThread === entry.id}
                        className="text-[12px] text-text-muted hover:text-text transition-colors"
                      >
                        💬 {commentCounts[entry.id] ?? 0} comment{(commentCounts[entry.id] ?? 0) === 1 ? '' : 's'}
                      </button>
                      {entry.repository && (
                        <a
                          href={entry.repository}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-text-muted hover:text-text transition-colors underline underline-offset-2"
                        >
                          Source code
                        </a>
                      )}
                    </span>
                  </div>

                  {openThread === entry.id && <CommentThread extensionId={entry.id} />}
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

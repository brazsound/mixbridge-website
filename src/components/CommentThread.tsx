import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/extensions';

interface CommentRow {
  id: string;
  user_id: string;
  author_name: string;
  body: string;
  author_status: 'planned' | 'fixed' | 'declined' | null;
  created_at: string;
}

/**
 * Discussion thread for a single extension. Anyone signed in can post; authors
 * (via the admin tools) can tag a comment planned / fixed / declined. Used on
 * the extension detail page.
 */
export function CommentThread({ extensionId }: { extensionId: string }) {
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
    <div className="space-y-3">
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

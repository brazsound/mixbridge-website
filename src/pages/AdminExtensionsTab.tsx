import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Admin review queue for extension submissions.
 *
 * Reads via RLS (admins see all rows), acts via the admin-gated
 * approve/reject RPCs. Approving also upserts the extension into the public
 * `extensions` table (status: listed) so votes/comments work immediately;
 * the registry.json entry for the app's Browse tab is shown ready to paste.
 */

interface SubmissionRow {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  extension_id: string;
  name: string;
  version: string;
  description: string;
  author_name: string;
  repository: string;
  license: string;
  min_app_version: string;
  permissions: string[];
  allowed_domains: string[];
  manifest_url: string;
  main_url: string;
  created_at: string;
}

function registrySnippet(s: SubmissionRow): string {
  const entry: Record<string, unknown> = {
    id: s.extension_id,
    name: s.name,
    version: s.version,
    description: s.description,
    author: s.author_name,
    repository: s.repository,
    license: s.license,
    minAppVersion: s.min_app_version || '0.4.0',
    permissions: s.permissions,
  };
  if (s.allowed_domains.length > 0) entry.allowedDomains = s.allowed_domains;
  entry.files = { manifest: s.manifest_url, main: s.main_url };
  return JSON.stringify(entry, null, 2);
}

export function AdminExtensionsTab() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvedSnippet, setApprovedSnippet] = useState<{ id: string; json: string } | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('extension_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) setError(err.message);
    else setRows((data ?? []) as SubmissionRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const approve = useCallback(async (s: SubmissionRow) => {
    setBusy(s.id);
    setError(null);
    try {
      const { error: err } = await supabase.rpc('approve_extension_submission', { submission_id: s.id });
      if (err) throw new Error(err.message);
      setApprovedSnippet({ id: s.extension_id, json: registrySnippet(s) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [load]);

  const reject = useCallback(async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const { error: err } = await supabase.rpc('reject_extension_submission', {
        submission_id: id,
        note: rejectNote.trim() || 'Does not meet listing requirements.',
      });
      if (err) throw new Error(err.message);
      setRejectFor(null);
      setRejectNote('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [rejectNote, load]);

  const pending = rows.filter((r) => r.status === 'pending');
  const resolved = rows.filter((r) => r.status !== 'pending');
  const visible = showResolved ? rows : pending;

  if (loading) return <p className="text-text-muted text-sm">Loading submissions…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-text-muted">
          {pending.length} pending · {resolved.length} resolved
        </p>
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className="text-[13px] text-text-muted hover:text-text transition-colors underline underline-offset-2"
        >
          {showResolved ? 'Show pending only' : 'Show all'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </div>
      )}

      {approvedSnippet && (
        <div className="rounded-xl p-5" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-medium" style={{ color: '#34d399' }}>
              Approved — final step: add this entry to registry/registry.json (keep it alphabetized) and push.
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(approvedSnippet.json)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}
              >
                Copy JSON
              </button>
              <button
                type="button"
                onClick={() => setApprovedSnippet(null)}
                className="text-xs px-2 py-1.5 text-text-muted hover:text-text"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
          <pre className="text-[11px] leading-relaxed overflow-x-auto p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)' }}>
            {approvedSnippet.json}
          </pre>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
          <p className="text-sm text-text-muted">No {showResolved ? '' : 'pending '}submissions.</p>
        </div>
      ) : (
        visible.map((s) => (
          <div key={s.id} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[15px]">{s.name}</span>
                  <span className="text-xs text-text-muted">v{s.version}</span>
                  <code className="text-xs text-text-muted">{s.extension_id}</code>
                  {s.status !== 'pending' && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: s.status === 'approved' ? '#34d399' : '#f87171',
                        border: `1px solid ${s.status === 'approved' ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}`,
                      }}>
                      {s.status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-muted mt-1 leading-relaxed">{s.description}</p>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <span className="text-xs text-text-muted">by {s.author_name || 'unknown'}</span>
                  <span className="text-xs text-text-muted">· {s.license}</span>
                  {s.permissions.map((p) => (
                    <span key={p} className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(123,92,255,0.2)', color: 'var(--accent)' }}>
                      {p}
                    </span>
                  ))}
                  {s.allowed_domains.length > 0 && (
                    <span className="text-[11px] text-text-muted">→ {s.allowed_domains.join(', ')}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[12px]">
                  <a href={s.repository} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Repository</a>
                  <a href={s.manifest_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">plugin.json</a>
                  <a href={s.main_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">main.js (read the code)</a>
                </div>
                <p className="text-[11px] text-text-muted mt-2">
                  Test locally: Settings → Extensions → Open extensions folder → create <code>{s.extension_id}/</code> and
                  save both files into it → Rescan.
                </p>
              </div>

              {s.status === 'pending' && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void approve(s)}
                    disabled={busy !== null}
                    className="btn-accent text-sm px-5"
                  >
                    {busy === s.id ? 'Working…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRejectFor(rejectFor === s.id ? null : s.id); setRejectNote(''); }}
                    disabled={busy !== null}
                    className="text-sm px-5 py-2 rounded-[var(--radius)] font-medium transition-colors"
                    style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>

            {rejectFor === s.id && (
              <div className="mt-4 pt-4 flex flex-col sm:flex-row gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                <input
                  type="text"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Reason (shown to the submitter)"
                  className="flex-1 px-3 py-2 rounded-lg text-sm min-w-0"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => void reject(s.id)}
                  disabled={busy !== null}
                  className="text-sm px-4 py-2 rounded-lg font-medium shrink-0"
                  style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}
                >
                  Confirm reject
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

import { Component, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const API = (import.meta.env.VITE_LICENSE_API_URL ?? '').replace(/\/$/, '');

// ── Types ─────────────────────────────────────────────────────────────────────

interface Account {
  email: string;
  auth_id: string | null;
  signed_up_at: string;
  banned_until?: string | null;
}

interface BugReport {
  id: string;
  created_at: string;
  description: string | null;
  log: unknown;
  resolved: boolean;
  internal_note: string | null;
}

interface AuditEntry {
  id: string;
  created_at: string;
  admin_email: string;
  action: string;
  target_email: string | null;
  details: Record<string, unknown> | null;
}

interface Stats {
  total_members: number;
  new_members_this_week: number;
  open_bug_reports: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function apiReq(token: string, path: string, method: string, body?: object) {
  return fetch(`${API}/api/admin/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function isBanned(a: Account): boolean {
  return !!a.banned_until && new Date(a.banned_until).getTime() > Date.now();
}

function exportCSV(accounts: Account[]) {
  const rows = [
    ['Email', 'Signed up', 'Status'],
    ...accounts.map((a) => [a.email, a.signed_up_at, isBanned(a) ? 'Banned' : 'Active']),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `mixbridge-members-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared small components ───────────────────────────────────────────────────

function MemberAvatar({ email }: { email: string | undefined | null }) {
  const letter = (email?.[0] ?? '?').toUpperCase();
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

function emailLocalPart(email: string | undefined | null) {
  const e = email ?? '';
  const i = e.indexOf('@');
  return i === -1 ? e : e.slice(0, i);
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
          {subtitle && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        <button onClick={onClose} className="text-xs mt-0.5 transition-colors hover:opacity-70" style={{ color: 'var(--text-muted)' }}>✕</button>
      </div>
    </div>
  );
}

class AccountsTabErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { message: null };
  }

  static getDerivedStateFromError(err: unknown): { message: string | null } {
    return { message: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="glass-card p-6 mb-6" style={{ border: '1px solid rgba(239,68,68,0.35)' }}>
          <p className="text-sm font-medium mb-2" style={{ color: '#f87171' }}>Members tab crashed</p>
          <p className="text-xs whitespace-pre-wrap break-words" style={{ color: 'var(--text-muted)' }}>{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiReq(token, 'stats', 'GET')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Stats) => setStats(d))
      .catch(() => setError('Could not load stats.'));
  }, [token]);

  const cards: { label: string; value: number | string }[] = [
    { label: 'Total members', value: stats?.total_members ?? '—' },
    { label: 'New this week', value: stats?.new_members_this_week ?? '—' },
    { label: 'Open bug reports', value: stats?.open_bug_reports ?? '—' },
  ];

  return (
    <div>
      {error && <p className="text-sm mb-4" style={{ color: '#fbbf24' }}>{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-card px-5 py-6">
            <p className="text-3xl font-semibold" style={{ color: 'var(--text)' }}>{c.value}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Members Tab ───────────────────────────────────────────────────────────────

function AccountsTab({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [emailTarget, setEmailTarget] = useState<Account | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiReq(token, 'accounts', 'GET');
      if (res.status === 403) { setError('Access denied.'); return; }
      const data = await res.json() as { accounts?: Account[]; error?: string };
      if (data.error) { setError(data.error); return; }
      setAccounts(data.accounts ?? []);
    } catch {
      setError('Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const flash = (msg: string) => { setStatus(msg); window.setTimeout(() => setStatus(null), 3000); };

  const invite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    try {
      const res = await apiReq(token, 'user-actions', 'POST', { action: 'invite', email });
      const d = await res.json() as { error?: string };
      if (!res.ok) { flash(d.error ?? 'Invite failed.'); return; }
      setInviteEmail('');
      flash('Invite sent.');
      await load();
    } finally {
      setInviting(false);
    }
  };

  const sendReset = async (a: Account) => {
    setBusyEmail(a.email);
    try {
      const res = await apiReq(token, 'user-actions', 'POST', { action: 'reset_password', email: a.email });
      const d = await res.json() as { error?: string };
      flash(res.ok ? 'Password reset link sent.' : (d.error ?? 'Failed.'));
    } finally {
      setBusyEmail(null);
    }
  };

  const toggleBan = async (a: Account) => {
    const banned = isBanned(a);
    if (!window.confirm(banned ? `Unban ${a.email}?` : `Ban ${a.email}? They will be signed out and blocked from using their account.`)) return;
    setBusyEmail(a.email);
    try {
      const res = await apiReq(token, 'user-actions', 'POST', { action: banned ? 'unban' : 'ban', auth_id: a.auth_id, email: a.email });
      const d = await res.json() as { error?: string };
      if (!res.ok) { flash(d.error ?? 'Failed.'); return; }
      flash(banned ? 'Member unbanned.' : 'Member banned.');
      await load();
    } finally {
      setBusyEmail(null);
    }
  };

  const removeUser = async (a: Account) => {
    if (!window.confirm(`Delete ${a.email}? Their account and sign-in are permanently removed. This cannot be undone.`)) return;
    setBusyEmail(a.email);
    try {
      const res = await apiReq(token, 'user-actions', 'POST', { action: 'delete_user', auth_id: a.auth_id, email: a.email });
      const d = await res.json() as { error?: string };
      if (!res.ok) { flash(d.error ?? 'Failed.'); return; }
      flash('Member deleted.');
      await load();
    } finally {
      setBusyEmail(null);
    }
  };

  const openEmail = (a: Account) => { setEmailTarget(a); setSubject(''); setMessageText(''); };
  const openBroadcast = () => { setBroadcastOpen(true); setSubject(''); setMessageText(''); };

  const sendCustom = async () => {
    if (!emailTarget || !subject.trim() || !messageText.trim()) return;
    setSending(true);
    try {
      const res = await apiReq(token, 'email', 'POST', { action: 'send_custom', to: emailTarget.email, subject: subject.trim(), text: messageText.trim() });
      const d = await res.json() as { error?: string };
      if (!res.ok) { flash(d.error ?? 'Failed to send.'); return; }
      setEmailTarget(null);
      flash('Email sent.');
    } finally {
      setSending(false);
    }
  };

  const sendBroadcast = async () => {
    if (!subject.trim() || !messageText.trim()) return;
    if (!window.confirm(`Send this message to all ${accounts.length} members?`)) return;
    setSending(true);
    try {
      const res = await apiReq(token, 'email', 'POST', { action: 'broadcast', filter: 'all', subject: subject.trim(), text: messageText.trim() });
      const d = await res.json() as { error?: string; sent?: number };
      if (!res.ok) { flash(d.error ?? 'Failed to send.'); return; }
      setBroadcastOpen(false);
      flash(`Sent to ${d.sent ?? 0} members.`);
    } finally {
      setSending(false);
    }
  };

  const filtered = accounts.filter((a) => a.email.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <h2 className="font-medium" style={{ color: 'var(--text)' }}>
          Members
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>{accounts.length}</span>
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={openBroadcast} className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Message all
          </button>
          <button onClick={() => exportCSV(accounts)} className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Export CSV
          </button>
          <button onClick={() => void load()} disabled={loading} className="text-sm transition-colors disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="Invite a member by email…" onKeyDown={(e) => { if (e.key === 'Enter') void invite(); }}
          className="flex-1 min-w-[220px] px-4 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ color: 'var(--text)' }} />
        <button onClick={() => void invite()} disabled={inviting || !inviteEmail.trim()}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {inviting ? 'Sending…' : 'Send invite'}
        </button>
      </div>

      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search members…"
        className="w-full mb-4 px-4 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
        style={{ color: 'var(--text)' }} />

      {status && <p className="text-sm mb-4" style={{ color: 'var(--accent)' }}>{status}</p>}
      {error && <p className="text-sm mb-4" style={{ color: '#fbbf24' }}>{error}</p>}

      <div className="glass-card overflow-hidden">
        {!loading && filtered.length === 0 && !error && (
          <p className="px-6 py-14 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No members found.</p>
        )}
        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Member', 'Signed up', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const banned = isBanned(a);
                  const busy = busyEmail === a.email;
                  return (
                    <tr key={a.email} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <MemberAvatar email={a.email} />
                          <div className="min-w-0">
                            <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{emailLocalPart(a.email)}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(a.signed_up_at)}</td>
                      <td className="px-5 py-3">
                        {banned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.25)' }}>Banned</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }}>Active</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 justify-end">
                          <button onClick={() => openEmail(a)} disabled={busy} className="text-xs transition-colors disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>Email</button>
                          <button onClick={() => void sendReset(a)} disabled={busy} className="text-xs transition-colors disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>Send reset</button>
                          <button onClick={() => void toggleBan(a)} disabled={busy || !a.auth_id} className="text-xs transition-colors disabled:opacity-40" style={{ color: banned ? '#16a34a' : '#ca8a04' }}>{banned ? 'Unban' : 'Ban'}</button>
                          <button onClick={() => void removeUser(a)} disabled={busy || !a.auth_id} className="text-xs transition-colors disabled:opacity-40" style={{ color: '#f87171' }}>{busy ? '…' : 'Delete'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {emailTarget && (
        <Modal onClose={() => setEmailTarget(null)}>
          <ModalHeader title="Email member" subtitle={emailTarget.email} onClose={() => setEmailTarget(null)} />
          <div className="p-6 flex flex-col gap-3">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent" style={{ color: 'var(--text)' }} />
            <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Message…" rows={6}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent resize-none" style={{ color: 'var(--text)' }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEmailTarget(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={() => void sendCustom()} disabled={sending || !subject.trim() || !messageText.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: 'var(--accent)', color: '#fff' }}>{sending ? 'Sending…' : 'Send'}</button>
            </div>
          </div>
        </Modal>
      )}

      {broadcastOpen && (
        <Modal onClose={() => setBroadcastOpen(false)}>
          <ModalHeader title="Message all members" subtitle={`${accounts.length} recipients`} onClose={() => setBroadcastOpen(false)} />
          <div className="p-6 flex flex-col gap-3">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent" style={{ color: 'var(--text)' }} />
            <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Message…" rows={6}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent resize-none" style={{ color: 'var(--text)' }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setBroadcastOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={() => void sendBroadcast()} disabled={sending || !subject.trim() || !messageText.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: 'var(--accent)', color: '#fff' }}>{sending ? 'Sending…' : 'Send to all'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Bug Reports Tab ───────────────────────────────────────────────────────────

function BugReportsTab({ token }: { token: string }) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/bug-reports`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403) { setError('Access denied.'); return; }
      const data = await res.json() as { reports?: BugReport[]; error?: string };
      if (data.error) { setError(data.error); return; }
      const loaded = data.reports ?? [];
      setReports(loaded);
      const notes: Record<string, string> = {};
      loaded.forEach((r) => { notes[r.id] = r.internal_note ?? ''; });
      setNoteValues(notes);
    } catch {
      setError('Failed to load bug reports.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const toggleResolved = async (r: BugReport) => {
    setTogglingId(r.id);
    await apiReq(token, 'bug-reports', 'PATCH', { id: r.id, resolved: !r.resolved });
    setTogglingId(null);
    await load();
  };

  const saveNote = async (id: string) => {
    setSavingNote(id);
    await apiReq(token, 'bug-reports', 'PATCH', { id, internal_note: noteValues[id] ?? '' });
    setSavingNote(null);
    await load();
  };

  const visible = reports.filter((r) => showResolved || !r.resolved);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="font-medium" style={{ color: 'var(--text)' }}>
            Bug Reports
            <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>{reports.filter((r) => !r.resolved).length} open</span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="accent-current" />
            Show resolved
          </label>
          <button onClick={() => void load()} disabled={loading} className="text-sm transition-colors disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: '#fbbf24' }}>{error}</p>}

      {!loading && visible.length === 0 && !error && (
        <div className="glass-card px-6 py-14 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{showResolved ? 'No bug reports.' : 'No open bug reports.'}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((r) => (
          <div key={r.id} className="glass-card overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDateTime(r.created_at)}</span>
                  {r.resolved && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>
                      Resolved
                    </span>
                  )}
                  {r.internal_note && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      Note
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: 'var(--text)' }}>
                  {r.description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No description</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void toggleResolved(r)}
                  disabled={togglingId === r.id}
                  className="text-xs font-medium transition-colors disabled:opacity-40"
                  style={{ color: r.resolved ? 'var(--text-muted)' : '#16a34a' }}>
                  {togglingId === r.id ? '…' : r.resolved ? 'Reopen' : 'Resolve'}
                </button>
                <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
                  {expanded === r.id ? 'Hide' : 'Expand'}
                </button>
              </div>
            </div>

            {expanded === r.id && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="p-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Log</p>
                  <pre className="text-xs overflow-auto max-h-60 p-4 rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {JSON.stringify(r.log, null, 2)}
                  </pre>
                </div>
                <div className="px-5 pb-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Internal note</p>
                  <textarea
                    value={noteValues[r.id] ?? ''}
                    onChange={(e) => setNoteValues((v) => ({ ...v, [r.id]: e.target.value }))}
                    placeholder="Add a note for your team…"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    style={{ color: 'var(--text)' }}
                  />
                  <button onClick={() => void saveNote(r.id)} disabled={savingNote === r.id}
                    className="mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {savingNote === r.id ? 'Saving…' : 'Save note'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────────

function AuditLogTab({ token }: { token: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [targetFilter, setTargetFilter] = useState('');

  const load = useCallback(async (p: number, target: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: '50' });
      if (target.trim()) params.set('target', target.trim());
      const res = await fetch(`${API}/api/admin/audit-log?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 403) { setError('Access denied.'); return; }
      const data = await res.json() as { entries?: AuditEntry[]; total?: number; total_pages?: number; error?: string };
      if (data.error) { setError(data.error); return; }
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.total_pages ?? 1);
    } catch {
      setError('Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(page, targetFilter); }, [load, page, targetFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <input type="search" value={targetFilter} onChange={(e) => { setTargetFilter(e.target.value); setPage(1); }}
          placeholder="Filter by target email…"
          className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ color: 'var(--text)' }} />
        <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>{total} entries</span>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: '#fbbf24' }}>{error}</p>}

      <div className="glass-card overflow-hidden">
        {loading && <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
        {!loading && entries.length === 0 && !error && (
          <p className="px-6 py-14 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No audit log entries.</p>
        )}
        {entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['When', 'Admin', 'Action', 'Target', 'Details'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDateTime(e.created_at)}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.admin_email}</td>
                    <td className="px-5 py-3 text-xs font-medium" style={{ color: 'var(--text)' }}>{e.action.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.target_email ?? '-'}</td>
                    <td className="px-5 py-3 text-xs font-mono max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {e.details ? JSON.stringify(e.details) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}
            className="px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Previous
          </button>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}
            className="px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ── Releases Tab ──────────────────────────────────────────────────────────────

interface Release {
  id: string;
  version: string;
  released_at: string;
  download_url: string | null;
  changelog: string | null;
  is_prerelease: boolean;
  is_published: boolean;
}

const emptyRelease = (): Omit<Release, 'id' | 'is_prerelease' | 'is_published'> & { is_prerelease: boolean; is_published: boolean } => ({
  version: '',
  released_at: new Date().toISOString().slice(0, 10),
  download_url: '',
  changelog: '',
  is_prerelease: false,
  is_published: true,
});

function ReleasesTab({ token }: { token: string }) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Release | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyRelease());
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = () => {
    setLoading(true); setErr(null);
    fetch(`${API}/api/admin/releases`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { releases?: Release[]; error?: string }) => {
        if (d.error) { setErr(d.error); return; }
        setReleases(d.releases ?? []);
      })
      .catch(() => setErr('Could not load releases.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyRelease()); setSaveErr(null); setCreating(true); setEditing(null); };
  const openEdit = (r: Release) => {
    setForm({ version: r.version, released_at: r.released_at.slice(0, 10), download_url: r.download_url ?? '', changelog: r.changelog ?? '', is_prerelease: r.is_prerelease, is_published: r.is_published });
    setSaveErr(null); setEditing(r); setCreating(false);
  };
  const closeForm = () => { setCreating(false); setEditing(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaveErr(null); setSaving(true);
    const payload = { ...form, released_at: new Date(form.released_at).toISOString() };
    try {
      const res = await fetch(
        editing ? `${API}/api/admin/releases` : `${API}/api/admin/releases`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
        }
      );
      const d = await res.json() as { error?: string };
      if (!res.ok) { setSaveErr(d.error ?? 'Save failed.'); return; }
      closeForm(); load();
    } catch { setSaveErr('Network error.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this release? This cannot be undone.')) return;
    setDeleteId(id);
    try {
      await fetch(`${API}/api/admin/releases?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      load();
    } catch { setErr('Delete failed.'); }
    finally { setDeleteId(null); }
  };

  const togglePublish = async (r: Release) => {
    await fetch(`${API}/api/admin/releases`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: r.id, is_published: !r.is_published }),
    });
    load();
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50' as const;
  const inputStyle = { background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)' };

  const FormPanel = (
    <div className="glass-card p-6 mb-6">
      <h3 className="font-medium mb-4">{creating ? 'New Release' : `Edit v${editing?.version}`}</h3>
      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Version *</label>
            <input className={inputCls} style={inputStyle} placeholder="1.0.0" value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Release date *</label>
            <input type="date" className={inputCls} style={inputStyle} value={form.released_at}
              onChange={(e) => setForm((f) => ({ ...f, released_at: e.target.value }))} required />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Download URL (.dmg)</label>
          <input className={inputCls} style={inputStyle} placeholder="https://..." value={form.download_url ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, download_url: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Changelog (Markdown)</label>
          <textarea
            className={inputCls} style={{ ...inputStyle, resize: 'vertical' }}
            rows={10}
            placeholder={'## New Features\n- Added something great\n\n## Fixes\n- Fixed a bug'}
            value={form.changelog ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, changelog: e.target.value }))}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Use <code>## Heading</code>, <code>### Subheading</code>, and <code>- bullet</code> for formatting.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_prerelease} onChange={(e) => setForm((f) => ({ ...f, is_prerelease: e.target.checked }))} />
            <span style={{ color: 'var(--text-secondary)' }}>Pre-release</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))} />
            <span style={{ color: 'var(--text-secondary)' }}>Published (visible to users)</span>
          </label>
        </div>
        {saveErr && <p className="text-red-400 text-sm">{saveErr}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {saving ? 'Saving…' : (creating ? 'Publish Release' : 'Save Changes')}
          </button>
          <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Releases</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage app versions and changelogs shown on the download page.</p>
        </div>
        {!creating && !editing && (
          <button onClick={openCreate} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            + New Release
          </button>
        )}
      </div>

      {(creating || editing) && FormPanel}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : err ? (
        <p className="text-red-400 text-sm">{err}</p>
      ) : releases.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No releases yet. Click "New Release" to publish your first version.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map((r) => (
            <div key={r.id} className="glass-card px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>v{r.version}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(r.released_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    {r.is_prerelease && (
                      <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Pre-release</span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-xs" style={r.is_published
                      ? { background: 'rgba(52,211,153,0.15)', color: '#34d399' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                      {r.is_published ? 'Published' : 'Hidden'}
                    </span>
                  </div>
                  {r.download_url
                    ? <p className="text-xs mt-1 truncate max-w-sm" style={{ color: 'var(--text-muted)' }}>{r.download_url}</p>
                    : <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No download URL</p>
                  }
                  {r.changelog && (
                    <p className="text-xs mt-1 truncate max-w-sm" style={{ color: 'var(--text-muted)' }}>
                      {r.changelog.split('\n')[0].replace(/^#+\s*/, '')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => togglePublish(r)} className="px-2.5 py-1 rounded text-xs transition-colors"
                    style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                    {r.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => openEdit(r)} className="px-2.5 py-1 rounded text-xs transition-colors"
                    style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(r.id)} disabled={deleteId === r.id} className="px-2.5 py-1 rounded text-xs transition-colors disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                    {deleteId === r.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page Shell ────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'accounts' | 'bugs' | 'audit' | 'releases';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'accounts', label: 'Members' },
  { id: 'bugs', label: 'Bug Reports' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'releases', label: 'Releases' },
];

export function AdminPage() {
  const { user, session, loading: authLoading, signInWithPassword, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');

  useEffect(() => {
    if (!session?.access_token) return;
    void fetch(`${API}/api/admin/accounts`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => { if (r.status === 403) setForbidden(true); });
  }, [session?.access_token]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    const result = await signInWithPassword(email, password);
    if (result.error) setSignInError(result.error);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <div className="pt-32 flex justify-center"><p style={{ color: 'var(--text-muted)' }}>Loading…</p></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <div className="pt-32 px-6 max-w-md mx-auto">
          <h1 className="text-2xl font-semibold mb-2">Admin</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>Sign in with your admin credentials.</p>
          <form onSubmit={(e) => void handleSignIn(e)} className="glass-card p-6 flex flex-col gap-4">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium mb-2">Email</label>
              <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent" style={{ color: 'var(--text)' }} />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium mb-2">Password</label>
              <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent" style={{ color: 'var(--text)' }} />
            </div>
            {signInError && <p className="text-sm" style={{ color: '#f87171' }}>{signInError}</p>}
            <button type="submit" className="btn-accent w-full">Sign in</button>
          </form>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <div className="pt-32 px-6 max-w-md mx-auto text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }} aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{user.email} is not an admin account.</p>
          <button onClick={() => signOut()} className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>Sign out</button>
        </div>
      </div>
    );
  }

  const token = session?.access_token ?? '';

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="pt-24 px-6 max-w-7xl mx-auto pb-20">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Admin</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
          </div>
          <button onClick={() => signOut()} className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>Sign out</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-full overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: tab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: tab === t.id ? '0 0 0 1px rgba(255,255,255,0.12)' : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'dashboard' && <DashboardTab token={token} />}
        {tab === 'accounts' && (
          <AccountsTabErrorBoundary>
            <AccountsTab token={token} />
          </AccountsTabErrorBoundary>
        )}
        {tab === 'bugs' && <BugReportsTab token={token} />}
        {tab === 'audit' && <AuditLogTab token={token} />}
        {tab === 'releases' && <ReleasesTab token={token} />}
      </div>
    </div>
  );
}

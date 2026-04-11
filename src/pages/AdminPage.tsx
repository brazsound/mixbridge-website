import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Nav } from '@/components/Nav';

const API_URL = (import.meta.env.VITE_LICENSE_API_URL ?? '').replace(/\/$/, '');

// ── Types ─────────────────────────────────────────────────────────────────────

interface Account {
  email: string;
  auth_id: string;
  signed_up_at: string;
  license_type: 'none' | 'complimentary' | 'paid';
  status: string | null;
  tier: string | null;
  license_key: string | null;
  // complimentary only
  note?: string;
  activation_limit?: number;
  activations_used?: number;
  nfr_added_at?: string;
}

interface NfrUser {
  email: string;
  note: string;
  activation_limit: number;
  activations_used: number;
  added_at: string;
  license_key: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function apiRequest(token: string, path: string, method: string, body?: object) {
  return fetch(`${API_URL}/api/admin/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function LicenseBadge({ account }: { account: Account }) {
  if (account.license_type === 'paid') {
    const label = account.tier
      ? { solo: 'Solo', pro: 'Pro', team: 'Team' }[account.tier] ?? account.tier
      : 'Paid';
    const past = account.status === 'past_due';
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{
          background: past ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)',
          color: past ? '#ca8a04' : '#16a34a',
          border: `1px solid ${past ? 'rgba(234,179,8,0.25)' : 'rgba(34,197,94,0.25)'}`,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: past ? '#ca8a04' : '#16a34a' }} />
        {label}{past ? ' · Past due' : ''}
      </span>
    );
  }
  if (account.license_type === 'complimentary') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.25)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#7c3aed' }} />
        Complimentary
      </span>
    );
  }
  return (
    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
      No license
    </span>
  );
}

// ── Accounts tab ──────────────────────────────────────────────────────────────

function AccountsTab({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Grant license modal state
  const [grantEmail, setGrantEmail] = useState<string | null>(null);
  const [grantNote, setGrantNote] = useState('');
  const [grantLimit, setGrantLimit] = useState(3);
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  // Inline edit state (for complimentary accounts)
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editLimit, setEditLimit] = useState(3);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Revoke confirm
  const [revokeEmail, setRevokeEmail] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(token, 'accounts', 'GET');
      if (res.status === 403) { setError('Access denied.'); return; }
      const data = await res.json() as { accounts?: Account[]; error?: string };
      if (data.error) { setError(data.error); return; }
      setAccounts(data.accounts ?? []);
    } catch {
      setError('Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleGrant = async () => {
    if (!grantEmail) return;
    setGrantLoading(true);
    setGrantError(null);
    try {
      const res = await apiRequest(token, 'accounts', 'POST', {
        email: grantEmail,
        note: grantNote.trim() || undefined,
        activation_limit: grantLimit,
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setGrantError(data.error); return; }
      setGrantEmail(null);
      setGrantNote('');
      setGrantLimit(3);
      await load();
    } catch {
      setGrantError('Failed to grant license.');
    } finally {
      setGrantLoading(false);
    }
  };

  const startEdit = (a: Account) => {
    setEditingEmail(a.email);
    setEditNote(a.note ?? '');
    setEditLimit(a.activation_limit ?? 3);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingEmail) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await apiRequest(token, 'accounts', 'PATCH', {
        email: editingEmail,
        note: editNote,
        activation_limit: editLimit,
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setEditError(data.error); return; }
      setEditingEmail(null);
      await load();
    } catch {
      setEditError('Failed to save.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleRevoke = async (email: string) => {
    setRevokeLoading(true);
    try {
      await apiRequest(token, 'accounts', 'DELETE', { email });
      setRevokeEmail(null);
      await load();
    } finally {
      setRevokeLoading(false);
    }
  };

  const copyKey = (email: string, key: string) => {
    void navigator.clipboard.writeText(key);
    setCopiedKey(email);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filtered = accounts.filter((a) =>
    !search || a.email.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total: accounts.length,
    none: accounts.filter((a) => a.license_type === 'none').length,
    comp: accounts.filter((a) => a.license_type === 'complimentary').length,
    paid: accounts.filter((a) => a.license_type === 'paid').length,
  };

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total accounts', value: counts.total },
          { label: 'No license', value: counts.none },
          { label: 'Complimentary', value: counts.comp },
          { label: 'Paid', value: counts.paid },
        ].map((s) => (
          <div
            key={s.label}
            className="glass-card px-4 py-3"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + refresh */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          onClick={() => void load()}
          disabled={loading}
          className="text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {error && <div className="px-6 py-4 text-sm" style={{ color: '#f87171' }}>{error}</div>}

        {!loading && filtered.length === 0 && !error && (
          <div className="px-6 py-14 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No accounts match your search.' : 'No accounts found.'}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>License</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Key</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Devices</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Note</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Signed up</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const isEditing = editingEmail === a.email;
                  const isRevokeConfirm = revokeEmail === a.email;
                  return (
                    <tr
                      key={a.email}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Email */}
                      <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text)' }}>
                        {a.email}
                      </td>

                      {/* License badge */}
                      <td className="px-4 py-3.5">
                        <LicenseBadge account={a} />
                      </td>

                      {/* License key */}
                      <td className="px-4 py-3.5">
                        {a.license_key ? (
                          <div className="flex items-center gap-1.5">
                            <code className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                              {a.license_key}
                            </code>
                            <button
                              onClick={() => copyKey(a.email, a.license_key!)}
                              className="text-xs transition-colors hover:opacity-80"
                              style={{ color: 'var(--text-muted)' }}
                              title="Copy key"
                            >
                              {copiedKey === a.email ? '✓' : 'Copy'}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Devices */}
                      <td className="px-4 py-3.5 text-center" style={{ color: 'var(--text-secondary)' }}>
                        {a.license_type === 'complimentary' ? (
                          isEditing ? (
                            <input
                              type="number"
                              value={editLimit}
                              onChange={(e) => setEditLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              min={1}
                              max={100}
                              className="w-14 mx-auto px-2 py-1 rounded text-sm text-center block bg-black/30 border border-white/15 focus:outline-none focus:ring-2 focus:ring-accent"
                              style={{ color: 'var(--text)' }}
                            />
                          ) : (
                            <span className={(a.activations_used ?? 0) >= (a.activation_limit ?? 3) ? 'text-amber-400' : ''}>
                              {a.activations_used ?? 0} / {a.activation_limit ?? 3}
                            </span>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                        {a.license_type === 'complimentary' ? (
                          isEditing ? (
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              placeholder="Note"
                              className="w-full min-w-[120px] px-2 py-1 rounded text-sm bg-black/30 border border-white/15 focus:outline-none focus:ring-2 focus:ring-accent"
                              style={{ color: 'var(--text)' }}
                            />
                          ) : (
                            <span className={a.note ? '' : 'italic'} style={{ color: a.note ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                              {a.note || 'No note'}
                            </span>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Signed up */}
                      <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(a.signed_up_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-3">
                          {a.license_type === 'none' && (
                            <button
                              onClick={() => { setGrantEmail(a.email); setGrantNote(''); setGrantLimit(3); setGrantError(null); }}
                              className="text-xs font-medium transition-colors"
                              style={{ color: 'var(--accent)' }}
                            >
                              Grant license
                            </button>
                          )}
                          {a.license_type === 'complimentary' && (
                            isEditing ? (
                              <>
                                {editError && <span className="text-xs text-amber-400 mr-1">{editError}</span>}
                                <button
                                  onClick={() => void saveEdit()}
                                  disabled={editLoading}
                                  className="text-xs font-medium transition-colors disabled:opacity-40"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  {editLoading ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingEmail(null)}
                                  className="text-xs transition-colors"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : isRevokeConfirm ? (
                              <>
                                <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>Revoke license?</span>
                                <button
                                  onClick={() => void handleRevoke(a.email)}
                                  disabled={revokeLoading}
                                  className="text-xs font-medium transition-colors disabled:opacity-40"
                                  style={{ color: '#f87171' }}
                                >
                                  {revokeLoading ? 'Revoking…' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setRevokeEmail(null)}
                                  className="text-xs transition-colors"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  Keep
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(a)}
                                  className="text-xs transition-colors hover:opacity-80"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setRevokeEmail(a.email)}
                                  className="text-xs transition-colors"
                                  style={{ color: 'rgba(248,113,113,0.6)' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(248,113,113,0.6)')}
                                >
                                  Revoke
                                </button>
                              </>
                            )
                          )}
                          {a.license_type === 'paid' && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Paid</span>
                          )}
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

      {/* Grant license modal */}
      {grantEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setGrantEmail(null)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
            style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>Grant complimentary license</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>{grantEmail}</p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
                <input
                  type="text"
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  placeholder="e.g. Beta tester, Friend, etc."
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{ color: 'var(--text)' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Device limit</label>
                <input
                  type="number"
                  value={grantLimit}
                  onChange={(e) => setGrantLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  min={1}
                  max={100}
                  className="w-24 px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent text-center"
                  style={{ color: 'var(--text)' }}
                />
              </div>
            </div>

            {grantError && <p className="text-sm mt-3" style={{ color: '#fbbf24' }}>{grantError}</p>}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setGrantEmail(null)}
                className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleGrant()}
                disabled={grantLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {grantLoading ? 'Granting…' : 'Grant license'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Complimentary Licenses tab (original NFR section) ─────────────────────────

function NfrTab({ token }: { token: string }) {
  const [users, setUsers] = useState<NfrUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [addEmail, setAddEmail] = useState('');
  const [addNote, setAddNote] = useState('');
  const [addLimit, setAddLimit] = useState(3);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editState, setEditState] = useState<{ email: string; note: string; activation_limit: number } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setDataLoading(true);
    setLoadError(null);
    try {
      const res = await apiRequest(token, 'nfr', 'GET');
      if (res.status === 403) { setLoadError('Access denied.'); return; }
      const data = await res.json() as { users?: NfrUser[]; error?: string };
      if (data.error) { setLoadError(data.error); return; }
      setUsers(data.users ?? []);
    } catch {
      setLoadError('Failed to load users.');
    } finally {
      setDataLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await apiRequest(token, 'nfr', 'POST', {
        email: addEmail.trim(),
        note: addNote.trim() || undefined,
        activation_limit: addLimit,
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setAddError(data.error); return; }
      setAddEmail('');
      setAddNote('');
      setAddLimit(3);
      await loadUsers();
    } catch {
      setAddError('Failed to add user.');
    } finally {
      setAddLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editState) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await apiRequest(token, 'nfr', 'PATCH', {
        email: editState.email,
        note: editState.note,
        activation_limit: editState.activation_limit,
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setEditError(data.error); return; }
      setEditingEmail(null);
      setEditState(null);
      await loadUsers();
    } catch {
      setEditError('Failed to save changes.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (emailToDelete: string) => {
    setDeleteLoading(true);
    try {
      await apiRequest(token, 'nfr', 'DELETE', { email: emailToDelete });
      setConfirmDeleteEmail(null);
      await loadUsers();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      {/* Add form */}
      <div className="glass-card p-6 mb-6">
        <h2 className="font-medium mb-4" style={{ color: 'var(--text)' }}>Add complimentary license</h2>
        <form onSubmit={(e) => void handleAdd(e)} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder="email@example.com"
            required
            className="flex-1 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            style={{ color: 'var(--text)' }}
          />
          <input
            type="text"
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full sm:w-44 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            style={{ color: 'var(--text)' }}
          />
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Devices:</label>
            <input
              type="number"
              value={addLimit}
              onChange={(e) => setAddLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min={1}
              max={100}
              className="w-16 px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ color: 'var(--text)' }}
            />
          </div>
          <button type="submit" disabled={addLoading} className="btn-accent shrink-0" style={{ padding: '10px 20px', fontSize: '0.875rem' }}>
            {addLoading ? 'Adding…' : 'Add'}
          </button>
        </form>
        {addError && <p className="text-sm mt-3" style={{ color: '#fbbf24' }}>{addError}</p>}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-medium" style={{ color: 'var(--text)' }}>
            Complimentary licenses
            {users.length > 0 && <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>{users.length}</span>}
          </h2>
          <button
            onClick={() => void loadUsers()}
            disabled={dataLoading}
            className="text-sm transition-colors disabled:opacity-40"
            style={{ color: 'var(--text-muted)' }}
          >
            {dataLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {loadError && <div className="px-6 py-4 text-sm" style={{ color: '#fbbf24' }}>{loadError}</div>}

        {!dataLoading && users.length === 0 && !loadError && (
          <div className="px-6 py-14 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No complimentary licenses yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Add an email above, or use the Accounts tab to grant from an existing account.</p>
          </div>
        )}

        {users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Email', 'Note', 'Devices', 'License Key', 'Added', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-${i === 0 || i === 5 ? '6' : '4'} py-3 text-xs font-medium uppercase tracking-wider ${i === 2 ? 'text-center' : i === 5 ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isEditing = editingEmail === u.email;
                  const isConfirmDelete = confirmDeleteEmail === u.email;
                  return (
                    <tr
                      key={u.email}
                      className="hover:bg-white/[0.02] transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <td className="px-6 py-4 font-medium" style={{ color: 'var(--text)' }}>{u.email}</td>
                      <td className="px-4 py-4" style={{ color: 'var(--text-secondary)' }}>
                        {isEditing && editState ? (
                          <input
                            type="text"
                            value={editState.note}
                            onChange={(e) => setEditState({ ...editState, note: e.target.value })}
                            placeholder="Note"
                            className="w-full px-3 py-1.5 rounded-md bg-black/30 border border-white/15 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            style={{ color: 'var(--text)' }}
                          />
                        ) : (
                          <span className={u.note ? '' : 'italic'} style={{ color: u.note ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            {u.note || 'No note'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {isEditing && editState ? (
                          <input
                            type="number"
                            value={editState.activation_limit}
                            onChange={(e) => setEditState({ ...editState, activation_limit: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                            min={1}
                            max={100}
                            className="w-16 mx-auto px-2 py-1.5 rounded-md bg-black/30 border border-white/15 text-sm text-center block focus:outline-none focus:ring-2 focus:ring-accent"
                            style={{ color: 'var(--text)' }}
                          />
                        ) : (
                          <span className={u.activations_used >= u.activation_limit ? 'text-amber-400' : ''} style={{ color: u.activations_used >= u.activation_limit ? undefined : 'var(--text-secondary)' }}>
                            {u.activations_used} / {u.activation_limit}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                            {u.license_key || '—'}
                          </code>
                          {u.license_key && (
                            <button
                              onClick={() => {
                                void navigator.clipboard.writeText(u.license_key);
                                setCopiedKey(u.email);
                                setTimeout(() => setCopiedKey(null), 2000);
                              }}
                              className="text-xs transition-colors hover:opacity-80"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {copiedKey === u.email ? '✓' : 'Copy'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(u.added_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          {isEditing ? (
                            <>
                              {editError && <span className="text-xs mr-1" style={{ color: '#fbbf24' }}>{editError}</span>}
                              <button onClick={() => void saveEdit()} disabled={editLoading} className="text-xs font-medium transition-colors disabled:opacity-40" style={{ color: 'var(--accent)' }}>
                                {editLoading ? 'Saving…' : 'Save'}
                              </button>
                              <button onClick={() => { setEditingEmail(null); setEditState(null); }} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
                                Cancel
                              </button>
                            </>
                          ) : isConfirmDelete ? (
                            <>
                              <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>Remove?</span>
                              <button onClick={() => void handleDelete(u.email)} disabled={deleteLoading} className="text-xs font-medium transition-colors disabled:opacity-40" style={{ color: '#f87171' }}>
                                {deleteLoading ? 'Removing…' : 'Confirm'}
                              </button>
                              <button onClick={() => setConfirmDeleteEmail(null)} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
                                Keep
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingEmail(u.email); setEditState({ email: u.email, note: u.note, activation_limit: u.activation_limit }); setEditError(null); }} className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                                Edit
                              </button>
                              <button onClick={() => setConfirmDeleteEmail(u.email)} className="text-xs transition-colors" style={{ color: 'rgba(248,113,113,0.6)' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(248,113,113,0.6)')}>
                                Remove
                              </button>
                            </>
                          )}
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
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

type Tab = 'accounts' | 'licenses';

export function AdminPage() {
  const { user, session, loading: authLoading, signInWithPassword, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<Tab>('accounts');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    const result = await signInWithPassword(email, password);
    if (result.error) setSignInError(result.error);
  };

  // Check admin access once session loads
  useEffect(() => {
    if (!session?.access_token) return;
    void fetch(`${API_URL}/api/admin/nfr`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then((r) => { if (r.status === 403) setForbidden(true); });
  }, [session?.access_token]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="pt-32 flex justify-center">
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="pt-32 px-6 max-w-md mx-auto">
          <h1 className="text-2xl font-semibold mb-2">Admin</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>Sign in with your admin credentials.</p>
          <form onSubmit={(e) => void handleSignIn(e)} className="glass-card p-6 flex flex-col gap-4">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium mb-2">Email</label>
              <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ color: 'var(--text)' }} />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium mb-2">Password</label>
              <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ color: 'var(--text)' }} />
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
        <Nav />
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
      <Nav />
      <div className="pt-24 px-6 max-w-6xl mx-auto pb-20">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Admin</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
          </div>
          <button onClick={() => signOut()} className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
            Sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {([
            { id: 'accounts', label: 'All Accounts' },
            { id: 'licenses', label: 'Complimentary Licenses' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: tab === t.id ? '0 0 0 1px rgba(255,255,255,0.12)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'accounts' && <AccountsTab token={token} />}
        {tab === 'licenses' && <NfrTab token={token} />}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Nav } from '@/components/Nav';

const API_URL = import.meta.env.VITE_LICENSE_API_URL ?? '';

interface NfrUser {
  email: string;
  note: string;
  activation_limit: number;
  activations_used: number;
  added_at: string;
  license_key: string;
}

interface EditState {
  email: string;
  note: string;
  activation_limit: number;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function adminRequest(
  token: string,
  method: string,
  body?: object
): Promise<Response> {
  return fetch(`${API_URL.replace(/\/$/, '')}/api/admin/nfr`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function AdminPage() {
  const { user, session, loading: authLoading, signInWithPassword, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [users, setUsers] = useState<NfrUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // Add form
  const [addEmail, setAddEmail] = useState('');
  const [addNote, setAddNote] = useState('');
  const [addLimit, setAddLimit] = useState(3);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Inline edit
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadUsers = async () => {
    if (!session?.access_token) return;
    setDataLoading(true);
    setLoadError(null);
    try {
      const res = await adminRequest(session.access_token, 'GET');
      if (res.status === 403) { setForbidden(true); return; }
      const data = await res.json() as { users?: NfrUser[]; error?: string };
      if (data.error) { setLoadError(data.error); return; }
      setUsers(data.users ?? []);
    } catch {
      setLoadError('Failed to load NFR users.');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) loadUsers();
  }, [session?.access_token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !addEmail.trim()) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await adminRequest(session.access_token, 'POST', {
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

  const startEdit = (u: NfrUser) => {
    setEditingEmail(u.email);
    setEditState({ email: u.email, note: u.note, activation_limit: u.activation_limit });
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingEmail(null);
    setEditState(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!session?.access_token || !editState) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await adminRequest(session.access_token, 'PATCH', {
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
    if (!session?.access_token) return;
    setDeleteLoading(true);
    try {
      await adminRequest(session.access_token, 'DELETE', { email: emailToDelete });
      setConfirmDeleteEmail(null);
      await loadUsers();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    const result = await signInWithPassword(email, password);
    if (result.error) setSignInError(result.error);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="pt-32 flex justify-center">
          <p className="text-text-muted">Loading…</p>
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
        <p className="text-text-secondary mb-8">Sign in with your admin credentials.</p>
        <form onSubmit={handleSignIn} className="glass-card p-6 flex flex-col gap-4">
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium mb-2">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium mb-2">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          {signInError && <p className="text-red-400 text-sm">{signInError}</p>}
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
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
          <p className="text-text-secondary mb-6 text-sm">
            {user.email} is not an admin account.
          </p>
          <button onClick={() => signOut()} className="text-sm text-text-secondary hover:text-text transition-colors">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />
      <div className="pt-24 px-6 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">NFR Licenses</h1>
          <p className="text-text-muted text-sm mt-1">{user.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-sm text-text-secondary hover:text-text transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Add user */}
      <div className="glass-card p-6 mb-8">
        <h2 className="font-medium mb-4">Add NFR User</h2>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder="email@example.com"
            required
            className="flex-1 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          />
          <input
            type="text"
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full sm:w-48 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          />
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm text-text-muted whitespace-nowrap">Devices:</label>
            <input
              type="number"
              value={addLimit}
              onChange={(e) => setAddLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min={1}
              max={100}
              className="w-16 px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-text focus:outline-none focus:ring-2 focus:ring-accent text-sm text-center"
            />
          </div>
          <button
            type="submit"
            disabled={addLoading}
            className="btn-accent shrink-0"
            style={{ padding: '10px 20px', fontSize: '0.875rem' }}
          >
            {addLoading ? 'Adding…' : 'Add'}
          </button>
        </form>
        {addError && <p className="text-amber-400 text-sm mt-3">{addError}</p>}
      </div>

      {/* User table */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-medium">
            Users
            {users.length > 0 && (
              <span className="ml-2 text-text-muted text-sm font-normal">{users.length}</span>
            )}
          </h2>
          <button
            onClick={loadUsers}
            disabled={dataLoading}
            className="text-sm text-text-muted hover:text-text transition-colors disabled:opacity-40"
          >
            {dataLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {loadError && (
          <div className="px-6 py-4 text-amber-400 text-sm">{loadError}</div>
        )}

        {!dataLoading && users.length === 0 && !loadError && (
          <div className="px-6 py-14 text-center">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }} aria-hidden>
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <p className="text-text-muted text-sm">No NFR users yet.</p>
            <p className="text-text-muted text-xs mt-1">Add an email above to grant free access.</p>
          </div>
        )}

        {users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Note</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">Devices</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">License Key</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Added</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const isEditing = editingEmail === u.email;
                  const isConfirmDelete = confirmDeleteEmail === u.email;
                  return (
                    <tr key={u.email} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4 text-text font-medium">{u.email}</td>

                      {/* Note cell */}
                      <td className="px-4 py-4 text-text-secondary">
                        {isEditing && editState ? (
                          <input
                            type="text"
                            value={editState.note}
                            onChange={(e) => setEditState({ ...editState, note: e.target.value })}
                            placeholder="Note"
                            className="w-full px-3 py-1.5 rounded-md bg-black/30 border border-white/15 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                          />
                        ) : (
                          <span className={u.note ? '' : 'text-text-muted italic'}>
                            {u.note || 'No note'}
                          </span>
                        )}
                      </td>

                      {/* Device limit cell */}
                      <td className="px-4 py-4 text-center">
                        {isEditing && editState ? (
                          <input
                            type="number"
                            value={editState.activation_limit}
                            onChange={(e) => setEditState({ ...editState, activation_limit: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                            min={1}
                            max={100}
                            className="w-16 mx-auto px-2 py-1.5 rounded-md bg-black/30 border border-white/15 text-text focus:outline-none focus:ring-2 focus:ring-accent text-sm text-center block"
                          />
                        ) : (
                          <span className={u.activations_used >= u.activation_limit ? 'text-amber-400' : 'text-text-secondary'}>
                            {u.activations_used} / {u.activation_limit}
                          </span>
                        )}
                      </td>

                      {/* License key cell */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-text-secondary tracking-wider">
                            {u.license_key || '—'}
                          </code>
                          {u.license_key && (
                            <button
                              onClick={() => {
                                void navigator.clipboard.writeText(u.license_key);
                                setCopiedKey(u.email);
                                setTimeout(() => setCopiedKey(null), 2000);
                              }}
                              className="text-xs text-text-muted hover:text-text transition-colors"
                              title="Copy key"
                            >
                              {copiedKey === u.email ? '✓' : 'Copy'}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-text-muted">{formatDate(u.added_at)}</td>

                      {/* Actions cell */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          {isEditing ? (
                            <>
                              {editError && <span className="text-amber-400 text-xs mr-1">{editError}</span>}
                              <button
                                onClick={saveEdit}
                                disabled={editLoading}
                                className="text-xs font-medium text-accent hover:text-accent-hover transition-colors disabled:opacity-40"
                              >
                                {editLoading ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-xs text-text-muted hover:text-text transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : isConfirmDelete ? (
                            <>
                              <span className="text-xs text-text-muted mr-1">Remove {u.email}?</span>
                              <button
                                onClick={() => handleDelete(u.email)}
                                disabled={deleteLoading}
                                className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                              >
                                {deleteLoading ? 'Removing…' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteEmail(null)}
                                className="text-xs text-text-muted hover:text-text transition-colors"
                              >
                                Keep
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(u)}
                                className="text-xs text-text-muted hover:text-text transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmDeleteEmail(u.email)}
                                className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                              >
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
    </div>
  );
}

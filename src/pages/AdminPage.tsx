import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';

const API = (import.meta.env.VITE_LICENSE_API_URL ?? '').replace(/\/$/, '');

// ── Types ─────────────────────────────────────────────────────────────────────

interface Account {
  email: string;
  auth_id: string;
  signed_up_at: string;
  banned_until?: string | null;
  license_type: 'none' | 'complimentary' | 'paid';
  status: string | null;
  tier: string | null;
  license_key: string | null;
  note?: string;
  activation_limit?: number;
  activations_used?: number;
  nfr_added_at?: string;
}

interface Device {
  device_id: string;
  display_name: string | null;
  activated_at: string;
  source: 'complimentary' | 'paid';
}

interface NfrUser {
  email: string;
  note: string;
  activation_limit: number;
  activations_used: number;
  added_at: string;
  license_key: string;
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
  complimentary_licenses: number;
  paid_subscriptions: number;
  devices_activated_this_week: number;
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

function exportCSV(accounts: Account[]) {
  const header = 'Email,License Type,Tier,Status,Devices Used,Device Limit,Signed Up';
  const rows = accounts.map((a) =>
    [
      a.email,
      a.license_type,
      a.tier ?? '',
      a.status ?? '',
      a.activations_used ?? '',
      a.activation_limit ?? '',
      formatDate(a.signed_up_at),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mix-bridge-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared small components ───────────────────────────────────────────────────

function LicenseBadge({ account }: { account: Account }) {
  if (account.banned_until && new Date(account.banned_until) > new Date()) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.25)' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#dc2626' }} />
        Banned
      </span>
    );
  }
  if (account.license_type === 'paid') {
    const label = account.tier ? ({ solo: 'Solo', pro: 'Pro', team: 'Team' }[account.tier] ?? account.tier) : 'Paid';
    const past = account.status === 'past_due';
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: past ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)', color: past ? '#ca8a04' : '#16a34a', border: `1px solid ${past ? 'rgba(234,179,8,0.25)' : 'rgba(34,197,94,0.25)'}` }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: past ? '#ca8a04' : '#16a34a' }} />
        {label}{past ? ' · Past due' : ''}
      </span>
    );
  }
  if (account.license_type === 'complimentary') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.25)' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#7c3aed' }} />
        Complimentary
      </span>
    );
  }
  return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No license</span>;
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

function CopyModal({ link, onClose }: { link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Password Reset Link" subtitle="Copy and share this link with the user. It expires after 24 hours." onClose={onClose} />
      <div className="p-6">
        <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <code className="flex-1 text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>{link}</code>
        </div>
        <button
          onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </Modal>
  );
}

// ── Devices Modal ─────────────────────────────────────────────────────────────

function DevicesModal({ account, token, onClose }: { account: Account; token: string; onClose: () => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [wipingAll, setWipingAll] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiReq(token, 'user-actions', 'POST', { action: 'list_devices', email: account.email });
      const data = await res.json() as { devices?: Device[]; error?: string };
      if (data.error) { setError(data.error); return; }
      setDevices(data.devices ?? []);
    } catch {
      setError('Failed to load devices.');
    } finally {
      setLoading(false);
    }
  }, [token, account.email]);

  useEffect(() => { void load(); }, [load]);

  const deactivate = async (d: Device) => {
    setDeactivating(d.device_id);
    await apiReq(token, 'user-actions', 'POST', { action: 'deactivate_device', email: account.email, device_id: d.device_id, source: d.source });
    setDeactivating(null);
    await load();
  };

  const wipeAll = async () => {
    setWipingAll(true);
    await apiReq(token, 'user-actions', 'POST', { action: 'deactivate_all_devices', email: account.email });
    setWipingAll(false);
    setConfirmWipe(false);
    await load();
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Activated Devices" subtitle={account.email} onClose={onClose} />
      <div className="p-6">
        {loading && <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
        {error && <p className="text-sm" style={{ color: '#fbbf24' }}>{error}</p>}
        {!loading && devices.length === 0 && !error && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No activated devices.</p>
        )}
        {devices.length > 0 && (
          <div className="flex flex-col gap-2 mb-5">
            {devices.map((d) => (
              <div key={d.device_id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                    {d.display_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unnamed device</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {d.source === 'paid' ? 'Paid' : 'Complimentary'} · Activated {formatDate(d.activated_at)}
                  </p>
                </div>
                <button
                  onClick={() => void deactivate(d)}
                  disabled={deactivating === d.device_id}
                  className="text-xs shrink-0 transition-colors disabled:opacity-40"
                  style={{ color: '#f87171' }}>
                  {deactivating === d.device_id ? 'Removing…' : 'Deactivate'}
                </button>
              </div>
            ))}
          </div>
        )}
        {devices.length > 0 && (
          confirmWipe ? (
            <div className="flex items-center gap-3">
              <span className="text-sm flex-1" style={{ color: 'var(--text-muted)' }}>Remove all {devices.length} devices?</span>
              <button onClick={() => void wipeAll()} disabled={wipingAll} className="text-xs font-medium transition-colors disabled:opacity-40" style={{ color: '#f87171' }}>
                {wipingAll ? 'Removing…' : 'Confirm'}
              </button>
              <button onClick={() => setConfirmWipe(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmWipe(true)} className="w-full py-2.5 rounded-xl text-sm transition-colors"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              Deactivate all devices
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

// ── License Actions Modal ─────────────────────────────────────────────────────

function LicenseModal({ account, token, onClose, onRefresh }: { account: Account; token: string; onClose: () => void; onRefresh: () => void }) {
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [transferEmail, setTransferEmail] = useState('');
  const [transferConfirm, setTransferConfirm] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [limitValue, setLimitValue] = useState(account.activation_limit ?? 3);
  const [limitLoading, setLimitLoading] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [limitSaved, setLimitSaved] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const regenKey = async () => {
    setRegenLoading(true);
    setError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', { action: 'regenerate_key', email: account.email, license_type: account.license_type });
      const data = await res.json() as { ok?: boolean; new_key?: string; error?: string };
      if (data.error) { setError(data.error); return; }
      setNewKey(data.new_key ?? null);
      setRegenConfirm(false);
      onRefresh();
    } finally {
      setRegenLoading(false);
    }
  };

  const transferLicense = async () => {
    setTransferLoading(true);
    setTransferError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', { action: 'transfer_license', email: account.email, new_email: transferEmail.trim().toLowerCase() });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setTransferError(data.error); return; }
      onRefresh();
      onClose();
    } finally {
      setTransferLoading(false);
    }
  };

  const saveLimit = async () => {
    setLimitLoading(true);
    setLimitError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', { action: 'override_device_limit', email: account.email, limit: limitValue, license_type: account.license_type });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setLimitError(data.error); return; }
      setLimitSaved(true);
      setTimeout(() => setLimitSaved(false), 2000);
      onRefresh();
    } finally {
      setLimitLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="License Actions" subtitle={account.email} onClose={onClose} />
      <div className="p-6 flex flex-col gap-5">
        {error && <p className="text-sm" style={{ color: '#fbbf24' }}>{error}</p>}

        {/* New key display */}
        {newKey && (
          <div className="p-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="text-xs mb-2" style={{ color: '#16a34a' }}>New license key generated</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono font-semibold" style={{ color: 'var(--text)' }}>{newKey}</code>
              <button onClick={() => { void navigator.clipboard.writeText(newKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }}
                className="text-xs" style={{ color: 'var(--text-muted)' }}>{copiedKey ? '✓' : 'Copy'}</button>
            </div>
          </div>
        )}

        {/* Regenerate key */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Regenerate license key</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Issues a new key. The old key stops working immediately.</p>
          {regenConfirm ? (
            <div className="flex gap-2">
              <button onClick={() => void regenKey()} disabled={regenLoading}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                {regenLoading ? 'Generating…' : 'Yes, regenerate'}
              </button>
              <button onClick={() => setRegenConfirm(false)} className="flex-1 py-2 rounded-lg text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setRegenConfirm(true)}
              className="w-full py-2 rounded-lg text-sm transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Regenerate key
            </button>
          )}
        </div>

        {/* Override device limit */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Device limit</p>
          <div className="flex items-center gap-2">
            <input type="number" value={limitValue} onChange={(e) => setLimitValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min={1} max={100}
              className="w-20 px-3 py-2 rounded-lg text-sm text-center bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ color: 'var(--text)' }} />
            <button onClick={() => void saveLimit()} disabled={limitLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {limitLoading ? 'Saving…' : limitSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
          {limitError && <p className="text-xs" style={{ color: '#fbbf24' }}>{limitError}</p>}
        </div>

        {/* Transfer license (complimentary only) */}
        {account.license_type === 'complimentary' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Transfer to new email</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Moves the license and all activations to a different email.</p>
            <input type="email" value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)}
              placeholder="new@example.com"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ color: 'var(--text)' }} />
            {transferError && <p className="text-xs" style={{ color: '#fbbf24' }}>{transferError}</p>}
            {transferConfirm ? (
              <div className="flex gap-2">
                <button onClick={() => void transferLicense()} disabled={transferLoading}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {transferLoading ? 'Transferring…' : 'Confirm transfer'}
                </button>
                <button onClick={() => setTransferConfirm(false)} className="flex-1 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setTransferConfirm(true)} disabled={!transferEmail.trim()}
                className="w-full py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Transfer
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Email Compose Modal ───────────────────────────────────────────────────────

function EmailModal({ to, token, onClose }: { to: string; token: string; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!subject.trim() || !text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiReq(token, 'email', 'POST', { action: 'send_custom', to, subject, text });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setError(data.error); return; }
      setSent(true);
      setTimeout(onClose, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Send Email" subtitle={to} onClose={onClose} />
      <div className="p-6 flex flex-col gap-4">
        {sent ? (
          <p className="text-sm text-center py-4" style={{ color: '#16a34a' }}>Email sent.</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line"
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ color: 'var(--text)' }} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Message</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Your message…" rows={6}
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                style={{ color: 'var(--text)' }} />
            </div>
            {error && <p className="text-sm" style={{ color: '#fbbf24' }}>{error}</p>}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancel
              </button>
              <button onClick={() => void send()} disabled={loading || !subject.trim() || !text.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {loading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Row Actions Dropdown ──────────────────────────────────────────────────────

function ActionsMenu({
  account, token, onRefresh, onOpenDevices, onOpenLicense, onOpenEmail, onOpenReset, onOpenGrant,
}: {
  account: Account;
  token: string;
  onRefresh: () => void;
  onOpenDevices: () => void;
  onOpenLicense: () => void;
  onOpenEmail: () => void;
  onOpenReset: () => void;
  onOpenGrant: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteFinal, setConfirmDeleteFinal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideBtn = btnRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideBtn && !insideMenu) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  };

  const deleteUser = async () => {
    setDeleteLoading(true);
    await apiReq(token, 'user-actions', 'POST', { action: 'delete_user', auth_id: account.auth_id, email: account.email });
    setDeleteLoading(false);
    setConfirmDelete(false);
    setConfirmDeleteFinal(false);
    setOpen(false);
    onRefresh();
  };

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); setOpen(false); }}
      className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/[0.06] rounded-lg"
      style={{ color: danger ? '#f87171' : 'var(--text-secondary)' }}>
      {label}
    </button>
  );

  return (
    <div>
      {/* Final confirmation modal */}
      {confirmDeleteFinal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full mx-auto" style={{ background: 'rgba(248,113,113,0.12)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </div>
            <h3 className="text-center text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>This cannot be undone</h3>
            <p className="text-center text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              You are permanently deleting:
            </p>
            <p className="text-center text-sm font-medium mb-5 px-2 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', wordBreak: 'break-all' }}>
              {account.email}
            </p>
            <p className="text-center text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
              Their account, auth credentials, and all activations will be removed from the system.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmDeleteFinal(false); setConfirmDelete(false); }}
                className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancel
              </button>
              <button
                onClick={() => void deleteUser()} disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: '#ef4444', color: '#fff' }}>
                {deleteLoading ? 'Deleting…' : 'Yes, delete permanently'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDelete && !confirmDeleteFinal ? (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Delete account?</span>
          <button onClick={() => setConfirmDeleteFinal(true)}
            className="text-xs font-medium transition-colors" style={{ color: '#f87171' }}>
            Confirm
          </button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
        </div>
      ) : (!confirmDeleteFinal && (
        <>
          <button
            ref={btnRef}
            onClick={openMenu}
            className="px-2 py-1 rounded-lg text-sm transition-colors hover:bg-white/[0.06]"
            style={{ color: 'var(--text-muted)' }}>
            ···
          </button>
          {open && menuPos && createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] w-44 rounded-xl p-1 shadow-2xl"
              style={{
                top: menuPos.top,
                right: menuPos.right,
                background: 'var(--bg)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
              {account.license_type === 'none' && item('Grant license', onOpenGrant)}
              {item('Send reset link', onOpenReset)}
              {item('Devices', onOpenDevices)}
              {(account.license_type === 'complimentary' || account.license_type === 'paid') && item('License actions', onOpenLicense)}
              {item('Send email', onOpenEmail)}
              {account.license_type !== 'paid' && item('Delete account', () => setConfirmDelete(true), true)}
            </div>,
            document.body
          )}
        </>
      ))}
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ token, accountsTotal, noLicense, complimentary, paid }: {
  token: string;
  accountsTotal: number;
  noLicense: number;
  complimentary: number;
  paid: number;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLog, setRecentLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [statsRes, logRes] = await Promise.all([
        apiReq(token, 'stats', 'GET'),
        fetch(`${API}/api/admin/audit-log?per_page=10`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json() as Stats);
      if (logRes.ok) {
        const d = await logRes.json() as { entries?: AuditEntry[] };
        setRecentLog(d.entries ?? []);
      }
      setLoading(false);
    };
    void load();
  }, [token]);

  const cards = [
    { label: 'Total accounts', value: accountsTotal },
    { label: 'No license', value: noLicense },
    { label: 'Complimentary', value: complimentary },
    { label: 'Paid', value: paid },
    { label: 'Devices (this week)', value: stats?.devices_activated_this_week ?? '-' },
    { label: 'Open bug reports', value: stats?.open_bug_reports ?? '-' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="glass-card px-4 py-3" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{c.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-medium" style={{ color: 'var(--text)' }}>Recent activity</h2>
        </div>
        {loading ? (
          <p className="px-6 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : recentLog.length === 0 ? (
          <p className="px-6 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No activity yet.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {recentLog.map((e) => (
              <div key={e.id} className="px-6 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{e.action.replace(/_/g, ' ')}</span>
                  {e.target_email && <span className="text-sm ml-2" style={{ color: 'var(--text-muted)' }}>→ {e.target_email}</span>}
                </div>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{e.admin_email}</span>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{formatDateTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── All Accounts Tab ──────────────────────────────────────────────────────────

function AccountsTab({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'none' | 'complimentary' | 'paid'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals
  const [devicesAccount, setDevicesAccount] = useState<Account | null>(null);
  const [licenseAccount, setLicenseAccount] = useState<Account | null>(null);
  const [emailAccount, setEmailAccount] = useState<Account | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState<string | null>(null);
  const [grantAccount, setGrantAccount] = useState<Account | null>(null);

  // Invite modal
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // Grant modal
  const [grantNote, setGrantNote] = useState('');
  const [grantLimit, setGrantLimit] = useState(3);
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  // Broadcast
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastFilter, setBroadcastFilter] = useState<'all' | 'none' | 'complimentary' | 'paid'>('all');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastConfirm, setBroadcastConfirm] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

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
      setError('Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const sendReset = async (a: Account) => {
    setResetLoading(a.email);
    try {
      const res = await apiReq(token, 'user-actions', 'POST', { action: 'reset_password', email: a.email });
      const data = await res.json() as { ok?: boolean; link?: string; error?: string };
      if (data.link) setResetLink(data.link);
    } finally {
      setResetLoading(null);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const res = await apiReq(token, 'user-actions', 'POST', { action: 'invite', email: inviteEmail.trim() });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setInviteError(data.error); return; }
      setInviteSent(true);
      setInviteEmail('');
      setTimeout(() => { setInviteSent(false); setShowInvite(false); }, 2000);
      await load();
    } finally {
      setInviteLoading(false);
    }
  };

  const sendGrant = async () => {
    if (!grantAccount) return;
    setGrantLoading(true);
    setGrantError(null);
    try {
      const res = await apiReq(token, 'accounts', 'POST', { email: grantAccount.email, note: grantNote.trim() || undefined, activation_limit: grantLimit });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setGrantError(data.error); return; }
      setGrantAccount(null);
      setGrantNote('');
      setGrantLimit(3);
      await load();
    } finally {
      setGrantLoading(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastText.trim()) return;
    setBroadcastLoading(true);
    setBroadcastError(null);
    try {
      const res = await apiReq(token, 'email', 'POST', { action: 'broadcast', filter: broadcastFilter, subject: broadcastSubject, text: broadcastText });
      const data = await res.json() as { ok?: boolean; sent?: number; error?: string };
      if (data.error) { setBroadcastError(data.error); return; }
      setBroadcastResult(`Sent to ${data.sent ?? 0} users.`);
      setBroadcastConfirm(false);
      setBroadcastSubject('');
      setBroadcastText('');
      setTimeout(() => setBroadcastResult(null), 4000);
    } finally {
      setBroadcastLoading(false);
    }
  };

  const filtered = accounts.filter((a) => {
    if (filter !== 'all' && a.license_type !== filter) return false;
    if (search && !a.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const recipientCount = accounts.filter((a) => broadcastFilter === 'all' || a.license_type === broadcastFilter).length;

  const counts = {
    total: accounts.length,
    none: accounts.filter((a) => a.license_type === 'none').length,
    comp: accounts.filter((a) => a.license_type === 'complimentary').length,
    paid: accounts.filter((a) => a.license_type === 'paid').length,
  };

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[{ label: 'Total', value: counts.total }, { label: 'No license', value: counts.none }, { label: 'Complimentary', value: counts.comp }, { label: 'Paid', value: counts.paid }].map((s) => (
          <div key={s.label} className="glass-card px-4 py-3" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => { setShowInvite(true); setInviteSent(false); setInviteError(null); setInviteEmail(''); }}
          className="btn-accent shrink-0" style={{ padding: '9px 16px', fontSize: '0.875rem' }}>
          + Create account
        </button>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email…"
          className="flex-1 min-w-[160px] px-4 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ color: 'var(--text)' }} />
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {(['all', 'none', 'complimentary', 'paid'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
              style={{ background: filter === f ? 'rgba(255,255,255,0.1)' : 'transparent', color: filter === f ? 'var(--text)' : 'var(--text-muted)' }}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => exportCSV(accounts)} className="text-sm px-3 py-2.5 rounded-lg transition-colors shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
          Export CSV
        </button>
        <button onClick={() => void load()} disabled={loading} className="text-sm px-3 py-2.5 rounded-lg transition-colors shrink-0 disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button onClick={() => setShowBroadcast((v) => !v)} className="text-sm px-3 py-2.5 rounded-lg transition-colors shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
          Broadcast email
        </button>
      </div>

      {/* Broadcast section */}
      {showBroadcast && (
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-sm" style={{ color: 'var(--text)' }}>Broadcast Email</h3>
            <button onClick={() => setShowBroadcast(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>
          <div className="flex flex-wrap gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['all', 'none', 'complimentary', 'paid'] as const).map((f) => (
              <button key={f} onClick={() => setBroadcastFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                style={{ background: broadcastFilter === f ? 'rgba(255,255,255,0.1)' : 'transparent', color: broadcastFilter === f ? 'var(--text)' : 'var(--text-muted)' }}>
                {f}
              </button>
            ))}
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Sending to <strong style={{ color: 'var(--text)' }}>{recipientCount}</strong> users</p>
          <div className="flex flex-col gap-3">
            <input type="text" value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} placeholder="Subject"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
              style={{ color: 'var(--text)' }} />
            <textarea value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)} placeholder="Message…" rows={4} resize-none
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              style={{ color: 'var(--text)' }} />
          </div>
          {broadcastError && <p className="text-sm mt-3" style={{ color: '#fbbf24' }}>{broadcastError}</p>}
          {broadcastResult && <p className="text-sm mt-3" style={{ color: '#16a34a' }}>{broadcastResult}</p>}
          <div className="mt-4">
            {broadcastConfirm ? (
              <div className="flex items-center gap-3">
                <span className="text-sm flex-1" style={{ color: 'var(--text-muted)' }}>Send to {recipientCount} users?</span>
                <button onClick={() => void sendBroadcast()} disabled={broadcastLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {broadcastLoading ? 'Sending…' : 'Confirm send'}
                </button>
                <button onClick={() => setBroadcastConfirm(false)} className="text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setBroadcastConfirm(true)} disabled={!broadcastSubject.trim() || !broadcastText.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                Send broadcast
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {error && <div className="px-6 py-4 text-sm" style={{ color: '#f87171' }}>{error}</div>}
        {!loading && filtered.length === 0 && !error && (
          <div className="px-6 py-14 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{search || filter !== 'all' ? 'No accounts match.' : 'No accounts found.'}</p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Email', 'License', 'Key', 'Devices', 'Signed up', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-${i === 0 || i === 5 ? '5' : '4'} py-3 text-left text-xs font-medium uppercase tracking-wider`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.email} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text)' }}>{a.email}</td>
                    <td className="px-4 py-3.5"><LicenseBadge account={a} /></td>
                    <td className="px-4 py-3.5">
                      {a.license_key ? (
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>{a.license_key}</code>
                          <button onClick={() => { void navigator.clipboard.writeText(a.license_key!); setCopiedKey(a.email); setTimeout(() => setCopiedKey(null), 2000); }}
                            className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                            {copiedKey === a.email ? '✓' : 'Copy'}
                          </button>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center" style={{ color: 'var(--text-secondary)' }}>
                      {a.license_type !== 'none'
                        ? <span className={(a.activations_used ?? 0) >= (a.activation_limit ?? 999) ? 'text-amber-400' : ''}>{a.activations_used ?? 0} / {a.activation_limit ?? '-'}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(a.signed_up_at)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        {resetLoading === a.email && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>…</span>}
                        <ActionsMenu
                          account={a}
                          token={token}
                          onRefresh={() => void load()}
                          onOpenDevices={() => setDevicesAccount(a)}
                          onOpenLicense={() => setLicenseAccount(a)}
                          onOpenEmail={() => setEmailAccount(a)}
                          onOpenReset={() => void sendReset(a)}
                          onOpenGrant={() => { setGrantAccount(a); setGrantNote(''); setGrantLimit(3); setGrantError(null); }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <Modal onClose={() => setShowInvite(false)}>
          <ModalHeader title="Create Account" subtitle="An invite email will be sent so the user can set their password." onClose={() => setShowInvite(false)} />
          <div className="p-6">
            {inviteSent ? (
              <p className="text-sm text-center py-4" style={{ color: '#16a34a' }}>Invite sent!</p>
            ) : (
              <div className="flex flex-col gap-4">
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com" autoFocus
                  className="w-full px-4 py-3 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{ color: 'var(--text)' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void sendInvite(); }} />
                {inviteError && <p className="text-sm" style={{ color: '#fbbf24' }}>{inviteError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    Cancel
                  </button>
                  <button onClick={() => void sendInvite()} disabled={inviteLoading || !inviteEmail.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {inviteLoading ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Grant license modal */}
      {grantAccount && (
        <Modal onClose={() => setGrantAccount(null)}>
          <ModalHeader title="Grant Complimentary License" subtitle={grantAccount.email} onClose={() => setGrantAccount(null)} />
          <div className="p-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
              <input type="text" value={grantNote} onChange={(e) => setGrantNote(e.target.value)} placeholder="e.g. Beta tester"
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ color: 'var(--text)' }} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Device limit</label>
              <input type="number" value={grantLimit} onChange={(e) => setGrantLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                min={1} max={100}
                className="w-24 px-3 py-2.5 rounded-lg text-sm text-center bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ color: 'var(--text)' }} />
            </div>
            {grantError && <p className="text-sm" style={{ color: '#fbbf24' }}>{grantError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setGrantAccount(null)} className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancel
              </button>
              <button onClick={() => void sendGrant()} disabled={grantLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {grantLoading ? 'Granting…' : 'Grant license'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modals */}
      {devicesAccount && <DevicesModal account={devicesAccount} token={token} onClose={() => setDevicesAccount(null)} />}
      {licenseAccount && <LicenseModal account={licenseAccount} token={token} onClose={() => setLicenseAccount(null)} onRefresh={() => void load()} />}
      {emailAccount && <EmailModal to={emailAccount.email} token={token} onClose={() => setEmailAccount(null)} />}
      {resetLink && <CopyModal link={resetLink} onClose={() => setResetLink(null)} />}
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

// ── Complimentary Licenses Tab ────────────────────────────────────────────────

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
      const res = await apiReq(token, 'nfr', 'GET');
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
      const res = await apiReq(token, 'nfr', 'POST', { email: addEmail.trim(), note: addNote.trim() || undefined, activation_limit: addLimit });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setAddError(data.error); return; }
      setAddEmail(''); setAddNote(''); setAddLimit(3);
      await loadUsers();
    } catch { setAddError('Failed to add user.'); }
    finally { setAddLoading(false); }
  };

  const saveEdit = async () => {
    if (!editState) return;
    setEditLoading(true); setEditError(null);
    try {
      const res = await apiReq(token, 'nfr', 'PATCH', { email: editState.email, note: editState.note, activation_limit: editState.activation_limit });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setEditError(data.error); return; }
      setEditingEmail(null); setEditState(null);
      await loadUsers();
    } catch { setEditError('Failed to save changes.'); }
    finally { setEditLoading(false); }
  };

  const handleDelete = async (emailToDelete: string) => {
    setDeleteLoading(true);
    try {
      await apiReq(token, 'nfr', 'DELETE', { email: emailToDelete });
      setConfirmDeleteEmail(null);
      await loadUsers();
    } finally { setDeleteLoading(false); }
  };

  return (
    <div>
      <div className="glass-card p-6 mb-6">
        <h2 className="font-medium mb-4" style={{ color: 'var(--text)' }}>Add complimentary license</h2>
        <form onSubmit={(e) => void handleAdd(e)} className="flex flex-col sm:flex-row gap-3">
          <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="email@example.com" required
            className="flex-1 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent" style={{ color: 'var(--text)' }} />
          <input type="text" value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="Note (optional)"
            className="w-full sm:w-44 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent" style={{ color: 'var(--text)' }} />
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Devices:</label>
            <input type="number" value={addLimit} onChange={(e) => setAddLimit(Math.max(1, parseInt(e.target.value, 10) || 1))} min={1} max={100}
              className="w-16 px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent" style={{ color: 'var(--text)' }} />
          </div>
          <button type="submit" disabled={addLoading} className="btn-accent shrink-0" style={{ padding: '10px 20px', fontSize: '0.875rem' }}>
            {addLoading ? 'Adding…' : 'Add'}
          </button>
        </form>
        {addError && <p className="text-sm mt-3" style={{ color: '#fbbf24' }}>{addError}</p>}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-medium" style={{ color: 'var(--text)' }}>
            Complimentary licenses
            {users.length > 0 && <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>{users.length}</span>}
          </h2>
          <button onClick={() => void loadUsers()} disabled={dataLoading} className="text-sm transition-colors disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>
            {dataLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {loadError && <div className="px-6 py-4 text-sm" style={{ color: '#fbbf24' }}>{loadError}</div>}

        {!dataLoading && users.length === 0 && !loadError && (
          <div className="px-6 py-14 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No complimentary licenses yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Add an email above or use All Accounts to grant from an existing account.</p>
          </div>
        )}

        {users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Email', 'Note', 'Devices', 'License Key', 'Added', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-${i === 0 || i === 5 ? '6' : '4'} py-3 text-xs font-medium uppercase tracking-wider ${i === 2 ? 'text-center' : i === 5 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isEditing = editingEmail === u.email;
                  const isConfirmDelete = confirmDeleteEmail === u.email;
                  return (
                    <tr key={u.email} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-6 py-4 font-medium" style={{ color: 'var(--text)' }}>{u.email}</td>
                      <td className="px-4 py-4" style={{ color: 'var(--text-secondary)' }}>
                        {isEditing && editState ? (
                          <input type="text" value={editState.note} onChange={(e) => setEditState({ ...editState, note: e.target.value })} placeholder="Note"
                            className="w-full px-3 py-1.5 rounded-md bg-black/30 border border-white/15 text-sm focus:outline-none focus:ring-2 focus:ring-accent" style={{ color: 'var(--text)' }} />
                        ) : (
                          <span className={u.note ? '' : 'italic'} style={{ color: u.note ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{u.note || 'No note'}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {isEditing && editState ? (
                          <input type="number" value={editState.activation_limit} onChange={(e) => setEditState({ ...editState, activation_limit: Math.max(1, parseInt(e.target.value, 10) || 1) })} min={1} max={100}
                            className="w-16 mx-auto px-2 py-1.5 rounded-md bg-black/30 border border-white/15 text-sm text-center block focus:outline-none focus:ring-2 focus:ring-accent" style={{ color: 'var(--text)' }} />
                        ) : (
                          <span className={u.activations_used >= u.activation_limit ? 'text-amber-400' : ''} style={{ color: u.activations_used >= u.activation_limit ? undefined : 'var(--text-secondary)' }}>
                            {u.activations_used} / {u.activation_limit}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>{u.license_key || '-'}</code>
                          {u.license_key && (
                            <button onClick={() => { void navigator.clipboard.writeText(u.license_key); setCopiedKey(u.email); setTimeout(() => setCopiedKey(null), 2000); }}
                              className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
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
                              <button onClick={() => { setEditingEmail(null); setEditState(null); }} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                            </>
                          ) : isConfirmDelete ? (
                            <>
                              <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>Remove?</span>
                              <button onClick={() => void handleDelete(u.email)} disabled={deleteLoading} className="text-xs font-medium transition-colors disabled:opacity-40" style={{ color: '#f87171' }}>
                                {deleteLoading ? 'Removing…' : 'Confirm'}
                              </button>
                              <button onClick={() => setConfirmDeleteEmail(null)} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>Keep</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingEmail(u.email); setEditState({ email: u.email, note: u.note, activation_limit: u.activation_limit }); setEditError(null); }}
                                className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>Edit</button>
                              <button onClick={() => setConfirmDeleteEmail(u.email)} className="text-xs transition-colors"
                                style={{ color: 'rgba(248,113,113,0.6)' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(248,113,113,0.6)')}>
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

type Tab = 'dashboard' | 'accounts' | 'bugs' | 'audit' | 'licenses' | 'releases';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'accounts', label: 'All Accounts' },
  { id: 'bugs', label: 'Bug Reports' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'licenses', label: 'Complimentary Licenses' },
  { id: 'releases', label: 'Releases' },
];

export function AdminPage() {
  const { user, session, loading: authLoading, signInWithPassword, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');

  const [accountCounts, setAccountCounts] = useState({ total: 0, none: 0, comp: 0, paid: 0 });

  useEffect(() => {
    if (!session?.access_token) return;
    void fetch(`${API}/api/admin/nfr`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => { if (r.status === 403) setForbidden(true); });
    void fetch(`${API}/api/admin/accounts`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { accounts?: Account[] } | null) => {
        if (!d?.accounts) return;
        const counts = { total: d.accounts.length, none: 0, comp: 0, paid: 0 };
        for (const a of d.accounts) {
          if (a.license_type === 'none') counts.none++;
          else if (a.license_type === 'complimentary') counts.comp++;
          else if (a.license_type === 'paid') counts.paid++;
        }
        setAccountCounts(counts);
      });
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
        {tab === 'dashboard' && (
          <DashboardTab
            token={token}
            accountsTotal={accountCounts.total}
            noLicense={accountCounts.none}
            complimentary={accountCounts.comp}
            paid={accountCounts.paid}
          />
        )}
        {tab === 'accounts' && (
          <AccountsTab
            token={token}
            key="accounts"
          />
        )}
        {tab === 'bugs' && <BugReportsTab token={token} />}
        {tab === 'audit' && <AuditLogTab token={token} />}
        {tab === 'licenses' && <NfrTab token={token} />}
        {tab === 'releases' && <ReleasesTab token={token} />}
      </div>
    </div>
  );
}

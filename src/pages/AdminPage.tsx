import { Component, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';

const API = (import.meta.env.VITE_LICENSE_API_URL ?? '').replace(/\/$/, '');

// ── Types ─────────────────────────────────────────────────────────────────────

interface Account {
  email: string;
  auth_id: string | null;
  signed_up_at: string;
  banned_until?: string | null;
  license_type: 'none' | 'complimentary' | 'paid' | 'trial_active' | 'trial_expired';
  status: string | null;
  license_version: number | null;
  license_key: string | null;
  note?: string;
  activation_limit?: number;
  activations_used?: number;
  nfr_added_at?: string;
  trial_started_at?: string;
  trial_ends_at?: string;
  purchase_type?: 'full' | 'subscription' | 'rent_to_own' | null;
  paddle_subscription_id?: string | null;
}

interface Device {
  device_id: string;
  display_name: string | null;
  activated_at: string;
  source: 'complimentary' | 'paid' | 'trial';
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

function isTrialPlan(t: Account['license_type']): boolean {
  return t === 'trial_active' || t === 'trial_expired';
}

function hasKeyedLicensePlan(t: Account['license_type']): boolean {
  return t === 'paid' || t === 'complimentary';
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
  paid_licenses: number;
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
  const header = 'Email,License Type,Version,Status,Devices Used,Device Limit,Signed Up';
  const rows = accounts.map((a) =>
    [
      a.email,
      a.license_type,
      a.license_version != null ? `V${a.license_version}` : '',
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

/** Stable ordering even when API returns an unexpected license_type. */
function planSortRank(lt: Account['license_type'] | undefined): number {
  switch (lt) {
    case 'paid':
      return 0;
    case 'complimentary':
      return 1;
    case 'trial_active':
      return 2;
    case 'trial_expired':
      return 3;
    case 'none':
      return 4;
    default:
      return 99;
  }
}

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
  const plan = account.license_type ?? 'none';
  if (plan === 'trial_active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(56,189,248,0.12)', color: '#0284c7', border: '1px solid rgba(56,189,248,0.25)' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#0284c7' }} />
        Trial · Active
      </span>
    );
  }
  if (plan === 'trial_expired') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(251,191,36,0.12)', color: '#ca8a04', border: '1px solid rgba(251,191,36,0.25)' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#ca8a04' }} />
        Trial · Expired
      </span>
    );
  }
  if (plan === 'paid') {
    const isRefunded = account.status === 'refunded';
    const versionLabel = account.license_version != null ? `V${account.license_version}` : 'Paid';
    if (isRefunded) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(234,179,8,0.12)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.25)' }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#ca8a04' }} />
          {versionLabel} · Refunded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#16a34a' }} />
        {versionLabel}
      </span>
    );
  }
  if (plan === 'complimentary') {
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


// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ token, accountsTotal, noLicense, complimentary, paid, trialActive, trialExpired }: {
  token: string;
  accountsTotal: number;
  noLicense: number;
  complimentary: number;
  paid: number;
  trialActive: number;
  trialExpired: number;
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
    { label: 'Trial · active', value: trialActive },
    { label: 'Trial · expired', value: trialExpired },
    { label: 'No license', value: noLicense },
    { label: 'Complimentary', value: complimentary },
    { label: 'Paid', value: paid },
    { label: 'Devices (this week)', value: stats?.devices_activated_this_week ?? '-' },
    { label: 'Open bug reports', value: stats?.open_bug_reports ?? '-' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-8">
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

// ── User Detail Panel ─────────────────────────────────────────────────────────

function UserDetailPanel({ account, token, onBack, onAccountRefresh }: {
  account: Account;
  token: string;
  onBack: () => void;
  onAccountRefresh: () => void;
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [wipingAll, setWipingAll] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const [regenConfirm, setRegenConfirm] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedKeyMain, setCopiedKeyMain] = useState(false);
  const [limitValue, setLimitValue] = useState(account.activation_limit ?? 3);
  const [limitLoading, setLimitLoading] = useState(false);
  const [limitSaved, setLimitSaved] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferConfirm, setTransferConfirm] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  const [emailSubject, setEmailSubject] = useState('');
  const [emailText, setEmailText] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  const [grantNote, setGrantNote] = useState('');
  const [grantLimit, setGrantLimit] = useState(3);
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteFinal, setConfirmDeleteFinal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Note editing
  const [noteValue, setNoteValue] = useState(account.note ?? '');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Plan management
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planConfirmRevoke, setPlanConfirmRevoke] = useState(false);
  const [planIssuedKey, setPlanIssuedKey] = useState<string | null>(null);
  const [planIssuedKeyCopied, setPlanIssuedKeyCopied] = useState(false);
  const [assignLoading, setAssignLoading] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [refundConfirm, setRefundConfirm] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundWarning, setRefundWarning] = useState<string | null>(null);

  const [extendExtraDays, setExtendExtraDays] = useState(7);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  // Account history
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    setDevicesError(null);
    try {
      const res = await apiReq(token, 'user-actions', 'POST', { action: 'list_devices', email: account.email });
      const data = await res.json() as { devices?: Device[]; error?: string };
      if (data.error) { setDevicesError(data.error); return; }
      setDevices(data.devices ?? []);
    } catch {
      setDevicesError('Failed to load devices.');
    } finally {
      setDevicesLoading(false);
    }
  }, [token, account.email]);

  useEffect(() => { void loadDevices(); }, [loadDevices]);

  const deactivateDevice = async (d: Device) => {
    setDeactivating(d.device_id);
    await apiReq(token, 'user-actions', 'POST', { action: 'deactivate_device', email: account.email, device_id: d.device_id, source: d.source });
    setDeactivating(null);
    await loadDevices();
    onAccountRefresh();
  };

  const wipeAll = async () => {
    setWipingAll(true);
    await apiReq(token, 'user-actions', 'POST', { action: 'deactivate_all_devices', email: account.email });
    setWipingAll(false);
    setConfirmWipe(false);
    await loadDevices();
    onAccountRefresh();
  };

  const regenKey = async () => {
    setRegenLoading(true);
    setLicenseError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', { action: 'regenerate_key', email: account.email, license_type: account.license_type });
      const data = await res.json() as { ok?: boolean; new_key?: string; error?: string };
      if (data.error) { setLicenseError(data.error); return; }
      setNewKey(data.new_key ?? null);
      setRegenConfirm(false);
      onAccountRefresh();
    } finally {
      setRegenLoading(false);
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
      onAccountRefresh();
    } finally {
      setLimitLoading(false);
    }
  };

  const transferLicense = async () => {
    setTransferLoading(true);
    setTransferError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', { action: 'transfer_license', email: account.email, new_email: transferEmail.trim().toLowerCase() });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setTransferError(data.error); return; }
      onAccountRefresh();
      onBack();
    } finally {
      setTransferLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailText.trim()) return;
    setEmailLoading(true);
    setEmailError(null);
    try {
      const res = await apiReq(token, 'email', 'POST', { action: 'send_custom', to: account.email, subject: emailSubject, text: emailText });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setEmailError(data.error); return; }
      setEmailSent(true);
      setEmailSubject('');
      setEmailText('');
      setTimeout(() => setEmailSent(false), 3000);
    } finally {
      setEmailLoading(false);
    }
  };

  const sendReset = async () => {
    setResetLoading(true);
    try {
      const res = await apiReq(token, 'user-actions', 'POST', { action: 'reset_password', email: account.email });
      const data = await res.json() as { ok?: boolean; link?: string; error?: string };
      if (data.link) setResetLink(data.link);
    } finally {
      setResetLoading(false);
    }
  };

  const grantLicense = async () => {
    setGrantLoading(true);
    setGrantError(null);
    try {
      const res = await apiReq(token, 'accounts', 'POST', { email: account.email, note: grantNote.trim() || undefined, activation_limit: grantLimit });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setGrantError(data.error); return; }
      setGrantSuccess(true);
      onAccountRefresh();
    } finally {
      setGrantLoading(false);
    }
  };

  const deleteUser = async () => {
    if (!account.auth_id) return;
    setDeleteLoading(true);
    await apiReq(token, 'user-actions', 'POST', { action: 'delete_user', auth_id: account.auth_id, email: account.email });
    setDeleteLoading(false);
    onAccountRefresh();
    onBack();
  };

  const saveNote = async () => {
    setNoteSaving(true);
    setNoteError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', { action: 'update_note', email: account.email, note: noteValue });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setNoteError(data.error); return; }
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
      onAccountRefresh();
    } finally {
      setNoteSaving(false);
    }
  };

  const revokeLicense = async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', { action: 'revoke_license', email: account.email, license_type: account.license_type });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setPlanError(data.error); return; }
      setPlanConfirmRevoke(false);
      onAccountRefresh();
    } finally {
      setPlanLoading(false);
    }
  };

  const issuePaidLicense = async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', { action: 'issue_paid_license', email: account.email });
      const data = await res.json() as { ok?: boolean; license_key?: string; error?: string };
      if (data.error) { setPlanError(data.error); return; }
      setPlanIssuedKey(data.license_key ?? null);
      onAccountRefresh();
    } finally {
      setPlanLoading(false);
    }
  };

  const refundPaidLicense = async () => {
    setRefundLoading(true);
    setRefundWarning(null);
    setPlanError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', { action: 'refund_paid_license', email: account.email });
      const data = await res.json() as { ok?: boolean; paddle_warning?: string; error?: string };
      if (data.error) { setPlanError(data.error); return; }
      if (data.paddle_warning) setRefundWarning(data.paddle_warning);
      setRefundConfirm(false);
      onAccountRefresh();
    } finally {
      setRefundLoading(false);
    }
  };

  const hasNoEffectiveLicense =
    account.license_type === 'none' ||
    (account.license_type === 'paid' && account.status === 'refunded');

  const assignPlan = async (planId: 'complimentary' | 'trial' | 'solo' | 'pro' | 'team') => {
    setAssignLoading(planId);
    setAssignError(null);
    setPlanIssuedKey(null);
    try {
      let res: Response;
      if (planId === 'complimentary') {
        res = await apiReq(token, 'accounts', 'POST', { email: account.email, activation_limit: 100 });
      } else if (planId === 'trial') {
        res = await apiReq(token, 'license-actions', 'POST', { action: 'start_trial', email: account.email, days: 14 });
      } else {
        res = await apiReq(token, 'license-actions', 'POST', { action: 'issue_paid_license', email: account.email, tier: planId });
      }
      const data = await res.json() as { ok?: boolean; license_key?: string; error?: string };
      if (data.error) { setAssignError(data.error); return; }
      if (data.license_key) setPlanIssuedKey(data.license_key);
      onAccountRefresh();
    } finally {
      setAssignLoading(null);
    }
  };

  const extendTrial = async () => {
    setExtendLoading(true);
    setExtendError(null);
    try {
      const res = await apiReq(token, 'license-actions', 'POST', {
        action: 'extend_trial',
        email: account.email,
        extra_days: extendExtraDays,
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) {
        setExtendError(data.error);
        return;
      }
      onAccountRefresh();
    } finally {
      setExtendLoading(false);
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`${API}/api/admin/audit-log?target=${encodeURIComponent(account.email)}&per_page=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { entries?: AuditEntry[]; error?: string };
      if (data.error) { setHistoryError(data.error); return; }
      setHistory(data.entries ?? []);
    } catch {
      setHistoryError('Failed to load history.');
    } finally {
      setHistoryLoading(false);
    }
  }, [token, account.email]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const SectionLabel = ({ title }: { title: string }) => (
    <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{title}</p>
  );

  const divider = { borderTop: '1px solid rgba(255,255,255,0.06)' };

  return (
    <div>
      {/* Back nav */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Members
      </button>

      {/* User header */}
      <div className="glass-card p-5 mb-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <MemberAvatar email={account.email} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight" style={{ color: 'var(--text)' }}>{emailLocalPart(account.email)}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{account.email}</p>
            <div className="flex items-center flex-wrap gap-2 mt-3">
              <LicenseBadge account={account} />
              {account.activation_limit != null && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(account.activations_used ?? 0) >= account.activation_limit ? 'text-amber-400' : ''}`}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: (account.activations_used ?? 0) >= account.activation_limit ? '#fbbf24' : 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {account.activations_used ?? 0} / {account.activation_limit} devices
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Joined</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatDate(account.signed_up_at)}</p>
            <code
              className="block text-[11px] font-mono mt-2 px-2 py-1 rounded max-w-[11rem] ml-auto truncate"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
              title={account.auth_id ?? undefined}
            >
              {account.auth_id ? `${account.auth_id.slice(0, 12)}…` : 'Trial-only'}
            </code>
          </div>
        </div>
      </div>

      {/* ── Plan Management ── */}
      <div className="glass-card p-5 mb-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <SectionLabel title="Plan Management" />
        {(planError ?? assignError) && (
          <p className="text-xs mb-3" style={{ color: '#fbbf24' }}>{planError ?? assignError}</p>
        )}

        {/* Issued license key display */}
        {planIssuedKey && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="text-xs mb-1.5" style={{ color: '#16a34a' }}>License issued — share this key with the user</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono font-semibold" style={{ color: 'var(--text)' }}>{planIssuedKey}</code>
              <button
                onClick={() => { void navigator.clipboard.writeText(planIssuedKey); setPlanIssuedKeyCopied(true); setTimeout(() => setPlanIssuedKeyCopied(false), 2000); }}
                className="text-xs shrink-0"
                style={{ color: 'var(--text-muted)' }}
              >
                {planIssuedKeyCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {hasNoEffectiveLicense ? (
          /* ── No active license: show assign options ── */
          <div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              No active license. Assign a plan to this user:
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'complimentary', label: 'Complimentary', sub: 'NFR · unlimited devices', accent: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
                  { id: 'trial', label: 'Free Trial', sub: '14 days', accent: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
                  { id: 'solo', label: 'Solo', sub: '$49/yr · 1 Mac', accent: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'rgba(255,255,255,0.12)' },
                  { id: 'pro', label: 'Pro', sub: '$99/yr · 3 Macs', accent: 'var(--accent)', color: '#fff', border: 'transparent' },
                  { id: 'team', label: 'Team', sub: '$199/yr · 10 Macs', accent: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'rgba(255,255,255,0.12)' },
                ] as const
              ).map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => void assignPlan(plan.id)}
                  disabled={assignLoading !== null}
                  className="flex flex-col items-start px-4 py-2.5 rounded-lg text-left transition-opacity disabled:opacity-40"
                  style={{ background: plan.accent, color: plan.color, border: `1px solid ${plan.border}` }}
                >
                  <span className="text-sm font-medium leading-tight">
                    {assignLoading === plan.id ? 'Assigning…' : plan.label}
                  </span>
                  <span className="text-[11px] mt-0.5 opacity-70">{plan.sub}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Has active license: show refund/revoke actions ── */
          <div className="flex flex-wrap items-center gap-3">
            {/* Issue Paid License (legacy, for non-paid plans) */}
            {account.license_type !== 'paid' && (
              <button onClick={() => void issuePaidLicense()} disabled={planLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {planLoading ? 'Working…' : 'Issue Paid License'}
              </button>
            )}

            {/* Grant Complimentary — only if trial */}
            {isTrialPlan(account.license_type) && (
              <button onClick={() => void grantLicense()} disabled={grantLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {grantLoading ? 'Granting…' : 'Grant Complimentary'}
              </button>
            )}

            {/* Paid license → Refund through Paddle */}
            {account.license_type === 'paid' && (
              refundConfirm ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {account.purchase_type === 'subscription'
                      ? 'Cancel the subscription in Paddle and refund the last payment?'
                      : account.purchase_type === 'rent_to_own'
                        ? 'Cancel the RTO plan in Paddle (stops future installments)?'
                        : account.license_key && !account.paddle_subscription_id
                          ? 'Issue a full refund through Paddle and revoke the license?'
                          : 'Revoke this admin-issued license (no Paddle charge to refund)?'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => void refundPaidLicense()} disabled={refundLoading}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                      {refundLoading ? 'Processing…' : 'Confirm refund'}
                    </button>
                    <button onClick={() => setRefundConfirm(false)} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setRefundConfirm(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Refund License
                </button>
              )
            )}

            {/* Complimentary / trial → plain Revoke (no Paddle involved) */}
            {account.license_type !== 'paid' && (
              planConfirmRevoke ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {isTrialPlan(account.license_type)
                      ? 'Remove trial for this email?'
                      : 'Delete complimentary license?'}
                  </span>
                  <button onClick={() => void revokeLicense()} disabled={planLoading}
                    className="text-sm font-medium disabled:opacity-40" style={{ color: '#f87171' }}>
                    {planLoading ? 'Revoking…' : 'Confirm'}
                  </button>
                  <button onClick={() => setPlanConfirmRevoke(false)} className="text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setPlanConfirmRevoke(true)}
                  className="px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Revoke License
                </button>
              )
            )}
          </div>
        )}

        {/* Paddle warning shown after a partial refund success */}
        {refundWarning && (
          <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
            <span className="font-medium">Paddle warning — </span>{refundWarning}
            <span className="block mt-1" style={{ color: 'var(--text-muted)' }}>
              The license has been revoked in our database. You may need to complete the refund manually in the Paddle dashboard.
            </span>
          </div>
        )}

        {isTrialPlan(account.license_type) && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Extend trial — extra days are added after the current end time (or from now if the trial already expired).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={extendExtraDays}
                onChange={(e) => setExtendExtraDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 px-3 py-2 rounded-lg text-sm text-center bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ color: 'var(--text)' }}
              />
              <button
                type="button"
                onClick={() => void extendTrial()}
                disabled={extendLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {extendLoading ? 'Saving…' : 'Extend trial'}
              </button>
            </div>
            {extendError && (
              <p className="text-xs mt-2" style={{ color: '#fbbf24' }}>{extendError}</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-5">

          {/* License card */}
          {(hasKeyedLicensePlan(account.license_type) || isTrialPlan(account.license_type)) && (
            <div className="glass-card p-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <SectionLabel title={isTrialPlan(account.license_type) ? 'Trial' : 'License'} />
              <div className="flex flex-col gap-4">

                {isTrialPlan(account.license_type) && (
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Started</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{formatDateTime(account.trial_started_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ends</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{formatDateTime(account.trial_ends_at)}</p>
                    </div>
                  </div>
                )}

                {/* License key */}
                {hasKeyedLicensePlan(account.license_type) && (newKey ?? account.license_key) && (
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>License key</p>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <code className="flex-1 min-w-0 text-sm font-mono tracking-wide break-all" style={{ color: 'var(--text)' }}>{newKey ?? account.license_key}</code>
                      <button
                        onClick={() => { void navigator.clipboard.writeText(newKey ?? account.license_key!); setCopiedKeyMain(true); setTimeout(() => setCopiedKeyMain(false), 2000); }}
                        className="text-xs shrink-0 transition-opacity hover:opacity-70"
                        style={{ color: 'var(--text-muted)' }}>
                        {copiedKeyMain ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    {newKey && <p className="text-xs mt-1.5" style={{ color: '#16a34a' }}>New key generated — share this with the user</p>}
                  </div>
                )}

                {/* Version */}
                {account.license_type === 'paid' && account.license_version != null && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Version</p>
                    <span className="text-sm font-medium px-2.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>
                      V{account.license_version}
                    </span>
                  </div>
                )}

                {/* Editable note (complimentary) */}
                {account.license_type === 'complimentary' && (
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Note</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        placeholder="e.g. Beta tester"
                        className="flex-1 px-3 py-2 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                        style={{ color: 'var(--text)' }}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveNote(); }}
                      />
                      <button onClick={() => void saveNote()} disabled={noteSaving}
                        className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 shrink-0"
                        style={{ background: 'var(--accent)', color: '#fff' }}>
                        {noteSaving ? '…' : noteSaved ? '✓' : 'Save'}
                      </button>
                    </div>
                    {noteError && <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>{noteError}</p>}
                  </div>
                )}

                {hasKeyedLicensePlan(account.license_type) && (
                  <>
                    {licenseError && <p className="text-xs" style={{ color: '#fbbf24' }}>{licenseError}</p>}

                    {/* Regen key */}
                    <div className="pt-3" style={divider}>
                      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Regenerate key — old key stops working immediately.</p>
                      {regenConfirm ? (
                        <div className="flex gap-2">
                          <button onClick={() => void regenKey()} disabled={regenLoading}
                            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {regenLoading ? 'Generating…' : 'Yes, regenerate'}
                          </button>
                          <button onClick={() => setRegenConfirm(false)}
                            className="flex-1 py-2 rounded-lg text-sm transition-colors"
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

                    {/* Device limit override */}
                    <div className="pt-3" style={divider}>
                      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Device limit override</p>
                      <div className="flex items-center gap-2">
                        <input type="number" value={limitValue}
                          onChange={(e) => setLimitValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          min={1} max={100}
                          className="w-20 px-3 py-2 rounded-lg text-sm text-center bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                          style={{ color: 'var(--text)' }} />
                        <button onClick={() => void saveLimit()} disabled={limitLoading}
                          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                          style={{ background: 'var(--accent)', color: '#fff' }}>
                          {limitLoading ? 'Saving…' : limitSaved ? 'Saved!' : 'Save'}
                        </button>
                      </div>
                      {limitError && <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>{limitError}</p>}
                    </div>
                  </>
                )}

                {/* Transfer (complimentary only) */}
                {account.license_type === 'complimentary' && (
                  <div className="pt-3" style={divider}>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Transfer license to a different account</p>
                    <input type="email" value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)}
                      placeholder="new@example.com"
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent mb-2"
                      style={{ color: 'var(--text)' }} />
                    {transferError && <p className="text-xs mb-2" style={{ color: '#fbbf24' }}>{transferError}</p>}
                    {transferConfirm ? (
                      <div className="flex gap-2">
                        <button onClick={() => void transferLicense()} disabled={transferLoading}
                          className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                          {transferLoading ? 'Transferring…' : 'Confirm transfer'}
                        </button>
                        <button onClick={() => setTransferConfirm(false)}
                          className="flex-1 py-2 rounded-lg text-sm transition-colors"
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
            </div>
          )}

          {/* Grant license (no license accounts) */}
          {account.license_type === 'none' && (
            <div className="glass-card p-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <SectionLabel title="Grant Complimentary License" />
              {grantSuccess ? (
                <p className="text-sm" style={{ color: '#16a34a' }}>License granted successfully.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
                    <input type="text" value={grantNote} onChange={(e) => setGrantNote(e.target.value)} placeholder="e.g. Beta tester"
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                      style={{ color: 'var(--text)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Device limit</label>
                    <input type="number" value={grantLimit}
                      onChange={(e) => setGrantLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      min={1} max={100}
                      className="w-24 px-3 py-2.5 rounded-lg text-sm text-center bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                      style={{ color: 'var(--text)' }} />
                  </div>
                  {grantError && <p className="text-sm" style={{ color: '#fbbf24' }}>{grantError}</p>}
                  <button onClick={() => void grantLicense()} disabled={grantLoading}
                    className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {grantLoading ? 'Granting…' : 'Grant license'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Send email */}
          <div className="glass-card p-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <SectionLabel title="Send Email" />
            {emailSent ? (
              <p className="text-sm py-2" style={{ color: '#16a34a' }}>Email sent successfully.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{ color: 'var(--text)' }} />
                <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)}
                  placeholder="Message…" rows={4}
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  style={{ color: 'var(--text)' }} />
                {emailError && <p className="text-sm" style={{ color: '#fbbf24' }}>{emailError}</p>}
                <button onClick={() => void sendEmail()} disabled={emailLoading || !emailSubject.trim() || !emailText.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {emailLoading ? 'Sending…' : 'Send email'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-5">

          {/* Devices */}
          <div className="glass-card p-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Activated Devices</p>
              <button onClick={() => void loadDevices()} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                Refresh
              </button>
            </div>

            {devicesLoading && <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {devicesError && <p className="text-sm" style={{ color: '#fbbf24' }}>{devicesError}</p>}
            {!devicesLoading && devices.length === 0 && !devicesError && (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No activated devices.</p>
            )}

            {devices.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {devices.map((d) => (
                  <div key={d.device_id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                        {d.display_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unnamed device</span>}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {d.source === 'paid' ? 'Paid' : d.source === 'trial' ? 'Trial' : 'Complimentary'} · Activated {formatDate(d.activated_at)}
                      </p>
                    </div>
                    <button onClick={() => void deactivateDevice(d)} disabled={deactivating === d.device_id}
                      className="text-xs shrink-0 transition-colors disabled:opacity-40" style={{ color: '#f87171' }}>
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
                  <button onClick={() => void wipeAll()} disabled={wipingAll}
                    className="text-xs font-medium disabled:opacity-40" style={{ color: '#f87171' }}>
                    {wipingAll ? 'Removing…' : 'Confirm'}
                  </button>
                  <button onClick={() => setConfirmWipe(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmWipe(true)} className="w-full py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Deactivate all devices
                </button>
              )
            )}
          </div>

          {/* Account actions */}
          <div className="glass-card p-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <SectionLabel title="Account" />
            <div className="flex flex-col gap-4">

              {/* Password reset */}
              {account.auth_id ? (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Generate a password reset link for this user.</p>
                {resetLink ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <code className="flex-1 min-w-0 text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>{resetLink}</code>
                    <button onClick={() => { void navigator.clipboard.writeText(resetLink); setResetCopied(true); setTimeout(() => setResetCopied(false), 2000); }}
                      className="text-xs shrink-0 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                      {resetCopied ? '✓' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => void sendReset()} disabled={resetLoading}
                    className="w-full py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {resetLoading ? 'Generating…' : 'Generate reset link'}
                  </button>
                )}
              </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No login account — trial started from the app only.</p>
              )}

              {/* Delete account */}
              {account.auth_id && (
              <div className="pt-3" style={divider}>
                {confirmDeleteFinal && createPortal(
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.12)' }}>
                      <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full mx-auto" style={{ background: 'rgba(248,113,113,0.12)' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </div>
                      <h3 className="text-center text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>This cannot be undone</h3>
                      <p className="text-center text-sm mb-2" style={{ color: 'var(--text-muted)' }}>You are permanently deleting:</p>
                      <p className="text-center text-sm font-medium mb-5 px-2 py-2 rounded-lg"
                        style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', wordBreak: 'break-all' }}>
                        {account.email}
                      </p>
                      <p className="text-center text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                        Their account, auth credentials, and all activations will be permanently removed.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => { setConfirmDeleteFinal(false); setConfirmDelete(false); }}
                          className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          Cancel
                        </button>
                        <button onClick={() => void deleteUser()} disabled={deleteLoading}
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
                    <span className="text-sm flex-1" style={{ color: 'var(--text-muted)' }}>Delete this account permanently?</span>
                    <button onClick={() => setConfirmDeleteFinal(true)} className="text-sm font-medium" style={{ color: '#f87171' }}>Confirm</button>
                    <button onClick={() => setConfirmDelete(false)} className="text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                  </div>
                ) : !confirmDeleteFinal && (
                  <button onClick={() => setConfirmDelete(true)}
                    className="w-full py-2 rounded-lg text-sm transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Delete account
                  </button>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Account History ── */}
      <div className="glass-card mt-5 overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Account History</p>
          <button onClick={() => void loadHistory()} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            Refresh
          </button>
        </div>

        {/* Account creation as the first event */}
        <div className="px-5 py-3 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#6366f1', marginTop: '6px' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Account created</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{account.email}</p>
          </div>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{formatDateTime(account.signed_up_at)}</span>
        </div>

        {historyLoading && (
          <p className="px-5 py-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Loading history…</p>
        )}
        {historyError && (
          <p className="px-5 py-4 text-sm" style={{ color: '#fbbf24' }}>{historyError}</p>
        )}
        {!historyLoading && history.length === 0 && !historyError && (
          <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No recorded activity yet.</p>
        )}
        {history.map((e) => {
          const isAdminAction = !!e.admin_email;
          const dot = isAdminAction ? '#a78bfa' : 'rgba(255,255,255,0.3)';
          const label = e.action.replace(/_/g, ' ');
          const details = e.details as Record<string, unknown> | null;
          const safeDetails = details
            ? Object.entries(details)
                .filter(([k]) => !['password', 'token', 'secret', 'key'].some((s) => k.toLowerCase().includes(s)))
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(', ')
            : null;
          return (
            <div key={e.id} className="px-5 py-3 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="shrink-0 rounded-full" style={{ width: '6px', height: '6px', background: dot, marginTop: '6px' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>{label}</p>
                {safeDetails && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{safeDetails}</p>
                )}
                {isAdminAction && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>by {e.admin_email}</p>
                )}
              </div>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{formatDateTime(e.created_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── All Accounts Tab ──────────────────────────────────────────────────────────

type AccountSortKey = 'signed_up' | 'email' | 'license';

type MembersPlanFilter = 'all' | Account['license_type'];

const MEMBERS_PLAN_FILTERS: readonly MembersPlanFilter[] = [
  'all',
  'none',
  'trial_active',
  'trial_expired',
  'complimentary',
  'paid',
];

function membersPlanFilterLabel(f: MembersPlanFilter): string {
  switch (f) {
    case 'all':
      return 'All';
    case 'none':
      return 'No license';
    case 'trial_active':
      return 'Trial · active';
    case 'trial_expired':
      return 'Trial · expired';
    case 'complimentary':
      return 'Complimentary';
    case 'paid':
      return 'Paid';
  }
}

interface AccountsTabErrorBoundaryProps {
  children: ReactNode;
}

interface AccountsTabErrorBoundaryState {
  message: string | null;
}

class AccountsTabErrorBoundary extends Component<AccountsTabErrorBoundaryProps, AccountsTabErrorBoundaryState> {
  constructor(props: AccountsTabErrorBoundaryProps) {
    super(props);
    this.state = { message: null };
  }

  static getDerivedStateFromError(err: unknown): AccountsTabErrorBoundaryState {
    return { message: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="glass-card p-6 mb-6" style={{ border: '1px solid rgba(239,68,68,0.35)' }}>
          <p className="text-sm font-medium mb-2" style={{ color: '#f87171' }}>Members tab crashed</p>
          <p className="text-xs whitespace-pre-wrap break-words" style={{ color: 'var(--text-muted)' }}>{this.state.message}</p>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Check the browser console for details. Refresh the page and try again.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function AccountsTab({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MembersPlanFilter>('all');
  const [sortKey, setSortKey] = useState<AccountSortKey>('signed_up');
  const [sortDesc, setSortDesc] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // User detail view
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const selectedAccount = selectedEmail ? (accounts.find((a) => a.email === selectedEmail) ?? null) : null;

  // Invite modal
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

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
    const q = search.trim().toLowerCase();
    const authHaystack = (a.auth_id ?? '').toLowerCase();
    const emailHaystack = (a.email ?? '').toLowerCase();
    if (q && !emailHaystack.includes(q) && !authHaystack.includes(q)) return false;
    return true;
  });

  const sortedRows = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'email') cmp = (a.email ?? '').localeCompare(b.email ?? '');
    else if (sortKey === 'signed_up') {
      cmp = new Date(a.signed_up_at).getTime() - new Date(b.signed_up_at).getTime();
    } else {
      cmp = planSortRank(a.license_type) - planSortRank(b.license_type);
      if (cmp === 0) cmp = (a.email ?? '').localeCompare(b.email ?? '');
    }
    return sortDesc ? -cmp : cmp;
  });

  const recipientCount = accounts.filter((a) => broadcastFilter === 'all' || a.license_type === broadcastFilter).length;

  const counts = {
    total: accounts.length,
    none: accounts.filter((a) => a.license_type === 'none').length,
    comp: accounts.filter((a) => a.license_type === 'complimentary').length,
    paid: accounts.filter((a) => a.license_type === 'paid').length,
    trial_active: accounts.filter((a) => a.license_type === 'trial_active').length,
    trial_expired: accounts.filter((a) => a.license_type === 'trial_expired').length,
  };

  if (selectedAccount) {
    return (
      <UserDetailPanel
        account={selectedAccount}
        token={token}
        onBack={() => setSelectedEmail(null)}
        onAccountRefresh={() => void load()}
      />
    );
  }

  return (
    <div>
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
            <textarea
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder="Message…"
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              style={{ color: 'var(--text)' }}
            />
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

      {/* Members — Discord-style list */}
      <div className="glass-card overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>Members</h2>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{sortedRows.length}</span> shown
                <span className="mx-1.5 opacity-40">·</span>
                {counts.total} total
                <span className="mx-1.5 opacity-40">·</span>
                {counts.paid} paid
                <span className="mx-1.5 opacity-40">·</span>
                {counts.comp} complimentary
                <span className="mx-1.5 opacity-40">·</span>
                {counts.trial_active} trial · active
                <span className="mx-1.5 opacity-40">·</span>
                {counts.trial_expired} trial · expired
                <span className="mx-1.5 opacity-40">·</span>
                {counts.none} no license
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or user ID…"
                className="w-full min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent sm:w-56"
                style={{ color: 'var(--text)' }}
              />
              <div className="flex items-center gap-2">
                <label htmlFor="account-sort" className="sr-only">Sort by</label>
                <select
                  id="account-sort"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as AccountSortKey)}
                  className="shrink-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <option value="signed_up">Member since</option>
                  <option value="email">Email (A–Z)</option>
                  <option value="license">Plan type</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortDesc((d) => !d)}
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/[0.06]"
                  style={{ color: 'var(--text-secondary)' }}
                  title={sortDesc ? 'Newest / Z–A first' : 'Oldest / A–Z first'}
                >
                  {sortDesc ? '↓' : '↑'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowInvite(true); setInviteSent(false); setInviteError(null); setInviteEmail(''); }}
              className="btn-accent shrink-0 text-sm"
              style={{ padding: '8px 14px' }}
            >
              + Create account
            </button>
            <div className="flex flex-wrap gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {MEMBERS_PLAN_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: filter === f ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: filter === f ? 'var(--text)' : 'var(--text-muted)',
                    boxShadow: filter === f ? 'inset 0 0 0 1px rgba(255,255,255,0.08)' : 'none',
                  }}
                >
                  {membersPlanFilterLabel(f)}
                </button>
              ))}
            </div>
            <span className="mx-1 hidden h-5 w-px sm:inline-block" style={{ background: 'rgba(255,255,255,0.12)' }} aria-hidden />
            <button
              type="button"
              onClick={() => exportCSV(accounts)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/[0.06]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/[0.06] disabled:opacity-40"
              style={{ color: 'var(--text-secondary)' }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => setShowBroadcast((v) => !v)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/[0.06]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Broadcast email
            </button>
          </div>
        </div>

        {error && <div className="border-b px-6 py-3 text-sm" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#f87171' }}>{error}</div>}

        {loading && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading members…</div>
        )}

        {!loading && sortedRows.length === 0 && !error && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search || filter !== 'all' ? 'No members match your search or filter.' : 'No members yet.'}
            </p>
          </div>
        )}

        {!loading && sortedRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)' }}
                >
                  <th className="px-5 py-2.5">Member</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Member since</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">User ID</th>
                  <th className="px-4 py-2.5">Plan</th>
                  <th className="px-4 py-2.5 text-center whitespace-nowrap">Devices</th>
                  <th className="px-4 py-2.5 min-w-[140px]">License key</th>
                  <th className="px-5 py-2.5 text-right whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((a, rowIdx) => (
                  <tr
                    key={a.email ?? `row-${rowIdx}`}
                    className="transition-colors hover:bg-white/[0.05] cursor-pointer"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onClick={() => setSelectedEmail(a.email)}
                  >
                    <td className="px-5 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <MemberAvatar email={a.email} />
                        <div className="min-w-0">
                          <p className="truncate font-medium" style={{ color: 'var(--text)' }} title={emailLocalPart(a.email)}>
                            {emailLocalPart(a.email)}
                          </p>
                          <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }} title={a.email}>
                            {a.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatDateTime(a.signed_up_at)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <code
                        className="block max-w-[7.5rem] truncate text-[11px] font-mono"
                        style={{ color: 'var(--text-muted)' }}
                        title={a.auth_id ?? undefined}
                      >
                        {a.auth_id ? `${a.auth_id.slice(0, 8)}…` : '—'}
                      </code>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-wrap items-center gap-1">
                        <LicenseBadge account={a} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {a.license_type !== 'none' ? (
                        <span className={(a.activations_used ?? 0) >= (a.activation_limit ?? 999) ? 'text-amber-400' : ''}>
                          {a.activations_used ?? 0} / {a.activation_limit ?? '-'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="max-w-[200px] px-4 py-3 align-middle">
                      {a.license_key ? (
                        <div className="flex min-w-0 items-center gap-1.5">
                          <code className="truncate font-mono text-[11px] tracking-wide" style={{ color: 'var(--text-secondary)' }} title={a.license_key}>
                            {a.license_key}
                          </code>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(a.license_key!);
                              setCopiedKey(a.email);
                              setTimeout(() => setCopiedKey(null), 2000);
                            }}
                            className="shrink-0 text-[11px] transition-opacity hover:opacity-80"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {copiedKey === a.email ? '✓' : 'Copy'}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 align-middle text-right">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', display: 'inline-block' }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
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
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Add an email above or use Members to grant from an existing account.</p>
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
  { id: 'accounts', label: 'Members' },
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

  const [accountCounts, setAccountCounts] = useState({
    total: 0,
    none: 0,
    comp: 0,
    paid: 0,
    trialActive: 0,
    trialExpired: 0,
  });

  useEffect(() => {
    if (!session?.access_token) return;
    void fetch(`${API}/api/admin/nfr`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => { if (r.status === 403) setForbidden(true); });
    void fetch(`${API}/api/admin/accounts`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { accounts?: Account[] } | null) => {
        if (!d?.accounts) return;
        const counts = {
          total: d.accounts.length,
          none: 0,
          comp: 0,
          paid: 0,
          trialActive: 0,
          trialExpired: 0,
        };
        for (const a of d.accounts) {
          if (a.license_type === 'none') counts.none++;
          else if (a.license_type === 'complimentary') counts.comp++;
          else if (a.license_type === 'paid') counts.paid++;
          else if (a.license_type === 'trial_active') counts.trialActive++;
          else if (a.license_type === 'trial_expired') counts.trialExpired++;
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
            trialActive={accountCounts.trialActive}
            trialExpired={accountCounts.trialExpired}
          />
        )}
        {tab === 'accounts' && (
          <AccountsTabErrorBoundary>
            <AccountsTab token={token} />
          </AccountsTabErrorBoundary>
        )}
        {tab === 'bugs' && <BugReportsTab token={token} />}
        {tab === 'audit' && <AuditLogTab token={token} />}
        {tab === 'licenses' && <NfrTab token={token} />}
        {tab === 'releases' && <ReleasesTab token={token} />}
      </div>
    </div>
  );
}

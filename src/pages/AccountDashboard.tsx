import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

const inputClass =
  'w-full px-4 py-2.5 rounded-[var(--radius)] bg-white/[0.03] border text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-colors border-[rgba(255,255,255,0.08)]';

const API_URL = import.meta.env.VITE_LICENSE_API_URL ?? '';

const NO_LICENSE_FOR_EMAIL =
  'No active subscription or free access found for this email.';

interface AccountData {
  activations: Array<{
    device_id: string;
    display_name: string | null;
    activated_at: string;
  }>;
  status: string | null;
  tier: string | null;
  activation_used: number;
  activation_limit: number;
  license_key?: string | null;
  error?: string;
}

export function AccountDashboard() {
  const { user, session, setPasswordWithoutCurrent } = useAuth();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryPass, setRecoveryPass] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryErr, setRecoveryErr] = useState<string | null>(null);
  const [recoveryDone, setRecoveryDone] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      setShowRecoveryPassword(true);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setShowRecoveryPassword(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.access_token || !API_URL) {
      setFetchError(!API_URL ? 'License server URL is not configured for this site build.' : null);
      return;
    }

    setDataLoading(true);
    setRetrying(false);
    setFetchError(null);
    // Brief delay lets the browser finish loading all assets after a fresh deploy
    const retryTimer = setTimeout(() => setRetrying(true), 1200);
    fetchWithRetry(
      `${API_URL.replace(/\/$/, '')}/api/web/list-activations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      },
    )
      .then(async (res) => {
        let data: AccountData;
        try { data = (await res.json()) as AccountData; }
        catch { setAccountData(null); setFetchError('Invalid response from the license server.'); return; }
        if (!res.ok) { setAccountData(null); setFetchError(data.error ?? `Could not load account (${res.status}).`); return; }
        setAccountData({
          activations: data.activations ?? [],
          status: data.status ?? null,
          tier: data.tier ?? null,
          activation_used: data.activation_used ?? 0,
          activation_limit: data.activation_limit ?? 0,
          license_key: data.license_key ?? null,
          error: data.error,
        });
      })
      .catch(() => {
        setAccountData(null);
        setFetchError('Could not reach the license server. Check your connection or try again in a moment.');
      })
      .finally(() => { clearTimeout(retryTimer); setRetrying(false); setDataLoading(false); });
  }, [session?.access_token]);

  const handleRecoveryPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryErr(null);
    if (recoveryPass !== recoveryConfirm) { setRecoveryErr('Passwords do not match.'); return; }
    setRecoveryBusy(true);
    const { error } = await setPasswordWithoutCurrent(recoveryPass);
    setRecoveryBusy(false);
    if (error) { setRecoveryErr(error); return; }
    setRecoveryPass('');
    setRecoveryConfirm('');
    setRecoveryDone(true);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  const dismissRecoveryBanner = () => {
    setShowRecoveryPassword(false);
    setRecoveryDone(false);
    setRecoveryErr(null);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Dashboard</h1>
      <p className="text-text-muted text-sm mb-8">
        Welcome back, <span className="text-text-secondary">{user?.email}</span>
      </p>

      {showRecoveryPassword && user && (
        <div
          className="glass-card p-6 mb-6"
          style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(110,86,207,0.2)' }}
        >
          <h2 className="font-medium mb-1">Set your password</h2>
          {recoveryDone ? (
            <div className="space-y-4 max-w-md">
              <p className="text-emerald-400/90 text-sm">Your password is set. You can sign in with email and password next time.</p>
              <button type="button" className="btn-accent text-sm py-2 px-4" onClick={dismissRecoveryBanner}>Continue</button>
            </div>
          ) : (
            <>
              <p className="text-text-muted text-sm mb-4">
                You opened a password reset link. Choose a new password to finish.
              </p>
              <form onSubmit={handleRecoveryPassword} className="space-y-3 max-w-md">
                <div>
                  <label htmlFor="recovery-new-pw" className="block text-sm font-medium mb-2">New password</label>
                  <input id="recovery-new-pw" type="password" value={recoveryPass} onChange={(e) => setRecoveryPass(e.target.value)} placeholder="At least 6 characters" className={inputClass} autoComplete="new-password" minLength={6} />
                </div>
                <div>
                  <label htmlFor="recovery-confirm-pw" className="block text-sm font-medium mb-2">Confirm new password</label>
                  <input id="recovery-confirm-pw" type="password" value={recoveryConfirm} onChange={(e) => setRecoveryConfirm(e.target.value)} placeholder="Re-enter password" className={inputClass} autoComplete="new-password" minLength={6} />
                </div>
                {recoveryErr && <p className="text-amber-400 text-sm">{recoveryErr}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={recoveryBusy} className="btn-accent text-sm py-2 px-4">{recoveryBusy ? 'Saving…' : 'Save password'}</button>
                  <button type="button" className="text-sm text-text-muted hover:text-text-secondary px-3 py-2" onClick={dismissRecoveryBanner}>Dismiss</button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {fetchError && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
          {fetchError}
        </div>
      )}

      {dataLoading ? (
        <p className="text-text-muted">{retrying ? 'Connecting…' : 'Loading license…'}</p>
      ) : !fetchError && accountData ? (
        <div className="grid gap-5 md:grid-cols-2">
          {/* License card */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">Your License</h2>
              <Link to="/account/devices" className="text-xs text-accent hover:underline">Manage</Link>
            </div>
            {accountData.error === NO_LICENSE_FOR_EMAIL ? (
              <div className="rounded-lg px-4 py-3 text-sm space-y-2" style={{ background: 'rgba(255,200,0,0.05)', border: '1px solid rgba(255,200,0,0.12)', color: '#ffd560' }}>
                <p>No license linked to <strong className="text-text">{user?.email}</strong>.</p>
                <p className="text-text-secondary text-xs" style={{ color: 'rgba(245,245,247,0.65)' }}>
                  Use the same email you used for NFR or checkout.
                </p>
              </div>
            ) : accountData.error ? (
              <div className="rounded-lg px-4 py-3 text-sm text-amber-200" style={{ background: 'rgba(255,200,0,0.05)', border: '1px solid rgba(255,200,0,0.12)' }}>
                {accountData.error}
              </div>
            ) : !accountData.status ? (
              <div className="rounded-lg px-4 py-4 flex flex-col gap-2" style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(110,86,207,0.15)' }}>
                <p className="text-sm font-medium text-text">No active license</p>
                <p className="text-sm text-text-secondary">Billing opens soon. Check back to purchase when live.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                    {accountData.status === 'free'
                      ? 'Complimentary'
                      : (accountData.tier ?? accountData.status)}
                  </span>
                  {accountData.tier && accountData.status !== 'free' && (
                    <span className="text-text-secondary text-sm">plan</span>
                  )}
                </div>
                <p className="text-text-muted text-sm">
                  Devices: {accountData.activation_used} / {accountData.activation_limit}
                </p>
              </div>
            )}
          </div>

          {/* Devices card */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">Active Devices</h2>
              <Link to="/account/devices" className="text-xs text-accent hover:underline">Manage</Link>
            </div>
            <p className="text-2xl font-semibold mb-1">
              {accountData.activation_used} <span className="text-text-muted text-base font-normal">/ {accountData.activation_limit}</span>
            </p>
            {accountData.activations.length === 0 ? (
              <p className="text-text-muted text-sm mt-2">No devices yet. Install Mix Bridge to add one.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {accountData.activations.slice(0, 3).map((a) => (
                  <li key={a.device_id} className="text-sm text-text-secondary flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-text-muted shrink-0">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    <span className="text-text truncate">{a.display_name || a.device_id.slice(0, 12) + '…'}</span>
                  </li>
                ))}
                {accountData.activations.length > 3 && (
                  <li className="text-text-muted text-xs">+{accountData.activations.length - 3} more</li>
                )}
              </ul>
            )}
          </div>

          {/* License key card — full width */}
          {accountData.license_key && (
            <div className="glass-card p-6 md:col-span-2">
              <h2 className="font-medium mb-1">License Key</h2>
              <p className="text-text-muted text-sm mb-4">
                Enter this key with your email when activating Mix Bridge on a new system.
              </p>
              <div className="flex items-center gap-3">
                <code className="flex-1 px-4 py-3 rounded-lg bg-white/[0.03] border text-text font-mono tracking-widest text-center text-lg select-all" style={{ borderColor: 'var(--border)' }}>
                  {accountData.license_key}
                </code>
                <button
                  onClick={() => { void navigator.clipboard.writeText(accountData.license_key!); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000); }}
                  className="shrink-0 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: keyCopied ? 'var(--accent)' : 'var(--surface)', color: keyCopied ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  {keyCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

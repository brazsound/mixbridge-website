import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const inputClass =
  'w-full px-4 py-2.5 rounded-[var(--radius)] bg-white/[0.03] border text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-colors border-[rgba(255,255,255,0.08)]';

const quickLinks = [
  {
    to: '/account/download',
    title: 'Download Mix Bridge',
    body: 'Get the latest macOS build and install it in seconds.',
  },
  {
    to: '/account/feedback',
    title: 'Send feedback',
    body: 'Report a bug or request a feature — we read every message.',
  },
  {
    to: '/account/settings',
    title: 'Account settings',
    body: 'Update your name, email, or password.',
  },
];

export function AccountDashboard() {
  const { user, setPasswordWithoutCurrent } = useAuth();

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

      <div className="grid gap-5 md:grid-cols-3">
        {quickLinks.map((c) => (
          <Link key={c.to} to={c.to} className="glass-card p-6 transition-colors hover:bg-white/[0.03]">
            <h2 className="font-medium mb-1">{c.title}</h2>
            <p className="text-text-muted text-sm">{c.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

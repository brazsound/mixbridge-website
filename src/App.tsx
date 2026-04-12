import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Features } from './components/Features';
import { Pricing } from './components/Pricing';
import { FAQ } from './components/FAQ';
import { Download } from './components/Download';
import { Footer } from './components/Footer';
import { AccountLayout } from './components/AccountLayout';
import { AccountAuthGate } from './pages/AccountPage';
import { AccountDashboard } from './pages/AccountDashboard';
import { AccountDownload } from './pages/AccountDownload';
import { AccountFeedback } from './pages/AccountFeedback';
import { AccountSubscription } from './pages/AccountSubscription';
import { DevicesPage } from './pages/DevicesPage';
import { AccountSettings } from './pages/AccountSettings';
import { AdminPage } from './pages/AdminPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';

function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <Download />
      <Footer />
    </>
  );
}

function SetPasswordModal() {
  const { setPasswordWithoutCurrent, updatePassword, signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [needsCurrent, setNeedsCurrent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    let result: { error?: string };
    if (needsCurrent) {
      result = await updatePassword(current, password);
    } else {
      result = await setPasswordWithoutCurrent(password);
      if (result.error?.toLowerCase().includes('current password')) {
        setNeedsCurrent(true);
        setError('This account already has a password. Please enter your current password above.');
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl" style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {done ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-xl font-semibold mb-2">Password set!</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>You're all set. Welcome to Mix Bridge.</p>
            <button
              className="btn-accent w-full py-2.5 rounded-lg font-medium"
              onClick={() => window.location.replace('/account')}
            >
              Go to my account
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-1">Welcome to Mix Bridge</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Set a password to secure your account before continuing.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {needsCurrent && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Current password</label>
                  <input
                    type="password"
                    value={current}
                    onChange={e => setCurrent(e.target.value)}
                    placeholder="Your existing password"
                    required
                    autoFocus
                    className="px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)' }}
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  autoFocus
                  className="px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)' }}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="btn-accent py-2.5 rounded-lg font-medium text-sm mt-1"
              >
                {busy ? 'Setting password…' : 'Set password & continue'}
              </button>
            </form>
            <button
              onClick={() => signOut()}
              className="w-full mt-3 text-xs text-center"
              style={{ color: 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ResetPasswordModal() {
  const { setPasswordWithoutCurrent, clearPasswordReset, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    const result = await setPasswordWithoutCurrent(password);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setDone(true);
    clearPasswordReset();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl" style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {done ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-xl font-semibold mb-2">Password updated!</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Your new password has been saved.</p>
            <button
              className="btn-accent w-full py-2.5 rounded-lg font-medium"
              onClick={() => window.location.replace('/account')}
            >
              Go to my account
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-1">Reset your password</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Choose a new password for your account.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  autoFocus
                  className="px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)' }}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="btn-accent py-2.5 rounded-lg font-medium text-sm mt-1"
              >
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </form>
            <button
              onClick={() => signOut()}
              className="w-full mt-3 text-xs text-center"
              style={{ color: 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="pt-24 flex justify-center"><p className="text-text-muted">Loading…</p></div>;
  if (!user) return <AccountAuthGate />;
  return <>{children}</>;
}

function AppInner() {
  const { needsPasswordSetup, needsPasswordReset } = useAuth();
  return (
    <>
      <Nav />
      {needsPasswordReset && <ResetPasswordModal />}
      {!needsPasswordReset && needsPasswordSetup && <SetPasswordModal />}
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* Account dashboard — requires auth */}
        <Route
          path="/account"
          element={
            <RequireAuth>
              <AccountLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AccountDashboard />} />
          <Route path="download" element={<AccountDownload />} />
          <Route path="feedback" element={<AccountFeedback />} />
          <Route path="subscription" element={<AccountSubscription />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="settings" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="/account" replace />} />
        </Route>

        <Route path="/admin" element={<AdminPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-bg text-text">
          <AppInner />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

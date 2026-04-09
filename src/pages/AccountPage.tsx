import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Nav } from '@/components/Nav';
import { AccountProfileSection } from '@/components/AccountProfileSection';
import { Link } from 'react-router-dom';

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent';

const API_URL = import.meta.env.VITE_LICENSE_API_URL ?? '';

/** Matches backend `list-activations` when the signed-in email has no NFR or Paddle row */
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

function parseAuthHashError(): string | null {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw || !raw.includes('error=')) return null;
  const params = new URLSearchParams(raw);
  const code = params.get('error_code');
  const desc = params.get('error_description');
  if (code === 'otp_expired') {
    return 'That sign-in link has expired or was already used. Request a new link below.';
  }
  if (desc) {
    return decodeURIComponent(desc.replace(/\+/g, ' '));
  }
  return 'Sign-in failed. Please try again.';
}

type AuthPanel = 'signin' | 'signup';

export function AccountPage() {
  const {
    user,
    session,
    loading: authLoading,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    resetPasswordForEmail,
    signOut,
  } = useAuth();
  const [authPanel, setAuthPanel] = useState<AuthPanel>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirm, setSignUpConfirm] = useState('');
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [authHashError, setAuthHashError] = useState<string | null>(null);
  const [signInSent, setSignInSent] = useState(false);
  const [signUpConfirmSent, setSignUpConfirmSent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    const fromHash = parseAuthHashError();
    if (fromHash) {
      setAuthHashError(fromHash);
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  useEffect(() => {
    if (!session?.access_token || !API_URL) {
      setFetchError(
        !API_URL
          ? 'License server URL is not configured for this site build.'
          : null
      );
      return;
    }

    setDataLoading(true);
    setFetchError(null);
    fetch(`${API_URL.replace(/\/$/, '')}/api/web/list-activations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        let data: AccountData;
        try {
          data = (await res.json()) as AccountData;
        } catch {
          setAccountData(null);
          setFetchError('Invalid response from the license server.');
          return;
        }
        if (!res.ok) {
          setAccountData(null);
          setFetchError(data.error ?? `Could not load account (${res.status}). Try signing out and back in.`);
          return;
        }
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
        setFetchError(
          'Could not reach the license server. Check your connection, disable strict blocking for this page, or try again in a moment.'
        );
      })
      .finally(() => setDataLoading(false));
  }, [session?.access_token]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    const result = await signInWithEmail(email);
    if (result.error) {
      setSignInError(result.error);
    } else {
      setSignInSent(true);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    const result = await signInWithPassword(email, password);
    if (result.error) setSignInError(result.error);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    setForgotMessage(null);
    const result = await resetPasswordForEmail(email);
    if (result.error) {
      setSignInError(result.error);
      return;
    }
    setForgotMessage('If an account exists for that email, we sent a reset link.');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    if (signUpPassword !== signUpConfirm) {
      setSignInError('Passwords do not match.');
      return;
    }
    const result = await signUpWithPassword(email, signUpPassword);
    if (result.error) {
      setSignInError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setSignUpConfirmSent(true);
      return;
    }
    setEmail('');
    setSignUpPassword('');
    setSignUpConfirm('');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="pt-24 flex justify-center">
          <p className="text-text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="pt-32 px-6 max-w-md mx-auto pb-20">
          <h1 className="text-2xl font-semibold mb-2">Account</h1>
          <p className="text-text-secondary mb-8">
            Manage your license and devices from anywhere.
          </p>

          {authHashError && (
            <div
              className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              role="alert"
            >
              {authHashError}
            </div>
          )}

          {signUpConfirmSent ? (
            <div className="glass-card p-6 space-y-2">
              <p className="text-text-secondary">Check your email to confirm your account.</p>
              <p className="text-text-muted text-sm">
                After you confirm, you can sign in with your email and password.
              </p>
              <button
                type="button"
                className="text-sm text-accent hover:underline mt-4"
                onClick={() => {
                  setSignUpConfirmSent(false);
                  setAuthPanel('signin');
                  setSignInError(null);
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : signInSent ? (
            <div className="glass-card p-6">
              <p className="text-text-secondary">
                We sent you a link. Check your inbox and click it to sign in.
              </p>
              <p className="text-text-muted text-sm mt-2">
                Can&apos;t find it? Check spam or try again.
              </p>
            </div>
          ) : (
            <div className="glass-card p-6 space-y-6">
              <div className="flex rounded-lg p-0.5 bg-black/25 border border-white/10">
                {(['signin', 'signup'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setAuthPanel(key);
                      setSignInError(null);
                      setShowForgotPassword(false);
                      setForgotMessage(null);
                      setShowMagicLink(false);
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      authPanel === key
                        ? 'bg-white/10 text-text'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {key === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              {authPanel === 'signin' && !showForgotPassword && !showMagicLink && (
                <form onSubmit={handlePasswordSignIn} className="space-y-4">
                  <div>
                    <label htmlFor="si-email" className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    <input
                      id="si-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="si-password" className="block text-sm font-medium mb-2">
                      Password
                    </label>
                    <input
                      id="si-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClass}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  {signInError && <p className="text-amber-400 text-sm">{signInError}</p>}
                  <button type="submit" className="btn-accent w-full">
                    Sign in
                  </button>
                  <button
                    type="button"
                    className="text-sm text-text-muted hover:text-text-secondary w-full text-center"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setSignInError(null);
                      setForgotMessage(null);
                    }}
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    className="text-sm text-text-muted hover:text-text-secondary w-full text-center"
                    onClick={() => {
                      setShowMagicLink(true);
                      setSignInError(null);
                    }}
                  >
                    Sign in with email link instead
                  </button>
                </form>
              )}

              {authPanel === 'signin' && showMagicLink && !signInSent && (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <p className="text-text-muted text-sm">
                    We&apos;ll email you a one-time link—no password needed.
                  </p>
                  <div>
                    <label htmlFor="magic-email" className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    <input
                      id="magic-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                      required
                      autoComplete="email"
                    />
                  </div>
                  {signInError && <p className="text-amber-400 text-sm">{signInError}</p>}
                  <button type="submit" className="btn-accent w-full">
                    Send sign-in link
                  </button>
                  <button
                    type="button"
                    className="text-sm text-text-muted hover:text-text-secondary w-full text-center"
                    onClick={() => {
                      setShowMagicLink(false);
                      setSignInError(null);
                    }}
                  >
                    Use password instead
                  </button>
                </form>
              )}

              {authPanel === 'signin' && showForgotPassword && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-text-muted text-sm">
                    Enter your email and we&apos;ll send a link to choose a new password.
                  </p>
                  <div>
                    <label htmlFor="fp-email" className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    <input
                      id="fp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                      required
                      autoComplete="email"
                    />
                  </div>
                  {signInError && <p className="text-amber-400 text-sm">{signInError}</p>}
                  {forgotMessage && <p className="text-emerald-400/90 text-sm">{forgotMessage}</p>}
                  <button type="submit" className="btn-accent w-full">
                    Send reset link
                  </button>
                  <button
                    type="button"
                    className="text-sm text-text-muted hover:text-text-secondary w-full text-center"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setSignInError(null);
                      setForgotMessage(null);
                    }}
                  >
                    Back to sign in
                  </button>
                </form>
              )}

              {authPanel === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <p className="text-text-muted text-sm">
                    Your email will be used as your display name until you change it in account settings.
                  </p>
                  <div>
                    <label htmlFor="su-email" className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    <input
                      id="su-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="su-password" className="block text-sm font-medium mb-2">
                      Password
                    </label>
                    <input
                      id="su-password"
                      type="password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className={inputClass}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label htmlFor="su-confirm" className="block text-sm font-medium mb-2">
                      Confirm password
                    </label>
                    <input
                      id="su-confirm"
                      type="password"
                      value={signUpConfirm}
                      onChange={(e) => setSignUpConfirm(e.target.value)}
                      placeholder="••••••"
                      className={inputClass}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  {signInError && <p className="text-amber-400 text-sm">{signInError}</p>}
                  <button type="submit" className="btn-accent w-full">
                    Create account
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />
      <div className="pt-24 px-6 max-w-2xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Account</h1>
          <button
            onClick={() => signOut()}
            className="text-sm text-text-secondary hover:text-text transition-colors"
          >
            Sign out
          </button>
        </div>

        {fetchError && (
          <div
            className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            role="alert"
          >
            {fetchError}
          </div>
        )}

        {dataLoading ? (
          <p className="text-text-muted">Loading license…</p>
        ) : !fetchError && accountData ? (
          <div className="space-y-6 mb-8">
            <div className="glass-card p-6">
              <h2 className="font-medium mb-4">Subscription</h2>
              {accountData.error === NO_LICENSE_FOR_EMAIL ? (
                <div
                  className="rounded-lg px-4 py-3 text-sm space-y-2"
                  style={{ background: 'rgba(255,200,0,0.07)', border: '1px solid rgba(255,200,0,0.15)', color: '#ffd560' }}
                >
                  <p>
                    No license is linked to <strong className="text-text">{user.email}</strong> in our system.
                  </p>
                  <p className="text-text-secondary" style={{ color: 'rgba(245,245,247,0.65)' }}>
                    Use the <strong className="text-text">same email</strong> you used for NFR or checkout. If the app activated under a different address, sign out here and sign in with that email.
                  </p>
                </div>
              ) : accountData.error ? (
                <div
                  className="rounded-lg px-4 py-3 text-sm text-amber-200"
                  style={{ background: 'rgba(255,200,0,0.07)', border: '1px solid rgba(255,200,0,0.15)' }}
                >
                  {accountData.error}
                </div>
              ) : !accountData.status ? (
                <div
                  className="rounded-lg px-4 py-4 flex flex-col gap-2"
                  style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.15)' }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    No active license
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Your account is ready. Billing opens soon — check back here to purchase a licence when it's live.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-text-secondary">
                  <p>
                    Status:{' '}
                    <span className="text-text capitalize">
                      {accountData.status === 'free' ? 'NFR' : accountData.status}
                    </span>
                  </p>
                  {accountData.tier && (
                    <p>
                      Plan: <span className="text-text capitalize">{accountData.tier}</span>
                    </p>
                  )}
                  <p>
                    Devices: {accountData.activation_used} / {accountData.activation_limit}
                  </p>
                </div>
              )}
            </div>

            {accountData.license_key && (
              <div className="glass-card p-6">
                <h2 className="font-medium mb-1">License Key</h2>
                <p className="text-text-muted text-sm mb-4">
                  Enter this key together with your email when activating Mix Bridge on a new Mac.
                </p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-text font-mono tracking-widest text-center text-lg select-all">
                    {accountData.license_key}
                  </code>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(accountData.license_key!);
                      setKeyCopied(true);
                      setTimeout(() => setKeyCopied(false), 2000);
                    }}
                    className="shrink-0 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: keyCopied ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      color: keyCopied ? 'white' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {keyCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium">Activated devices</h2>
                <Link
                  to="/account/devices"
                  className="text-sm text-accent hover:text-accent-hover"
                >
                  Manage
                </Link>
              </div>
              {accountData.activations.length === 0 ? (
                <p className="text-text-muted text-sm">
                  No devices yet. Install Mix Bridge on your Mac and sign in to add one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {accountData.activations.slice(0, 3).map((a) => (
                    <li
                      key={a.device_id}
                      className="text-sm text-text-secondary flex items-center gap-2"
                    >
                      <span className="text-text">
                        {a.display_name || a.device_id.slice(0, 12) + '…'}
                      </span>
                    </li>
                  ))}
                  {accountData.activations.length > 3 && (
                    <li className="text-text-muted text-sm">
                      +{accountData.activations.length - 3} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <AccountProfileSection />
      </div>
    </div>
  );
}

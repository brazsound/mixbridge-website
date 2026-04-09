import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Nav } from '@/components/Nav';
import { Link } from 'react-router-dom';

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

export function AccountPage() {
  const { user, session, loading: authLoading, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [authHashError, setAuthHashError] = useState<string | null>(null);
  const [signInSent, setSignInSent] = useState(false);
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    const result = await signInWithEmail(email);
    if (result.error) {
      setSignInError(result.error);
    } else {
      setSignInSent(true);
    }
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
        <div className="pt-32 px-6 max-w-md mx-auto">
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

          {signInSent ? (
            <div className="glass-card p-6">
              <p className="text-text-secondary">
                We sent you a link. Check your inbox and click it to sign in.
              </p>
              <p className="text-text-muted text-sm mt-2">
                Can&apos;t find it? Check spam or try again.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="glass-card p-6">
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
              {signInError && (
                <p className="text-amber-400 text-sm mt-2">{signInError}</p>
              )}
              <button type="submit" className="btn-accent w-full mt-4">
                Send sign-in link
              </button>
            </form>
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

        <p className="text-text-secondary mb-6">{user.email}</p>

        {fetchError && (
          <div
            className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            role="alert"
          >
            {fetchError}
          </div>
        )}

        {dataLoading ? (
          <p className="text-text-muted">Loading…</p>
        ) : !fetchError && accountData ? (
          <div className="space-y-6">
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
      </div>
    </div>
  );
}

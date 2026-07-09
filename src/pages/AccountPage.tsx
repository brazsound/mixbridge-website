import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
const inputClass =
  'w-full px-4 py-2.5 rounded-[var(--radius)] bg-white/[0.03] border text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-colors'
  + ' ' + 'border-[rgba(255,255,255,0.08)]';

function parseAuthHashError(): string | null {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw || !raw.includes('error=')) return null;
  const params = new URLSearchParams(raw);
  const code = params.get('error_code');
  const desc = params.get('error_description');
  if (code === 'otp_expired') return 'That sign-in link has expired or was already used. Request a new link below.';
  if (desc) return decodeURIComponent(desc.replace(/\+/g, ' '));
  return 'Sign-in failed. Please try again.';
}

type AuthPanel = 'signin' | 'signup';

export function AccountAuthGate() {
  const {
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    resetPasswordForEmail,
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

  useEffect(() => {
    const fromHash = parseAuthHashError();
    if (fromHash) {
      setAuthHashError(fromHash);
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    const result = await signInWithEmail(email);
    if (result.error) setSignInError(result.error);
    else setSignInSent(true);
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
    if (result.error) { setSignInError(result.error); return; }
    setForgotMessage('If an account exists for that email, we sent a reset link.');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    if (signUpPassword !== signUpConfirm) { setSignInError('Passwords do not match.'); return; }
    const result = await signUpWithPassword(email, signUpPassword);
    if (result.error) { setSignInError(result.error); return; }
    if (result.needsEmailConfirmation) { setSignUpConfirmSent(true); return; }
    setEmail(''); setSignUpPassword(''); setSignUpConfirm('');
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="pt-28 px-6 max-w-md mx-auto pb-20">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Account</h1>
        <p className="text-text-muted text-sm mb-2">Sign in to download MixBridge and manage your account.</p>
        <p className="text-text-muted text-xs mb-8">No spam, and we never sell your data. MixBridge is completely free, and your account just helps us keep track of your feedback.</p>

        {authHashError && (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
            {authHashError}
          </div>
        )}

        {signUpConfirmSent ? (
          <div className="glass-card p-6 space-y-2">
            <p className="text-text-secondary">Check your email to confirm your account.</p>
            <p className="text-text-muted text-sm">After you confirm, you can sign in with your email and password.</p>
            <button type="button" className="text-sm text-accent hover:underline mt-4" onClick={() => { setSignUpConfirmSent(false); setAuthPanel('signin'); setSignInError(null); }}>
              Back to sign in
            </button>
          </div>
        ) : signInSent ? (
          <div className="glass-card p-6 space-y-4">
            <p className="text-text-secondary">We sent you a link. Check your inbox and click it to sign in.</p>
            <p className="text-text-muted text-sm">{"Can't find it? Check spam, or use the options below."}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="text-sm text-accent hover:underline" onClick={() => { setSignInSent(false); setSignInError(null); void signInWithEmail(email).then((r) => { if (r.error) setSignInError(r.error); else setSignInSent(true); }); }}>
                Resend link
              </button>
              <button type="button" className="text-sm text-text-muted hover:text-text-secondary" onClick={() => { setSignInSent(false); setShowMagicLink(false); setSignInError(null); }}>
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card p-6 space-y-6">
            <div className="flex rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              {(['signin', 'signup'] as const).map((key) => (
                <button key={key} type="button" onClick={() => { setAuthPanel(key); setSignInError(null); setShowForgotPassword(false); setForgotMessage(null); setShowMagicLink(false); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${authPanel === key ? 'bg-white/[0.07] text-text' : 'text-text-muted hover:text-text-secondary'}`}>
                  {key === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            {authPanel === 'signin' && !showForgotPassword && !showMagicLink && (
              <form onSubmit={handlePasswordSignIn} className="space-y-4">
                <div>
                  <label htmlFor="si-email" className="block text-sm font-medium mb-2">Email</label>
                  <input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required autoComplete="email" />
                </div>
                <div>
                  <label htmlFor="si-password" className="block text-sm font-medium mb-2">Password</label>
                  <input id="si-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} required autoComplete="current-password" />
                </div>
                {signInError && <p className="text-amber-400 text-sm">{signInError}</p>}
                <button type="submit" className="btn-accent w-full">Sign in</button>
                <button type="button" className="text-sm text-text-muted hover:text-text-secondary w-full text-center" onClick={() => { setShowForgotPassword(true); setSignInError(null); setForgotMessage(null); }}>Forgot password?</button>
                <button type="button" className="text-sm text-text-muted hover:text-text-secondary w-full text-center" onClick={() => { setShowMagicLink(true); setSignInError(null); }}>Sign in with email link instead</button>
              </form>
            )}

            {authPanel === 'signin' && showMagicLink && !signInSent && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <p className="text-text-muted text-sm">We'll email you a one-time link. No password needed.</p>
                <div>
                  <label htmlFor="magic-email" className="block text-sm font-medium mb-2">Email</label>
                  <input id="magic-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required autoComplete="email" />
                </div>
                {signInError && <p className="text-amber-400 text-sm">{signInError}</p>}
                <button type="submit" className="btn-accent w-full">Send sign-in link</button>
                <button type="button" className="text-sm text-text-muted hover:text-text-secondary w-full text-center" onClick={() => { setShowMagicLink(false); setSignInError(null); }}>Use password instead</button>
              </form>
            )}

            {authPanel === 'signin' && showForgotPassword && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-text-muted text-sm">{"Enter your email and we'll send a link to choose a new password."}</p>
                <div>
                  <label htmlFor="fp-email" className="block text-sm font-medium mb-2">Email</label>
                  <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required autoComplete="email" />
                </div>
                {signInError && <p className="text-amber-400 text-sm">{signInError}</p>}
                {forgotMessage && <p className="text-emerald-400/90 text-sm">{forgotMessage}</p>}
                <button type="submit" className="btn-accent w-full">Send reset link</button>
                <button type="button" className="text-sm text-text-muted hover:text-text-secondary w-full text-center" onClick={() => { setShowForgotPassword(false); setSignInError(null); setForgotMessage(null); }}>Back to sign in</button>
              </form>
            )}

            {authPanel === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <p className="text-text-muted text-sm">Your email will be used as your display name until you change it in account settings.</p>
                <div>
                  <label htmlFor="su-email" className="block text-sm font-medium mb-2">Email</label>
                  <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required autoComplete="email" />
                </div>
                <div>
                  <label htmlFor="su-password" className="block text-sm font-medium mb-2">Password</label>
                  <input id="su-password" type="password" value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} placeholder="At least 6 characters" className={inputClass} required minLength={6} autoComplete="new-password" />
                </div>
                <div>
                  <label htmlFor="su-confirm" className="block text-sm font-medium mb-2">Confirm password</label>
                  <input id="su-confirm" type="password" value={signUpConfirm} onChange={(e) => setSignUpConfirm(e.target.value)} placeholder="••••••" className={inputClass} required minLength={6} autoComplete="new-password" />
                </div>
                {signInError && <p className="text-amber-400 text-sm">{signInError}</p>}
                <button type="submit" className="btn-accent w-full">Create account</button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

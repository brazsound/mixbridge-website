import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const inputClass =
  'w-full px-4 py-2.5 rounded-[var(--radius)] bg-white/[0.03] border text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-colors border-[rgba(255,255,255,0.08)]';

type SettingsModal = 'name' | 'email' | 'password' | 'delete';

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ModalShell({ title, onClose, children }: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first input, not the first focusable (avoids focusing a button)
    requestAnimationFrame(() => {
      const input = dialogRef.current?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled])');
      (input ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, []); // runs only on mount/unmount — stable

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} role="presentation" onClick={onClose}>
      <div ref={dialogRef} className="w-full max-w-md max-h-[min(90vh,640px)] overflow-y-auto rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.1)' }} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="settings-modal-title" className="font-medium text-lg mb-5">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const menuBtnClass =
  'w-full sm:w-auto text-left px-4 py-2 rounded-[var(--radius)] text-sm font-medium transition-colors text-text-muted hover:bg-white/[0.04] hover:text-text-secondary'
  + ' ' + 'border border-[rgba(255,255,255,0.08)] bg-[var(--surface)]';

export function AccountSettings() {
  const { user, updateProfile, updatePassword, setPasswordWithoutCurrent, updateEmail, resetPasswordForEmail, updateBetaOptIn, deleteAccount } = useAuth();
  // True if the user has ever set a password (has an 'email' identity provider)
  const hasPassword = user?.identities?.some(id => id.provider === 'email') ?? false;
  const [modal, setModal] = useState<SettingsModal | null>(null);

  const [fullName, setFullName] = useState('');
  useEffect(() => {
    const meta = user?.user_metadata as { full_name?: string } | undefined;
    const fromMeta = meta?.full_name;
    if (typeof fromMeta === 'string' && fromMeta.length > 0) setFullName(fromMeta);
    else if (user?.email) setFullName(user.email);
    else setFullName('');
  }, [user?.user_metadata, user?.email]);

  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [firstPassword, setFirstPassword] = useState('');
  const [firstPasswordConfirm, setFirstPasswordConfirm] = useState('');
  const [firstPwdErr, setFirstPwdErr] = useState<string | null>(null);
  const [firstPwdMsg, setFirstPwdMsg] = useState<string | null>(null);
  const [firstPwdBusy, setFirstPwdBusy] = useState(false);
  const [resetLinkMsg, setResetLinkMsg] = useState<string | null>(null);
  const [resetLinkBusy, setResetLinkBusy] = useState(false);

  const betaOptIn = (user?.user_metadata as { beta_opt_in?: boolean } | undefined)?.beta_opt_in === true;
  const [betaBusy, setBetaBusy] = useState(false);
  const [betaMsg, setBetaMsg] = useState<string | null>(null);

  const handleBetaToggle = async () => {
    setBetaBusy(true); setBetaMsg(null);
    const { error } = await updateBetaOptIn(!betaOptIn);
    setBetaBusy(false);
    if (error) { setBetaMsg(error); return; }
    setBetaMsg(!betaOptIn ? 'You are now enrolled in the Beta Program.' : 'You have left the Beta Program.');
    setTimeout(() => setBetaMsg(null), 3000);
  };

  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const openModal = (m: SettingsModal) => {
    setModal(m);
    setProfileErr(null); setEmailErr(null); setPasswordErr(null); setPasswordMsg(null);
    if (m === 'password') {
      setFirstPwdErr(null); setFirstPwdMsg(null); setFirstPassword(''); setFirstPasswordConfirm('');
      setResetLinkMsg(null); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
    if (m === 'delete') {
      setDeleteConfirmEmail(''); setDeleteErr(null);
    }
  };
  const closeModal = () => setModal(null);

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmEmail.trim().toLowerCase() !== user?.email?.toLowerCase()) {
      setDeleteErr('Email does not match. Please type your exact email address.');
      return;
    }
    setDeleteErr(null);
    setDeleteBusy(true);
    const { error } = await deleteAccount();
    setDeleteBusy(false);
    if (error) { setDeleteErr(error); return; }
    // Account deleted — navigate away
    window.location.href = '/';
  };

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setProfileErr(null); setProfileMsg(null); setProfileBusy(true);
    const { error } = await updateProfile(fullName); setProfileBusy(false);
    if (error) { setProfileErr(error); return; }
    setProfileMsg('Display name saved.');
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setEmailErr(null); setEmailMsg(null);
    const trimmed = newEmail.trim().toLowerCase();
    if (trimmed === user?.email?.toLowerCase()) { setEmailErr('That is already your email.'); return; }
    setEmailBusy(true);
    const { error } = await updateEmail(trimmed); setEmailBusy(false);
    if (error) { setEmailErr(error); return; }
    setNewEmail('');
    setEmailMsg('Confirmation links were sent. Check your current inbox and the new address to finish the change.');
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPasswordErr(null); setPasswordMsg(null);
    if (newPassword !== confirmPassword) { setPasswordErr('New passwords do not match.'); return; }
    setPasswordBusy(true);
    const { error } = await updatePassword(currentPassword, newPassword); setPasswordBusy(false);
    if (error) { setPasswordErr(error); return; }
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setPasswordMsg('Password updated.');
  };

  const handleFirstPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setFirstPwdErr(null); setFirstPwdMsg(null); setResetLinkMsg(null);
    if (firstPassword !== firstPasswordConfirm) { setFirstPwdErr('Passwords do not match.'); return; }
    setFirstPwdBusy(true);
    const { error } = await setPasswordWithoutCurrent(firstPassword); setFirstPwdBusy(false);
    if (error) { setFirstPwdErr(error); return; }
    setFirstPwdMsg('Password saved. You can sign in with your email and password next time.');
    setFirstPassword(''); setFirstPasswordConfirm('');
  };

  const handlePasswordResetEmail = async () => {
    if (!user?.email) return;
    setResetLinkMsg(null); setFirstPwdErr(null); setResetLinkBusy(true);
    const { error } = await resetPasswordForEmail(user.email); setResetLinkBusy(false);
    if (error) { setFirstPwdErr(error); return; }
    setResetLinkMsg('Check your email and open the link. Then choose a new password on this page.');
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Account & Security</h1>
      <p className="text-text-muted text-sm mb-8">Manage your profile, email, and password.</p>

      {/* Account information */}
      <div className="glass-card p-6 max-w-lg mb-6">
        <h2 className="font-medium mb-4">Account Information</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Name</p>
              <p className="text-sm text-text">
                {(user?.user_metadata as { full_name?: string })?.full_name || user?.email}
              </p>
            </div>
            <button type="button" onClick={() => openModal('name')} className="text-xs text-accent hover:underline">Edit</button>
          </div>
          <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Email</p>
              <p className="text-sm text-text">{user?.email}</p>
            </div>
            <button type="button" onClick={() => openModal('email')} className="text-xs text-accent hover:underline">Edit</button>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-text-muted text-[11px] mb-0.5">Password</p>
              <p className="text-sm text-text-muted">{hasPassword ? 'Change your password' : 'Create or change your password'}</p>
            </div>
            <button type="button" onClick={() => openModal('password')} className="text-xs text-accent hover:underline">Manage</button>
          </div>
        </div>
      </div>

      {/* Beta Program */}
      <div className="glass-card p-6 max-w-lg mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="font-medium mb-1">Beta Program</h2>
            <p className="text-text-muted text-sm">
              Get early access to pre-release versions before they are publicly available. Beta builds may have bugs or incomplete features.
            </p>
            {betaMsg && (
              <p className="text-emerald-400/90 text-sm mt-2">{betaMsg}</p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={betaOptIn}
            disabled={betaBusy}
            onClick={() => void handleBetaToggle()}
            className="relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 mt-0.5"
            style={{ background: betaOptIn ? 'var(--accent)' : 'rgba(255,255,255,0.12)' }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: betaOptIn ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>
        {betaOptIn && (
          <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
            You are enrolled. Pre-release versions will appear on your Download page.
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 max-w-lg" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
        <h2 className="font-medium mb-1 text-red-400">Danger Zone</h2>
        <p className="text-text-muted text-sm mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button
          type="button"
          className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
          onClick={() => openModal('delete')}
        >
          Delete account
        </button>
      </div>

      {/* Modals */}
      {modal === 'name' && (
        <ModalShell title="Display name" onClose={closeModal}>
          <form onSubmit={handleProfile} className="space-y-3">
            <p className="text-text-muted text-xs">Starts as your email; change anytime. Not used for licensing.</p>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={user?.email ?? 'Display name'} className={inputClass} autoComplete="name" />
            {profileErr && <p className="text-amber-400 text-sm">{profileErr}</p>}
            {profileMsg && <p className="text-emerald-400/90 text-sm">{profileMsg}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" disabled={profileBusy} className="btn-accent text-sm py-2 px-4">{profileBusy ? 'Saving…' : 'Save name'}</button>
              <button type="button" onClick={closeModal} className={menuBtnClass}>Done</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'email' && (
        <ModalShell title="Change email" onClose={closeModal}>
          <form onSubmit={handleEmail} className="space-y-3">
            <p className="text-text-muted text-xs">Secure email change: confirm from both your current and new inbox.</p>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" className={inputClass} autoComplete="email" />
            {emailErr && <p className="text-amber-400 text-sm">{emailErr}</p>}
            {emailMsg && <p className="text-emerald-400/90 text-sm">{emailMsg}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" disabled={emailBusy} className="btn-accent text-sm py-2 px-4">{emailBusy ? 'Updating…' : 'Update email'}</button>
              <button type="button" onClick={closeModal} className={menuBtnClass}>Done</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'delete' && (
        <ModalShell title="Delete account" onClose={closeModal}>
          <div className="space-y-4">
            <div className="rounded-xl px-4 py-3 text-sm space-y-1" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="font-medium text-red-400">This cannot be undone.</p>
              <p className="text-text-muted text-xs leading-relaxed">
                Your account, license, and all activated devices will be permanently removed. You will lose access immediately.
              </p>
            </div>
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <div>
                <label htmlFor="delete-confirm-email" className="block text-sm font-medium mb-2">
                  Type your email to confirm
                </label>
                <input
                  id="delete-confirm-email"
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(e) => { setDeleteConfirmEmail(e.target.value); setDeleteErr(null); }}
                  placeholder={user?.email ?? 'your@email.com'}
                  className={inputClass}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              {deleteErr && <p className="text-red-400 text-sm">{deleteErr}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={deleteBusy || deleteConfirmEmail.trim().toLowerCase() !== user?.email?.toLowerCase()}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteBusy ? 'Deleting…' : 'Delete my account permanently'}
                </button>
                <button type="button" onClick={closeModal} className={menuBtnClass}>Cancel</button>
              </div>
            </form>
          </div>
        </ModalShell>
      )}

      {modal === 'password' && (
        <ModalShell title="Password" onClose={closeModal}>
          <div className="space-y-8">
            {!hasPassword && (
              <form onSubmit={handleFirstPassword} className="space-y-3">
                <h3 className="text-sm font-medium text-text-secondary">Create a password</h3>
                <p className="text-text-muted text-xs">If you usually sign in with an email link, set a password here.</p>
                <input type="password" value={firstPassword} onChange={(e) => setFirstPassword(e.target.value)} placeholder="New password" className={inputClass} autoComplete="new-password" minLength={6} />
                <input type="password" value={firstPasswordConfirm} onChange={(e) => setFirstPasswordConfirm(e.target.value)} placeholder="Confirm new password" className={inputClass} autoComplete="new-password" minLength={6} />
                {firstPwdErr && <p className="text-amber-400 text-sm">{firstPwdErr}</p>}
                {firstPwdMsg && <p className="text-emerald-400/90 text-sm">{firstPwdMsg}</p>}
                {resetLinkMsg && <p className="text-emerald-400/90 text-sm">{resetLinkMsg}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="submit" disabled={firstPwdBusy} className="btn-accent text-sm py-2 px-4">{firstPwdBusy ? 'Saving…' : 'Save password'}</button>
                </div>
              </form>
            )}
            <form onSubmit={hasPassword ? handlePassword : handleFirstPassword} className={`space-y-3 ${!hasPassword ? 'pt-6' : ''}`} style={!hasPassword ? { borderTop: '1px solid var(--border)' } : {}}>
              {hasPassword && (
                <>
                  <h3 className="text-sm font-medium text-text-secondary">Change password</h3>
                  <p className="text-text-muted text-xs">Enter your current password, then choose a new one.</p>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className={inputClass} autoComplete="current-password" />
                </>
              )}
              {hasPassword && (
                <>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className={inputClass} autoComplete="new-password" minLength={6} />
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className={inputClass} autoComplete="new-password" minLength={6} />
                  {passwordErr && <p className="text-amber-400 text-sm">{passwordErr}</p>}
                  {passwordMsg && <p className="text-emerald-400/90 text-sm">{passwordMsg}</p>}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button type="submit" disabled={passwordBusy} className="btn-accent text-sm py-2 px-4">{passwordBusy ? 'Updating…' : 'Update password'}</button>
                    <button type="button" disabled={resetLinkBusy} onClick={() => void handlePasswordResetEmail()} className={menuBtnClass}>{resetLinkBusy ? 'Sending…' : 'Forgot password?'}</button>
                    <button type="button" onClick={closeModal} className={menuBtnClass}>Done</button>
                  </div>
                </>
              )}
            </form>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

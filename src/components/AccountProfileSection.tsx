import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent';

type SettingsModal = 'name' | 'email' | 'password';

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function ModalShell({ title, onClose, children }: ModalShellProps) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="glass-card p-6 w-full max-w-md max-h-[min(90vh,640px)] overflow-y-auto shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 id="account-settings-modal-title" className="font-medium text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text text-sm shrink-0 px-2 py-1 -mr-2 -mt-1 rounded-lg transition-colors"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const menuBtnClass =
  'w-full sm:w-auto text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-white/10 bg-white/[0.04] text-text-secondary hover:bg-white/[0.07] hover:text-text hover:border-white/15';

export function AccountProfileSection() {
  const { user, updateProfile, updatePassword, setPasswordWithoutCurrent, updateEmail, resetPasswordForEmail } =
    useAuth();

  const [modal, setModal] = useState<SettingsModal | null>(null);

  const [fullName, setFullName] = useState('');
  useEffect(() => {
    const meta = user?.user_metadata as { full_name?: string } | undefined;
    const fromMeta = meta?.full_name;
    if (typeof fromMeta === 'string' && fromMeta.length > 0) {
      setFullName(fromMeta);
    } else if (user?.email) {
      setFullName(user.email);
    } else {
      setFullName('');
    }
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

  const openModal = (m: SettingsModal) => {
    setModal(m);
    setProfileErr(null);
    setEmailErr(null);
    setPasswordErr(null);
    setPasswordMsg(null);
    if (m === 'password') {
      setFirstPwdErr(null);
      setFirstPwdMsg(null);
      setFirstPassword('');
      setFirstPasswordConfirm('');
      setResetLinkMsg(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const closeModal = () => setModal(null);

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErr(null);
    setProfileMsg(null);
    setProfileBusy(true);
    const { error } = await updateProfile(fullName);
    setProfileBusy(false);
    if (error) {
      setProfileErr(error);
      return;
    }
    setProfileMsg('Display name saved.');
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailErr(null);
    setEmailMsg(null);
    const trimmed = newEmail.trim().toLowerCase();
    if (trimmed === user?.email?.toLowerCase()) {
      setEmailErr('That is already your email.');
      return;
    }
    setEmailBusy(true);
    const { error } = await updateEmail(trimmed);
    setEmailBusy(false);
    if (error) {
      setEmailErr(error);
      return;
    }
    setNewEmail('');
    setEmailMsg(
      'Confirmation links were sent. Check your current inbox and the new address to finish the change.'
    );
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErr(null);
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordErr('New passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    const { error } = await updatePassword(currentPassword, newPassword);
    setPasswordBusy(false);
    if (error) {
      setPasswordErr(error);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMsg('Password updated.');
  };

  const handleFirstPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFirstPwdErr(null);
    setFirstPwdMsg(null);
    setResetLinkMsg(null);
    if (firstPassword !== firstPasswordConfirm) {
      setFirstPwdErr('Passwords do not match.');
      return;
    }
    setFirstPwdBusy(true);
    const { error } = await setPasswordWithoutCurrent(firstPassword);
    setFirstPwdBusy(false);
    if (error) {
      setFirstPwdErr(error);
      return;
    }
    setFirstPwdMsg('Password saved. You can sign in with your email and password next time.');
    setFirstPassword('');
    setFirstPasswordConfirm('');
  };

  const handlePasswordResetEmail = async () => {
    if (!user?.email) return;
    setResetLinkMsg(null);
    setFirstPwdErr(null);
    setResetLinkBusy(true);
    const { error } = await resetPasswordForEmail(user.email);
    setResetLinkBusy(false);
    if (error) {
      setFirstPwdErr(error);
      return;
    }
    setResetLinkMsg('Check your email and open the link. Then choose a new password on this page.');
  };

  return (
    <>
      <div className="glass-card p-6">
        <h2 className="font-medium mb-1">Account settings</h2>
        <p className="text-text-muted text-sm mb-4">
          Signed in as <span className="text-text-secondary">{user?.email}</span>
        </p>
        <p className="text-text-muted text-xs mb-4">
          Update your display name, email, or password when you need to.
        </p>
        <div className="flex flex-col gap-2">
          <button type="button" className={menuBtnClass} onClick={() => openModal('name')}>
            Display name
          </button>
          <button type="button" className={menuBtnClass} onClick={() => openModal('email')}>
            Change email
          </button>
          <button type="button" className={menuBtnClass} onClick={() => openModal('password')}>
            Password
          </button>
        </div>
      </div>

      {modal === 'name' && (
        <ModalShell title="Display name" onClose={closeModal}>
          <form onSubmit={handleProfile} className="space-y-3">
            <p className="text-text-muted text-xs">
              Starts as your email; change anytime. Not used for licensing.
            </p>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={user?.email ?? 'Display name'}
              className={inputClass}
              autoComplete="name"
            />
            {profileErr && <p className="text-amber-400 text-sm">{profileErr}</p>}
            {profileMsg && <p className="text-emerald-400/90 text-sm">{profileMsg}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" disabled={profileBusy} className="btn-accent text-sm py-2 px-4">
                {profileBusy ? 'Saving…' : 'Save name'}
              </button>
              <button type="button" onClick={closeModal} className={menuBtnClass}>
                Done
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'email' && (
        <ModalShell title="Change email" onClose={closeModal}>
          <form onSubmit={handleEmail} className="space-y-3">
            <p className="text-text-muted text-xs">
              Secure email change is on: confirm the update from both your current and new inbox.
            </p>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="New email address"
              className={inputClass}
              autoComplete="email"
            />
            {emailErr && <p className="text-amber-400 text-sm">{emailErr}</p>}
            {emailMsg && <p className="text-emerald-400/90 text-sm">{emailMsg}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" disabled={emailBusy} className="btn-accent text-sm py-2 px-4">
                {emailBusy ? 'Updating…' : 'Update email'}
              </button>
              <button type="button" onClick={closeModal} className={menuBtnClass}>
                Done
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'password' && (
        <ModalShell title="Password" onClose={closeModal}>
          <div className="space-y-8">
            <form onSubmit={handleFirstPassword} className="space-y-3">
              <h3 className="text-sm font-medium text-text-secondary">Create a password</h3>
              <p className="text-text-muted text-xs">
                If you usually sign in with an email link, set a password here so you can also use email + password
                on the sign-in page.
              </p>
              <input
                type="password"
                value={firstPassword}
                onChange={(e) => setFirstPassword(e.target.value)}
                placeholder="New password"
                className={inputClass}
                autoComplete="new-password"
                minLength={6}
              />
              <input
                type="password"
                value={firstPasswordConfirm}
                onChange={(e) => setFirstPasswordConfirm(e.target.value)}
                placeholder="Confirm new password"
                className={inputClass}
                autoComplete="new-password"
                minLength={6}
              />
              {firstPwdErr && <p className="text-amber-400 text-sm">{firstPwdErr}</p>}
              {firstPwdMsg && <p className="text-emerald-400/90 text-sm">{firstPwdMsg}</p>}
              {resetLinkMsg && <p className="text-emerald-400/90 text-sm">{resetLinkMsg}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" disabled={firstPwdBusy} className="btn-accent text-sm py-2 px-4">
                  {firstPwdBusy ? 'Saving…' : 'Save password'}
                </button>
                <button
                  type="button"
                  disabled={resetLinkBusy}
                  onClick={() => void handlePasswordResetEmail()}
                  className={menuBtnClass}
                >
                  {resetLinkBusy ? 'Sending…' : 'Email me a reset link instead'}
                </button>
              </div>
              <p className="text-text-muted text-[11px] leading-relaxed">
                If saving fails (for example your project requires a reset flow), use the reset link — it opens the same
                page so you can set a password.
              </p>
            </form>

            <div className="border-t border-white/10 pt-6">
              <form onSubmit={handlePassword} className="space-y-3">
                <h3 className="text-sm font-medium text-text-secondary">Change existing password</h3>
                <p className="text-text-muted text-xs">
                  Enter your current password, then your new password (at least 6 characters).
                </p>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className={inputClass}
                  autoComplete="current-password"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className={inputClass}
                  autoComplete="new-password"
                  minLength={6}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={inputClass}
                  autoComplete="new-password"
                  minLength={6}
                />
                {passwordErr && <p className="text-amber-400 text-sm">{passwordErr}</p>}
                {passwordMsg && <p className="text-emerald-400/90 text-sm">{passwordMsg}</p>}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="submit" disabled={passwordBusy} className="btn-accent text-sm py-2 px-4">
                    {passwordBusy ? 'Updating…' : 'Update password'}
                  </button>
                  <button type="button" onClick={closeModal} className={menuBtnClass}>
                    Done
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}

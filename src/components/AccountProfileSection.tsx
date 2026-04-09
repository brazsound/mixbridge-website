import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent';

export function AccountProfileSection() {
  const { user, updateProfile, updatePassword, updateEmail } = useAuth();

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

  return (
    <div className="glass-card p-6 space-y-8">
      <div>
        <h2 className="font-medium text-lg mb-1">Profile &amp; security</h2>
        <p className="text-text-muted text-sm">
          Signed in as <span className="text-text-secondary">{user?.email}</span>
        </p>
      </div>

      <form onSubmit={handleProfile} className="space-y-3">
        <h3 className="text-sm font-medium text-text-secondary">Display name</h3>
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
        <button type="submit" disabled={profileBusy} className="btn-accent text-sm py-2 px-4">
          {profileBusy ? 'Saving…' : 'Save name'}
        </button>
      </form>

      <div className="border-t border-white/10 pt-8">
        <form onSubmit={handleEmail} className="space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">Change email</h3>
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
          <button type="submit" disabled={emailBusy} className="btn-accent text-sm py-2 px-4">
            {emailBusy ? 'Updating…' : 'Update email'}
          </button>
        </form>
      </div>

      <div className="border-t border-white/10 pt-8">
        <form onSubmit={handlePassword} className="space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">Change password</h3>
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
          <button type="submit" disabled={passwordBusy} className="btn-accent text-sm py-2 px-4">
            {passwordBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}

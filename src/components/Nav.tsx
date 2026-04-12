import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

const linkClass = 'text-text-muted hover:text-text transition-colors text-[13px]';

const accountLinks = [
  { to: '/account', label: 'Dashboard' },
  { to: '/account/download', label: 'Download' },
  { to: '/account/subscription', label: 'Subscription' },
  { to: '/account/devices', label: 'Devices' },
  { to: '/account/settings', label: 'Settings' },
];

function Avatar({ url, name, size = 32 }: { url: string | null; name: string; size?: number }) {
  const initials = name?.[0]?.toUpperCase() ?? '?';
  return url ? (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="rounded-full flex items-center justify-center text-xs font-semibold text-text-muted shrink-0 select-none"
      style={{ width: size, height: size, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      {initials}
    </span>
  );
}

function AccountDropdown({ onClose, triggerRef }: { onClose: () => void; triggerRef: React.RefObject<HTMLButtonElement | null> }) {
  const { user, avatarUrl, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const displayName = (user?.user_metadata as { full_name?: string })?.full_name || user?.email || 'Account';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Don't close if clicking inside the dropdown or on the trigger button itself
      if (ref.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [onClose, triggerRef]);

  const handleNav = (to: string) => { navigate(to); onClose(); };
  const handleSignOut = async () => { onClose(); await signOut(); navigate('/'); };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl overflow-hidden z-[100]"
      style={{ background: 'rgba(15,15,22,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}
    >
      {/* User info header */}
      <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Avatar url={avatarUrl} name={displayName} size={34} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-text truncate">{displayName}</p>
          {user?.email && displayName !== user.email && (
            <p className="text-[11px] text-text-muted truncate">{user.email}</p>
          )}
        </div>
      </div>

      {/* Navigation links */}
      <div className="py-1.5">
        {accountLinks.map(({ to, label }) => (
          <button
            key={to}
            type="button"
            onClick={() => handleNav(to)}
            className="w-full text-left px-4 py-2 text-[13px] text-text-muted hover:text-text hover:bg-white/[0.04] transition-colors"
          >
            {label}
          </button>
        ))}
        {isAdmin && (
          <button
            type="button"
            onClick={() => handleNav('/admin')}
            className="w-full text-left px-4 py-2 text-[13px] text-text-muted hover:text-text hover:bg-white/[0.04] transition-colors"
          >
            Admin
          </button>
        )}
      </div>

      {/* Sign out */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} className="py-1.5">
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="w-full text-left px-4 py-2 text-[13px] text-red-400 hover:text-red-300 hover:bg-white/[0.04] transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function Nav() {
  const { user, avatarUrl, signOut } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const displayName = (user?.user_metadata as { full_name?: string })?.full_name || user?.email || '';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b" style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}>
      <div className="max-w-5xl mx-auto px-6 h-[56px] flex items-center justify-between">
        <Link to="/" className="font-semibold text-[15px] text-text hover:text-text transition-colors tracking-tight">
          Mix Bridge
        </Link>

        <div className="hidden md:flex gap-5 items-center">
          <a href="/#features" className={linkClass}>Features</a>
          <a href="/#pricing" className={linkClass}>Pricing</a>
          <a href="/#download" className={linkClass}>Download</a>

          {user ? (
            <div className="relative">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 transition-opacity hover:opacity-80"
                aria-label="Account menu"
                aria-expanded={dropdownOpen}
              >
                {displayName && (
                  <span className="text-[13px] text-text-muted max-w-[120px] truncate">{displayName.split(' ')[0]}</span>
                )}
                <Avatar url={avatarUrl} name={displayName} size={30} />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-text-muted" style={{ transform: dropdownOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {dropdownOpen && <AccountDropdown onClose={() => setDropdownOpen(false)} triggerRef={triggerRef} />}
            </div>
          ) : (
            <Link to="/account" className={linkClass}>Account</Link>
          )}

          {!user && isAdmin && <Link to="/admin" className={linkClass}>Admin</Link>}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-text-muted hover:text-text transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {mobileOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t" style={{ borderColor: 'var(--border)', background: 'rgba(10,10,15,0.95)' }}>
          <div className="flex flex-col px-6 py-3">
            <a href="/#features" className={`${linkClass} py-2.5`} onClick={() => setMobileOpen(false)}>Features</a>
            <a href="/#pricing" className={`${linkClass} py-2.5`} onClick={() => setMobileOpen(false)}>Pricing</a>
            <a href="/#download" className={`${linkClass} py-2.5`} onClick={() => setMobileOpen(false)}>Download</a>

            {user ? (
              <>
                {/* Mobile avatar + name */}
                <div className="flex items-center gap-2.5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <Avatar url={avatarUrl} name={displayName} size={28} />
                  <span className="text-sm text-text-muted truncate">{displayName}</span>
                </div>
                {accountLinks.map(({ to, label }) => (
                  <Link key={to} to={to} className={`${linkClass} py-2`} onClick={() => setMobileOpen(false)}>{label}</Link>
                ))}
                {isAdmin && <Link to="/admin" className={`${linkClass} py-2`} onClick={() => setMobileOpen(false)}>Admin</Link>}
                <button
                  type="button"
                  onClick={async () => { setMobileOpen(false); await signOut(); }}
                  className="text-left py-2.5 text-[13px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/account" className={`${linkClass} py-2.5`} onClick={() => setMobileOpen(false)}>Account</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

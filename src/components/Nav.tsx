import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

const linkClass = 'text-text-muted hover:text-text transition-colors text-[13px]';

export function Nav() {
  const { user } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const [open, setOpen] = useState(false);

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
          <Link to="/account" className={linkClass}>Account</Link>
          {isAdmin && <Link to="/admin" className={linkClass}>Admin</Link>}
        </div>

        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-text-muted hover:text-text transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {open ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t" style={{ borderColor: 'var(--border)', background: 'rgba(10,10,15,0.95)' }}>
          <div className="flex flex-col px-6 py-3">
            <a href="/#features" className={`${linkClass} py-2.5`} onClick={() => setOpen(false)}>Features</a>
            <a href="/#pricing" className={`${linkClass} py-2.5`} onClick={() => setOpen(false)}>Pricing</a>
            <a href="/#download" className={`${linkClass} py-2.5`} onClick={() => setOpen(false)}>Download</a>
            <Link to="/account" className={`${linkClass} py-2.5`} onClick={() => setOpen(false)}>Account</Link>
            {isAdmin && <Link to="/admin" className={`${linkClass} py-2.5`} onClick={() => setOpen(false)}>Admin</Link>}
          </div>
        </div>
      )}
    </nav>
  );
}

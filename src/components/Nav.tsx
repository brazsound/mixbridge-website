import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

const linkClass = 'text-text-secondary hover:text-text transition-colors';

export function Nav() {
  const { user } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold text-lg text-text hover:text-text transition-colors">
          Mix Bridge
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex gap-6 text-sm font-medium items-center">
          <a href="/#features" className={linkClass}>features</a>
          <a href="/#pricing" className={linkClass}>pricing</a>
          <a href="/#download" className={linkClass}>download</a>
          <Link to="/account" className={linkClass}>account</Link>
          {isAdmin && <Link to="/admin" className="text-text-muted hover:text-text transition-colors">admin</Link>}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-text-secondary hover:text-text transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-bg/95 backdrop-blur-xl">
          <div className="flex flex-col gap-1 px-6 py-4 text-sm font-medium">
            <a href="/#features" className={`${linkClass} py-2`} onClick={() => setOpen(false)}>features</a>
            <a href="/#pricing" className={`${linkClass} py-2`} onClick={() => setOpen(false)}>pricing</a>
            <a href="/#download" className={`${linkClass} py-2`} onClick={() => setOpen(false)}>download</a>
            <Link to="/account" className={`${linkClass} py-2`} onClick={() => setOpen(false)}>account</Link>
            {isAdmin && (
              <Link to="/admin" className="text-text-muted hover:text-text transition-colors py-2" onClick={() => setOpen(false)}>admin</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

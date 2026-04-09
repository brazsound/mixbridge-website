import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export function Nav() {
  const { user } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold text-lg text-text hover:text-text transition-colors">
          Mix Bridge
        </Link>
        <div className="flex gap-4 md:gap-6 text-sm font-medium items-center">
          <a
            href="/#features"
            className="text-text-secondary hover:text-text transition-colors"
          >
            features
          </a>
          <a
            href="/#pricing"
            className="text-text-secondary hover:text-text transition-colors"
          >
            pricing
          </a>
          <a
            href="/#download"
            className="text-text-secondary hover:text-text transition-colors"
          >
            download
          </a>
          <Link
            to="/account"
            className="text-text-secondary hover:text-text transition-colors"
          >
            account
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="text-text-muted hover:text-text transition-colors"
            >
              admin
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

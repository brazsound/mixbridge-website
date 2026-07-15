import { Link } from 'react-router-dom';
import { SUPPORT_URL } from '@/lib/config';

export function Footer() {
  return (
    <footer className="px-6 py-10" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="font-medium text-sm">MixBridge</span>
          <p className="text-text-muted text-xs">
            Built for engineers, for engineers.
          </p>
          <p className="text-text-muted text-xs">
            © {new Date().getFullYear()} Braz Sound. All rights reserved.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px]">
          <Link to="/extensions" className="text-text-muted hover:text-text transition-colors">Extensions</Link>
          <Link to="/account" className="text-text-muted hover:text-text transition-colors">Account</Link>
          <a href="mailto:support@mixbridge.studio" className="text-text-muted hover:text-text transition-colors">Support</a>
          <Link to="/privacy" className="text-text-muted hover:text-text transition-colors">Privacy</Link>
          <Link to="/terms" className="text-text-muted hover:text-text transition-colors">Terms</Link>
          {SUPPORT_URL && (
            <Link to="/support" className="transition-colors hover:opacity-80" style={{ color: 'var(--accent)' }}>
              Support development
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}

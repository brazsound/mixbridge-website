import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="px-6 py-10" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="font-medium text-sm">Mix Bridge</span>
          <p className="text-text-muted text-xs">
            © {new Date().getFullYear()} Braz Sound. All rights reserved.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px]">
          <Link to="/account" className="text-text-muted hover:text-text transition-colors">Account</Link>
          <a href="mailto:support@brazsound.com" className="text-text-muted hover:text-text transition-colors">Support</a>
          <a href="https://github.com/Meteteus/mix-bridge" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text transition-colors">GitHub</a>
          <Link to="/privacy" className="text-text-muted hover:text-text transition-colors">Privacy</Link>
          <Link to="/terms" className="text-text-muted hover:text-text transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
}

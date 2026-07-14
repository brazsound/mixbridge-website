import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/BrandLogo';
import { DOWNLOADS_ENABLED } from '@/lib/config';

/** Real screenshot of the MixBridge app — the bounce queue running across sessions. */
function AppMockup() {
  return (
    <div className="w-full max-w-5xl mx-auto mt-16">
      <div
        className="relative"
        style={{
          filter:
            'drop-shadow(0 24px 64px rgba(0,0,0,0.55)) drop-shadow(0 0 64px rgba(123,92,255,0.16))',
        }}
      >
        <img
          src="/screenshots/hero-main-window.png"
          alt="MixBridge running a bounce queue across multiple Pro Tools sessions"
          width={2103}
          height={1400}
          className="block w-full h-auto select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}

export function Hero() {
  const { user, loading: authLoading } = useAuth();
  const showAccountCta = !authLoading && !user;

  return (
    <header className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24 overflow-hidden">
      {/* Background gradients */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: [
            'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(123,92,255,0.18) 0%, transparent 60%)',
            'radial-gradient(ellipse 40% 30% at 80% 80%, rgba(123,92,255,0.06) 0%, transparent 50%)',
            'var(--bg)',
          ].join(', '),
        }}
      />

      {/* Platform badge */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 text-xs font-medium"
        style={{
          background: 'var(--accent-subtle)',
          border: '1px solid rgba(123,92,255,0.25)',
          color: 'var(--accent)',
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        Free · macOS · Pro Tools required
      </div>

      <div className="flex items-center gap-3 mb-6">
        <BrandLogo size={44} color="var(--text)" />
        <span className="text-2xl font-bold tracking-tight">MixBridge</span>
      </div>

      <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-center mb-6 leading-[1.05]">
        Automate your stems.
      </h1>

      <p className="text-lg md:text-xl text-text-secondary text-center max-w-2xl mb-3 leading-snug">
        Focus on the mix, not the manual work.
      </p>
      <p className="text-sm md:text-base text-text-muted text-center max-w-xl mb-12 leading-relaxed">
        Prep your bounces, queue them up, and walk away.
        <br className="hidden sm:block" />
        MixBridge drives Pro Tools through every export, so your stems are ready when you get back.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <a href="#download" className="btn-accent btn-accent-glow">
          {DOWNLOADS_ENABLED ? 'Download for Mac' : 'Coming soon to Mac'}
        </a>
        {showAccountCta && (
          <Link
            to="/account"
            className="text-sm font-medium normal-case transition-colors hero-secondary-cta"
          >
            Create Account or Sign In &rarr;
          </Link>
        )}
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 mt-10">
        {['multi-session queue', 'WAV · MP3 · AIFF', 'session templates', 'runs in the background'].map(
          (pill) => (
            <span
              key={pill}
              className="text-[11px] px-3 py-1.5 rounded-full"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              {pill}
            </span>
          ),
        )}
      </div>

      <AppMockup />
    </header>
  );
}

import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <header className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24 overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(10,132,255,0.13) 0%, transparent 60%), #060609',
        }}
      />

      {/* Platform badge */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 text-xs font-medium"
        style={{
          background: 'rgba(10,132,255,0.1)',
          border: '1px solid rgba(10,132,255,0.25)',
          color: '#0a84ff',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        macOS · Pro Tools required
      </div>

      {/* Headline */}
      <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-center mb-6 leading-[1.05]">
        Mix Bridge
      </h1>

      {/* Subheadline */}
      <p className="text-xl md:text-2xl text-text-secondary text-center max-w-2xl mb-4 leading-snug">
        Pro Tools bounce automation for audio engineers.
      </p>
      <p className="text-base md:text-lg text-text-muted text-center max-w-xl mb-12 leading-relaxed">
        Queue your stems, set your formats, and walk away.
        Mix Bridge handles the exports while you focus on the mix.
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <a href="#download" className="btn-accent">
          Download for Mac
        </a>
        <Link
          to="/account"
          className="text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          Sign in to your account →
        </Link>
      </div>

      {/* Proof pills */}
      <div className="flex flex-wrap justify-center gap-3 mt-14">
        {['Multi-session queue', 'WAV · MP3 · AIFF', 'Session templates', 'Undo / Redo', 'Runs in the background'].map((pill) => (
          <span
            key={pill}
            className="text-xs px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-muted)',
            }}
          >
            {pill}
          </span>
        ))}
      </div>
    </header>
  );
}

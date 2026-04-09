import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

function AppMockup() {
  const rows = [
    { label: 'Kick + Snare', width: '55%', done: true },
    { label: 'Full Mix Stems', width: '72%', done: true },
    { label: 'Dialogue Edit', width: '38%', active: true },
    { label: 'Music & FX', width: '0%', done: false },
    { label: 'Atmos Stem', width: '0%', done: false },
  ];

  return (
    <div
      className="w-full max-w-xl mx-auto mt-16 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(10,10,16,0.85)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,95,87,0.7)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,189,46,0.7)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(40,200,64,0.7)' }} />
        </div>
        <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Mix Bridge — Session 3 of 5
        </span>
      </div>

      {/* Queue header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
          bounce queue
        </span>
        <span className="text-xs" style={{ color: 'rgba(10,132,255,0.8)' }}>
          2 / 5 done
        </span>
      </div>

      {/* Queue rows */}
      <div className="px-3 py-2 space-y-1.5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{
              background: row.active
                ? 'rgba(10,132,255,0.08)'
                : row.done
                ? 'rgba(255,255,255,0.02)'
                : 'transparent',
              border: row.active
                ? '1px solid rgba(10,132,255,0.18)'
                : '1px solid transparent',
            }}
          >
            {/* Status dot */}
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: row.done
                  ? 'rgba(40,200,64,0.7)'
                  : row.active
                  ? '#0a84ff'
                  : 'rgba(255,255,255,0.15)',
              }}
            />
            {/* Track name */}
            <span
              className="text-xs flex-1 truncate"
              style={{
                color: row.done
                  ? 'rgba(255,255,255,0.3)'
                  : row.active
                  ? 'rgba(255,255,255,0.85)'
                  : 'rgba(255,255,255,0.45)',
              }}
            >
              {row.label}
            </span>
            {/* Progress bar */}
            <div
              className="rounded-full overflow-hidden"
              style={{ width: 72, height: 3, background: 'rgba(255,255,255,0.06)' }}
            >
              {(row.done || row.active) && (
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: row.done ? '100%' : row.width,
                    background: row.done
                      ? 'rgba(40,200,64,0.5)'
                      : 'var(--accent)',
                  }}
                />
              )}
            </div>
            {/* Format badge */}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.25)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              WAV
            </span>
          </div>
        ))}
      </div>

      {/* Footer bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Est. 4 min Remaining
        </span>
        <div
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md"
          style={{ background: 'rgba(10,132,255,0.12)', color: '#0a84ff' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#0a84ff' }}
          />
          Running
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const { user, loading: authLoading } = useAuth();
  const showAccountCta = !authLoading && !user;

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
        {showAccountCta && (
          <Link
            to="/account"
            className="text-sm font-semibold normal-case transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Create Account or Sign In →
          </Link>
        )}
      </div>

      {/* Proof pills */}
      <div className="flex flex-wrap justify-center gap-3 mt-10">
        {['multi-session queue', 'WAV · MP3 · AIFF', 'session templates', 'runs in the background'].map((pill) => (
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

      {/* App mockup */}
      <AppMockup />
    </header>
  );
}

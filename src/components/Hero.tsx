import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/BrandLogo';

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
      className="w-full max-w-xl mx-auto mt-16 rounded-xl overflow-hidden hero-mockup-float"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 0 60px rgba(123,92,255,0.12), 0 24px 64px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,95,87,0.5)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,189,46,0.5)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(40,200,64,0.5)' }} />
        </div>
        <span className="text-[11px] ml-2 text-text-muted">MixBridge · Session 3 of 5</span>
      </div>

      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-[11px] font-medium text-text-muted">bounce queue</span>
        <span className="text-[11px]" style={{ color: 'var(--accent)' }}>
          2 / 5 done
        </span>
      </div>

      <div className="px-3 py-2 space-y-1">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{
              background: row.active
                ? 'var(--accent-subtle)'
                : row.done
                ? 'rgba(255,255,255,0.015)'
                : 'transparent',
              border: row.active
                ? '1px solid rgba(123,92,255,0.2)'
                : '1px solid transparent',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: row.done
                  ? 'rgba(40,200,64,0.6)'
                  : row.active
                  ? 'var(--accent)'
                  : 'rgba(255,255,255,0.12)',
              }}
            />
            <span
              className="text-[12px] flex-1 truncate"
              style={{
                color: row.done
                  ? 'var(--text-muted)'
                  : row.active
                  ? 'var(--text)'
                  : 'var(--text-secondary)',
              }}
            >
              {row.label}
            </span>
            <div
              className="rounded-full overflow-hidden"
              style={{ width: 64, height: 2, background: 'rgba(255,255,255,0.06)' }}
            >
              {(row.done || row.active) && (
                <div
                  className="h-full rounded-full"
                  style={{
                    width: row.done ? '100%' : row.width,
                    background: row.done ? 'rgba(40,200,64,0.4)' : 'var(--accent)',
                  }}
                />
              )}
            </div>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              WAV
            </span>
          </div>
        ))}
      </div>

      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-[11px] text-text-muted">Est. 4 min Remaining</span>
        <div
          className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: 'var(--accent)' }}
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
        MixBridge drives Pro Tools through every export — your stems are ready when you get back.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <a href="#download" className="btn-accent btn-accent-glow">
          Download for Mac
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

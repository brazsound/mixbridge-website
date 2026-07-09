import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLogo } from '@/components/BrandLogo';

/** Bounce-type colors, mirrored from the app's design tokens. */
const TYPE = {
  mix: '#34D399',
  stem: '#A78BFA',
  solo: '#FBBF24',
  range: '#38BDF8',
} as const;

function TypePill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="shrink-0 hidden sm:flex items-center gap-1"
      style={{
        padding: '2px 7px',
        borderRadius: 4,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'block' }} />
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color, textTransform: 'uppercase' }}>
        {label}
      </span>
    </span>
  );
}

function AppMockup() {
  const rows = [
    { name: 'Full Mix', sub: 'WAV · 48k · 1|1 – End', type: 'mix', label: 'Mix', done: true },
    { name: 'Drum Stems', sub: '8 tracks · WAV · 48k', type: 'stem', label: 'Stem', done: true },
    { name: 'Vocals Only', sub: 'Soloed · WAV · 48k', type: 'solo', label: 'Solo', active: true, progress: 46 },
    { name: 'Music & FX', sub: 'WAV · 48k · 1|1 – End', type: 'stem', label: 'Stem' },
    { name: 'Verse 2 Section', sub: 'Markers 3–4 · WAV', type: 'range', label: 'Range' },
  ] as const;

  const sessions = [
    { name: 'Track01_Mix.ptx', count: '5 bounces', state: 'done' },
    { name: 'Track02_Mix.ptx', count: '5 bounces', state: 'active' },
    { name: 'Track03_Stems.ptx', count: '8 bounces', state: 'pending' },
  ] as const;

  return (
    <div
      className="w-full max-w-2xl mx-auto mt-16 rounded-xl overflow-hidden hero-mockup-float text-left"
      style={{
        background: '#17191E',
        border: '1px solid rgba(230,232,236,0.1)',
        boxShadow: '0 0 60px rgba(123,92,255,0.12), 0 24px 64px rgba(0,0,0,0.5)',
      }}
    >
      {/* Title bar — mirrors the app's connection bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
      >
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,95,87,0.5)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,189,46,0.5)' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(40,200,64,0.5)' }} />
        </div>
        <span className="flex items-center gap-1.5 ml-2">
          <BrandLogo size={14} color="var(--text-muted)" />
          <span className="text-[10px] font-semibold text-text-muted" style={{ letterSpacing: '0.03em' }}>
            MIXBRIDGE
          </span>
        </span>
        <span
          className="ml-auto flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md text-text-secondary"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE.mix }} />
          Track02_Mix.ptx
        </span>
      </div>

      <div className="flex">
        {/* Sessions sidebar */}
        <div
          className="hidden md:flex flex-col w-44 shrink-0"
          style={{ borderRight: '1px solid var(--border)' }}
        >
          <span
            className="px-3 pt-3 pb-2 text-[9px] font-semibold uppercase text-text-muted"
            style={{ letterSpacing: '0.12em' }}
          >
            Sessions
          </span>
          <div className="px-2 space-y-1 flex-1">
            {sessions.map((s) => (
              <div
                key={s.name}
                className="px-2.5 py-2 rounded-lg"
                style={{
                  background: s.state === 'active' ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.015)',
                  border: s.state === 'active' ? '1px solid rgba(123,92,255,0.25)' : '1px solid transparent',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.state === 'active' ? 'animate-pulse' : ''}`}
                    style={{
                      background:
                        s.state === 'done' ? TYPE.mix : s.state === 'active' ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                    }}
                  />
                  <span
                    className="text-[10px] truncate"
                    style={{ color: s.state === 'pending' ? 'var(--text-muted)' : 'var(--text-secondary)' }}
                  >
                    {s.name}
                  </span>
                </div>
                <span className="text-[9px] text-text-muted block mt-0.5 pl-3">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="p-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div
              className="text-center text-[10px] font-medium py-1.5 rounded-lg text-text-secondary"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
            >
              Running 2 of 3…
            </div>
          </div>
        </div>

        {/* Queue */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-[10px] font-semibold uppercase text-text-muted" style={{ letterSpacing: '0.12em' }}>
              Bounce queue
            </span>
            <span className="text-[11px]" style={{ color: 'var(--accent)' }}>
              2 / 5 done
            </span>
          </div>

          <div className="px-2.5 py-2 space-y-1 flex-1">
            {rows.map((row) => (
              <div
                key={row.name}
                className="relative flex rounded-md overflow-hidden"
                style={{
                  background: 'active' in row && row.active ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(230,232,236,0.06)',
                }}
              >
                {'active' in row && row.active && (
                  <span
                    className="animate-pulse absolute top-0 left-0 right-0"
                    style={{ height: 1, background: 'var(--accent)' }}
                  />
                )}
                {/* Type-colored left edge, like the real queue rows */}
                <span style={{ width: 4, alignSelf: 'stretch', background: TYPE[row.type], flexShrink: 0 }} />
                <div className="flex items-center flex-1 min-w-0 gap-2 px-2.5 py-1.5">
                  <TypePill color={TYPE[row.type]} label={row.label} />
                  <span className="flex-1 min-w-0">
                    <span
                      className="block text-[11px] truncate"
                      style={{ color: 'done' in row && row.done ? 'var(--text-muted)' : 'var(--text)' }}
                    >
                      {row.name}
                    </span>
                    <span className="block text-[9px] text-text-muted truncate">{row.sub}</span>
                  </span>
                  {'done' in row && row.done && (
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={TYPE.mix}
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {'progress' in row && row.active && (
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--accent)' }}>
                      {row.progress}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Transport — mirrors the app's bottom run bar */}
          <div className="p-2" style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <div
              className="relative flex items-center justify-center gap-2 w-full py-2 rounded-lg text-[11px] font-semibold overflow-hidden"
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 16px rgba(123,92,255,0.3)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#fff' }} />
              Running queue… Est. 4 min remaining
              <span
                className="absolute bottom-0 left-0"
                style={{ height: 2, width: '46%', background: 'var(--gradient-brand)' }}
              />
            </div>
          </div>
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
        MixBridge drives Pro Tools through every export, so your stems are ready when you get back.
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

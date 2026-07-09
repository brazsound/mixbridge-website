import React from 'react';
import { useReveal } from '@/lib/useReveal';
import { BrandLogo } from '@/components/BrandLogo';

/** Bounce-type colors, mirrored from the app's design tokens. */
const TYPE = {
  mix: '#34D399',
  stem: '#A78BFA',
  solo: '#FBBF24',
  mute: '#F87171',
  range: '#38BDF8',
} as const;

const windowShell: React.CSSProperties = {
  background: '#17191E',
  border: '1px solid rgba(230,232,236,0.1)',
  boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
};

function WindowChrome({ title }: { title: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5"
      style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
    >
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,95,87,0.45)' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,189,46,0.45)' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(40,200,64,0.45)' }} />
      </div>
      <span className="flex items-center gap-1.5 ml-2">
        <BrandLogo size={13} color="var(--text-muted)" />
        <span className="text-[10px] font-semibold text-text-muted" style={{ letterSpacing: '0.03em' }}>
          {title}
        </span>
      </span>
    </div>
  );
}

function TypePill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="shrink-0 flex items-center gap-1"
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

function QueueRow({
  name,
  sub,
  type,
  label,
  selected,
}: {
  name: string;
  sub: string;
  type: keyof typeof TYPE;
  label: string;
  selected?: boolean;
}) {
  return (
    <div
      className="flex rounded-md overflow-hidden"
      style={{
        background: selected ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.02)',
        border: selected ? '1px solid rgba(123,92,255,0.25)' : '1px solid rgba(230,232,236,0.06)',
      }}
    >
      <span style={{ width: 4, alignSelf: 'stretch', background: TYPE[type], flexShrink: 0 }} />
      <div className="flex items-center flex-1 min-w-0 gap-2 px-2.5 py-1.5">
        <TypePill color={TYPE[type]} label={label} />
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] truncate" style={{ color: 'var(--text)' }}>
            {name}
          </span>
          <span className="block text-[9px] text-text-muted truncate">{sub}</span>
        </span>
      </div>
    </div>
  );
}

function QueueMockup() {
  return (
    <div className="w-full max-w-lg mx-auto rounded-xl overflow-hidden" style={windowShell}>
      <WindowChrome title="MIXBRIDGE" />

      {/* Add-buttons toolbar, like the app's Build Stems strip */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 flex-wrap"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {[
          { label: '+ Mix', color: TYPE.mix },
          { label: '+ Stems', color: TYPE.stem },
          { label: '+ Soloed', color: TYPE.solo },
          { label: '+ Markers', color: TYPE.range },
        ].map((b) => (
          <span
            key={b.label}
            className="text-[10px] px-2 py-1 rounded-md font-medium"
            style={{
              background: `color-mix(in srgb, ${b.color} 10%, transparent)`,
              color: b.color,
              border: `1px solid color-mix(in srgb, ${b.color} 22%, transparent)`,
            }}
          >
            {b.label}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-text-muted">5 items</span>
      </div>

      <div className="px-2.5 py-2 space-y-1">
        <QueueRow name="Full Mix" sub="WAV · 48k · 1|1 – End" type="mix" label="Mix" />
        <QueueRow name="Drum Stems" sub="8 tracks · WAV · 48k" type="stem" label="Stem" />
        <QueueRow name="Lead Vocal Print" sub="Soloed · WAV · 48k" type="solo" label="Solo" selected />
        <QueueRow name="Instrumental (TV Mix)" sub="Vocals muted · WAV" type="mute" label="Mute" />
        <QueueRow name="Bridge Section" sub="Markers 5–6 · WAV" type="range" label="Range" />
      </div>

      <div className="p-2" style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
        <div
          className="flex items-center justify-center w-full py-2 rounded-lg text-[11px] font-semibold"
          style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 0 16px rgba(123,92,255,0.3)' }}
        >
          Run queue
        </div>
      </div>
    </div>
  );
}

function FormatMockup() {
  return (
    <div className="w-full max-w-lg mx-auto rounded-xl overflow-hidden" style={windowShell}>
      <WindowChrome title="MIXBRIDGE" />

      {/* Preset slots, like the app's Bounce Setup */}
      <div
        className="flex items-center gap-1.5 px-4 py-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-[9px] font-semibold uppercase text-text-muted mr-1" style={{ letterSpacing: '0.12em' }}>
          Presets
        </span>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-semibold"
            style={
              n === 1
                ? { background: 'var(--accent)', color: '#fff' }
                : {
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }
            }
          >
            {n}
          </span>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: 'var(--accent)' }}>
          Template applied ✓
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted block mb-2">
            File type
          </label>
          <div className="flex gap-2">
            {['WAV', 'MP3', 'AIFF'].map((fmt) => (
              <div
                key={fmt}
                className="text-[12px] px-3 py-1.5 rounded-md flex-1 text-center"
                style={{
                  background: fmt === 'WAV' ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                  color: fmt === 'WAV' ? '#fff' : 'var(--text-muted)',
                  border: fmt === 'WAV' ? '1px solid transparent' : '1px solid var(--border)',
                }}
              >
                {fmt}
              </div>
            ))}
          </div>
        </div>
        {[
          ['Sample rate', '48,000 Hz'],
          ['Bit depth', '24-bit'],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between">
            <label className="text-[11px] text-text-muted">{label}</label>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] text-text-secondary"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
            >
              {value}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        ))}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted block mb-2">
            Output folder
          </label>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md text-[11px] text-text-muted"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
          >
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
            >
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            ~/Projects/Session_03/Bounces/
          </div>
        </div>
      </div>
    </div>
  );
}

type SessionStatus = 'done' | 'active' | 'pending';

interface BatchSession {
  name: string;
  bounces: number;
  status: SessionStatus;
  progress?: number;
}

function BatchRunMockup() {
  const sessions: BatchSession[] = [
    { name: 'Album_Track01_Mix.ptx', bounces: 5, status: 'done' },
    { name: 'Album_Track02_Stems.ptx', bounces: 8, status: 'done' },
    { name: 'Album_Track03_Mix.ptx', bounces: 5, progress: 62, status: 'active' },
    { name: 'Album_Track04_Mix.ptx', bounces: 5, status: 'pending' },
  ];

  return (
    <div className="w-full max-w-lg mx-auto rounded-xl overflow-hidden" style={windowShell}>
      <WindowChrome title="MIXBRIDGE" />
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-text-muted">Overall progress</span>
          <span className="text-[11px]" style={{ color: TYPE.mix }}>
            2 / 4 sessions
          </span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full" style={{ width: '55%', background: 'var(--gradient-brand)' }} />
        </div>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {sessions.map((session, i) => (
          <div
            key={i}
            className="px-3 py-3 rounded-lg"
            style={{
              background:
                session.status === 'active'
                  ? 'var(--accent-subtle)'
                  : session.status === 'done'
                  ? 'color-mix(in srgb, #34D399 4%, transparent)'
                  : 'rgba(255,255,255,0.015)',
              border:
                session.status === 'active' ? '1px solid rgba(123,92,255,0.2)' : '1px solid transparent',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${session.status === 'active' ? 'animate-pulse' : ''}`}
                style={{
                  background:
                    session.status === 'done'
                      ? TYPE.mix
                      : session.status === 'active'
                      ? 'var(--accent)'
                      : 'rgba(255,255,255,0.12)',
                }}
              />
              <span
                className="text-[11px] flex-1 truncate"
                style={{ color: session.status === 'pending' ? 'var(--text-muted)' : 'var(--text-secondary)' }}
              >
                {session.name}
              </span>
              <span className="text-[10px] text-text-muted shrink-0">{session.bounces} bounces</span>
              {session.status === 'done' && (
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={TYPE.mix}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {session.status === 'active' && session.progress !== undefined && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid rgba(123,92,255,0.2)' }}
                >
                  {session.progress}%
                </span>
              )}
            </div>
            {session.status === 'active' && session.progress !== undefined && (
              <div
                className="mt-2 ml-4 rounded-full overflow-hidden"
                style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${session.progress}%`, background: 'var(--gradient-brand)' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}
      >
        <span className="text-[11px] text-text-muted">Est. 12 min remaining</span>
        <div
          className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
          Running
        </div>
      </div>
    </div>
  );
}

interface StepData {
  number: string;
  title: string;
  description: string;
}

const stepData: StepData[] = [
  {
    number: '1',
    title: 'Queue your stems',
    description:
      'Add every stem or mix you need to bounce to the queue. Name them, set time ranges, and choose your output folder.',
  },
  {
    number: '2',
    title: 'Set your formats',
    description:
      'Pick WAV, MP3, or AIFF. Set the sample rate and bit depth. Apply a session template to configure everything in seconds.',
  },
  {
    number: '3',
    title: 'Walk away',
    description:
      'Hit Run and let MixBridge work through the queue, even across multiple sessions. Come back to finished files.',
  },
];

const mockups: React.ReactNode[] = [<QueueMockup />, <FormatMockup />, <BatchRunMockup />];

export function HowItWorks() {
  const revealRef = useReveal();
  return (
    <section className="px-6 py-24 md:py-32">
      <div ref={revealRef} className="max-w-5xl mx-auto reveal">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">How it works</h2>
          <p className="text-text-secondary text-sm max-w-lg mx-auto leading-relaxed">
            Three steps. No scripting, no learning curve, no Pro Tools workflows to memorize.
          </p>
        </div>

        <div className="space-y-24">
          {stepData.map((step, i) => (
            <div
              key={step.number}
              className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-10 md:gap-16 items-center`}
            >
              <div className="flex-1 space-y-4 md:max-w-xs">
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
                  >
                    {step.number}
                  </span>
                  <h3 className="text-lg font-medium">{step.title}</h3>
                </div>
                <p className="text-text-muted text-sm leading-relaxed">{step.description}</p>
              </div>
              <div className="flex-1 w-full">{mockups[i]}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import React from 'react';

function WindowChrome({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,95,87,0.45)' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,189,46,0.45)' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(40,200,64,0.45)' }} />
      </div>
      <span className="text-[11px] ml-2 text-text-muted">{title}</span>
    </div>
  );
}

function QueueMockup() {
  const items = [
    { label: 'Kick + Snare Stems', format: 'WAV', range: '1|1 – 1|49' },
    { label: 'Full Mix (Stereo)', format: 'WAV', range: '1|1 – End' },
    { label: 'Dialogue Print', format: 'WAV', range: '2|1 – 3|12', selected: true },
    { label: 'Music & FX', format: 'MP3', range: '1|1 – End' },
    { label: 'Atmos Bed', format: 'WAV', range: '1|1 – End' },
  ];
  return (
    <div
      className="w-full max-w-lg mx-auto rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}
    >
      <WindowChrome title="Mix Bridge · Queue" />
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-[11px] font-medium text-text-muted">5 items</span>
        <span
          className="text-[11px] px-2 py-1 rounded-md"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid rgba(110,86,207,0.2)' }}
        >
          + Add Stem
        </span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{
              background: item.selected ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.015)',
              border: item.selected ? '1px solid rgba(110,86,207,0.25)' : '1px solid transparent',
            }}
          >
            <svg
              width="8"
              height="12"
              viewBox="0 0 8 12"
              fill="currentColor"
              className="shrink-0 text-text-muted"
              style={{ opacity: 0.3 }}
              aria-hidden
            >
              <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
              <circle cx="2" cy="6" r="1.2" /><circle cx="6" cy="6" r="1.2" />
              <circle cx="2" cy="10" r="1.2" /><circle cx="6" cy="10" r="1.2" />
            </svg>
            <span
              className="text-[12px] flex-1 truncate"
              style={{ color: item.selected ? 'var(--text)' : 'var(--text-secondary)' }}
            >
              {item.label}
            </span>
            <span className="text-[10px] shrink-0 text-text-muted hidden sm:block">{item.range}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {item.format}
            </span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 pt-1">
        <div
          className="flex items-center justify-center w-full py-2.5 rounded-lg text-[12px] font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Run Queue →
        </div>
      </div>
    </div>
  );
}

function FormatMockup() {
  return (
    <div
      className="w-full max-w-lg mx-auto rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}
    >
      <WindowChrome title="Mix Bridge · Setup" />
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(110,86,207,0.05)' }}
      >
        <div className="flex items-center gap-2">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--accent)' }}
            aria-hidden
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="text-[11px]" style={{ color: 'var(--accent)' }}>
            Template: Full Delivery Package
          </span>
        </div>
        <span className="text-[10px] text-text-muted">Applied ✓</span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted block mb-2">
            Format
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
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-text-muted">Sample Rate</label>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] text-text-secondary"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
          >
            48,000 Hz
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-text-muted">Bit Depth</label>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] text-text-secondary"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
          >
            24-bit
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted block mb-2">
            Output Folder
          </label>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md text-[11px] text-text-muted"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            ~/Dropbox/Projects/Session_03/Bounces/
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
    <div
      className="w-full max-w-lg mx-auto rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}
    >
      <WindowChrome title="Mix Bridge · Batch Run" />
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-text-muted">Overall progress</span>
          <span className="text-[11px]" style={{ color: 'rgba(40,200,64,0.8)' }}>
            2 / 4 sessions
          </span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: '55%', background: 'linear-gradient(90deg, rgba(40,200,64,0.7), rgba(40,200,64,0.4))' }}
          />
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
                  ? 'rgba(40,200,64,0.04)'
                  : 'rgba(255,255,255,0.015)',
              border:
                session.status === 'active' ? '1px solid rgba(110,86,207,0.2)' : '1px solid transparent',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background:
                    session.status === 'done'
                      ? 'rgba(40,200,64,0.7)'
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
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'rgba(40,200,64,0.7)', flexShrink: 0 }}
                  aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {session.status === 'active' && session.progress !== undefined && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid rgba(110,86,207,0.2)' }}
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
                  style={{ width: `${session.progress}%`, background: 'var(--accent)' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: '1px solid var(--border)' }}
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
      'Hit Run and let Mix Bridge work through the queue, even across multiple sessions. Come back to finished files.',
  },
];

const mockups: React.ReactNode[] = [<QueueMockup />, <FormatMockup />, <BatchRunMockup />];

export function HowItWorks() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="max-w-5xl mx-auto">
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

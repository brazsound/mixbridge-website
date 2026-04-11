const features = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
    title: 'Queue everything at once',
    description: 'Add all your stems to the bounce queue, hit Run, and walk away. Mix Bridge works through the list automatically.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="3" width="9" height="9" rx="1" /><rect x="13" y="3" width="9" height="9" rx="1" /><rect x="2" y="13" width="9" height="9" rx="1" /><rect x="13" y="13" width="9" height="9" rx="1" />
      </svg>
    ),
    title: 'Multiple sessions in one run',
    description: 'Load several Pro Tools sessions into the queue. Mix Bridge opens each one, bounces your stems, and moves to the next.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
      </svg>
    ),
    title: 'Full format and bit-depth control',
    description: 'Choose WAV, MP3, or AIFF. Set your sample rate and bit depth per queue item. Files land exactly where you point them.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'Session templates',
    description: 'Save your stem layout as a template and apply it to any session in seconds. No more recreating the same setup.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Timeline and marker ranges',
    description: 'Capture your bounce range directly from Pro Tools: use the Edit Selection, a pair of markers, or the whole timeline.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0" /><path d="M12 8v4l3 3" />
      </svg>
    ),
    title: 'Runs quietly in the background',
    description: 'Launch Mix Bridge once and it stays ready. Undo a bounce, fix something in your session, and re-run. It keeps up.',
  },
];

export function Features() {
  return (
    <section id="features" className="px-6 py-24 md:py-32">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Less clicking. More mixing.
          </h2>
          <p className="text-text-secondary text-sm max-w-lg mx-auto leading-relaxed">
            Built for engineers who spend too much time on exports and not enough time on the work that matters.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card p-6 group">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-4"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
              >
                {f.icon}
              </div>
              <h3 className="font-medium text-[15px] mb-2">{f.title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    title: 'Export stems in one click',
    description: 'Set it and forget it. Export all your stems at once. Queue multiple sessions and run overnight if you want.',
  },
  {
    title: 'Bounce your full mix',
    description: 'Pick any section of your timeline, use markers, or bounce the whole thing. Save files wherever you need them.',
  },
  {
    title: 'Solo or mute, your way',
    description: 'Export individual tracks with one click. Or bounce a mix that skips the tracks you muted.',
  },
  {
    title: 'Save your favorite settings',
    description: 'Store up to 5 presets and recall them instantly. Switch between projects without reconfiguring.',
  },
  {
    title: 'Files land where you need them',
    description: 'Bounced files go straight into your session or a folder. Choose your format and you\'re done.',
  },
  {
    title: 'Runs alongside Pro Tools',
    description: 'Starts up with Pro Tools automatically. Made a mistake? Undo it and try again.',
  },
];

export function Features() {
  return (
    <section id="features" className="px-6 py-20 md:py-28">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-16">
          Less clicking, more mixing
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="glass-card p-6 hover:border-white/20 transition-colors"
            >
              <h3 className="font-medium text-lg mb-2">{f.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

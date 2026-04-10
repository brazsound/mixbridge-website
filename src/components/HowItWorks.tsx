const steps = [
  {
    number: '1',
    title: 'Queue your stems',
    description:
      'Add every stem or mix you need to bounce to the queue. Name them, set time ranges, and choose your output folder.',
    image: '/screenshots/01-main-window.png',
    alt: 'Mix Bridge main window showing the bounce queue with multiple stems listed',
  },
  {
    number: '2',
    title: 'Set your formats',
    description:
      'Pick WAV, MP3, or AIFF. Set the sample rate and bit depth. Apply a session template to configure everything in seconds.',
    image: '/screenshots/03-setup-panel.png',
    alt: 'Mix Bridge setup panel showing format, sample rate, and bit depth options',
  },
  {
    number: '3',
    title: 'Walk away',
    description:
      'Hit Run and let Mix Bridge work through the queue — even across multiple sessions. Come back to finished files.',
    image: '/screenshots/07-sessions-batch-run.png',
    alt: 'Mix Bridge batch run view showing multiple sessions being processed automatically',
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">How it works</h2>
          <p className="text-text-secondary max-w-lg mx-auto leading-relaxed">
            Three steps. No scripting, no learning curve, no Pro Tools workflows to memorize.
          </p>
        </div>

        <div className="space-y-20">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`flex flex-col ${
                i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'
              } gap-8 md:gap-12 items-center`}
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{
                      background: 'rgba(10,132,255,0.12)',
                      color: '#0a84ff',
                      border: '1px solid rgba(10,132,255,0.25)',
                    }}
                  >
                    {step.number}
                  </span>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                </div>
                <p className="text-text-secondary leading-relaxed">{step.description}</p>
              </div>
              <div className="flex-1 w-full">
                <img
                  src={step.image}
                  alt={step.alt}
                  className="rounded-xl w-full"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                  }}
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useReveal } from '@/lib/useReveal';

interface StepData {
  number: string;
  title: string;
  description: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

const stepData: StepData[] = [
  {
    number: '1',
    title: 'Queue your stems',
    description:
      'Add every stem or mix you need to bounce to the queue. Name them, set time ranges, and choose your output folder.',
    src: '/screenshots/step-1-queue.png',
    alt: 'MixBridge bounce queue with mix, stem, solo and mute jobs ready to run',
    width: 1275,
    height: 1249,
  },
  {
    number: '2',
    title: 'Set your formats',
    description:
      'Pick WAV, MP3, or AIFF. Set the sample rate and bit depth. Apply a session template to configure everything in seconds.',
    src: '/screenshots/step-2-formats.png',
    alt: 'MixBridge setup panel showing export type, bit depth and sample rate controls',
    width: 381,
    height: 716,
  },
  {
    number: '3',
    title: 'Walk away',
    description:
      'Hit Run and let MixBridge work through the queue, even across multiple sessions. Come back to finished files.',
    src: '/screenshots/step-3-sessions.png',
    alt: 'MixBridge sessions list queued to run three Pro Tools sessions in a row',
    width: 301,
    height: 621,
  },
];

/** Frames a real app-panel screenshot as a crisp, hairline-bordered card. */
function StepShot({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <div className="flex justify-center">
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: '#0F1216',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        }}
      >
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          className="block w-auto select-none"
          style={{ maxHeight: 460, maxWidth: '100%' }}
          draggable={false}
        />
      </div>
    </div>
  );
}

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
              <div className="flex-1 w-full">
                <StepShot src={step.src} alt={step.alt} width={step.width} height={step.height} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

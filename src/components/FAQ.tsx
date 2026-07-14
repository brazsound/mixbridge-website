import { useState } from 'react';
import { useReveal } from '@/lib/useReveal';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'Which Pro Tools versions does MixBridge support?',
    answer:
      'MixBridge talks to Pro Tools through the official Pro Tools Scripting Library (PTSL) and requires Pro Tools 2025.6 or later. Older versions are missing the scripting features MixBridge relies on.',
  },
  {
    question: 'Is MixBridge really free?',
    answer:
      "Yes. MixBridge is completely free, with no fees, no trial limits, and no card required. We don't sell your data, run ads, or make money from it in any way. Just create a free account, download the app, and start bouncing.",
  },
  {
    question: 'Why do I need an account?',
    answer:
      "Only so we can keep track of your feedback and follow up on the bug reports and feature requests you send from the app. We'll never send you spam or marketing emails. It's free and takes a few seconds.",
  },
  {
    question: 'Can I use MixBridge on multiple systems?',
    answer:
      'Yes. Install it on as many systems as you like. Just sign in with your account on each one, and there are no device limits.',
  },
  {
    question: 'What audio formats are supported?',
    answer:
      'WAV, MP3, and AIFF, the same formats Pro Tools supports for offline bounce. You set the format, sample rate, and bit depth per session, and you can add an MP3 copy alongside your main format in one pass.',
  },
  {
    question: 'Does it work with Dolby Atmos sessions?',
    answer:
      "Atmos-specific bounce workflows are on the roadmap. Currently MixBridge handles standard stereo and multi-mono bounces. If you're bouncing Atmos bed or object stems as standard audio files, those work today.",
  },
  {
    question: 'What happens if a bounce fails mid-run?',
    answer:
      "MixBridge stops at the failed item and shows you exactly what went wrong. Fix the issue in your session, then resume the run from that item. Everything already bounced stays done, so you never repeat work.",
  },
  {
    question: 'Can I extend MixBridge or build my own add-ons?',
    answer:
      "Yes. MixBridge has a full extension system. Install free community extensions from Settings → Extensions inside the app, or build your own with our SDK: they run sandboxed with explicit permissions and can react to bounces, edit the queue, call webhooks, and more. Keep your extensions private or share them with the community, but they're always free to use and can't be sold. You can also attach shell commands to app events under Settings → Automation, no code required.",
  },
  {
    question: 'Does MixBridge require an internet connection?',
    answer:
      "Only to sign in to your account. Once you're signed in, MixBridge works fully offline. Your sessions and bounces never leave your machine.",
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        className="w-full flex items-start justify-between gap-4 py-5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-medium text-sm text-text">{item.question}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`shrink-0 mt-0.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="pb-5 -mt-1">
          <p className="text-text-muted text-sm leading-relaxed">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export function FAQ() {
  const revealRef = useReveal();
  return (
    <section id="faq" className="px-6 py-24 md:py-32">
      <div ref={revealRef} className="max-w-2xl mx-auto reveal">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">Frequently asked questions</h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Everything you need to know before downloading.
          </p>
        </div>

        <div>
          {faqs.map((faq) => (
            <FAQAccordion key={faq.question} item={faq} />
          ))}
        </div>
      </div>
    </section>
  );
}

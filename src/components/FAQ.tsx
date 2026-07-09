import { useState } from 'react';
import { useReveal } from '@/lib/useReveal';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'Does Mix Bridge work with Pro Tools 2024?',
    answer:
      'Yes. Mix Bridge uses the official Pro Tools Scripting Library (PTSL), so it supports any Pro Tools version that includes PTSL: Pro Tools 2023.12 and later, including all 2024 and 2025 releases.',
  },
  {
    question: 'How is this different from SoundFlow scripts?',
    answer:
      "SoundFlow runs keyboard-shortcut macros and screen-scraping. Mix Bridge talks to Pro Tools directly through its scripting API (PTSL), which means it doesn't depend on window positions, menu layouts, or screen resolution. It also handles multi-session batching natively, something that's extremely difficult with macro-based tools.",
  },
  {
    question: 'Is Mix Bridge really free?',
    answer:
      'Yes. Mix Bridge is completely free to use — no fees, no trial limits, and no card required. Just create a free account, download the app, and start bouncing.',
  },
  {
    question: 'Why do I need an account?',
    answer:
      "So we can keep you posted on updates and make it easy to send us bug reports and feature requests right from the app. Creating one takes a few seconds and it's free.",
  },
  {
    question: 'Can I use Mix Bridge on multiple systems?',
    answer:
      'Yes. Install it on as many Macs as you like — just sign in with your account on each one. There are no device limits.',
  },
  {
    question: 'What audio formats are supported?',
    answer:
      'WAV, MP3, and AIFF, the same formats Pro Tools supports for offline bounce. You can set sample rate and bit depth per queue item.',
  },
  {
    question: 'Does it work with Dolby Atmos sessions?',
    answer:
      "Atmos-specific bounce workflows are on the roadmap. Currently Mix Bridge handles standard stereo and multi-mono bounces. If you're bouncing Atmos bed or object stems as standard audio files, those work today.",
  },
  {
    question: 'What happens if a bounce fails mid-run?',
    answer:
      "Mix Bridge logs the error and moves to the next item in the queue, so one failed bounce doesn't stop the entire batch. You can review what happened and re-run individual items.",
  },
  {
    question: 'Does Mix Bridge require an internet connection?',
    answer:
      "Only to sign in to your account. Once you're signed in, Mix Bridge works fully offline. Your sessions and bounces never leave your machine.",
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

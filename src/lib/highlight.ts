/**
 * Lazy loader for highlight.js.
 *
 * We don't want syntax-highlighting weight on every page, so highlight.js is
 * pulled from a CDN only when a code viewer actually mounts (the extension
 * detail page). The script + a dark theme are injected once and cached; every
 * later caller reuses the same promise.
 */

const HLJS_VERSION = '11.9.0';
const CDN = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HLJS_VERSION}`;

/** Minimal shape of the highlight.js global we rely on. */
export interface Highlighter {
  highlight(code: string, options: { language: string; ignoreIllegals?: boolean }): { value: string };
  getLanguage(name: string): unknown;
}

declare global {
  interface Window {
    hljs?: Highlighter;
  }
}

let pending: Promise<Highlighter> | null = null;

export function loadHighlighter(): Promise<Highlighter> {
  if (typeof window !== 'undefined' && window.hljs) return Promise.resolve(window.hljs);
  if (pending) return pending;

  pending = new Promise<Highlighter>((resolve, reject) => {
    // Dark theme that sits well on the site's #14161A background.
    if (!document.getElementById('hljs-theme')) {
      const link = document.createElement('link');
      link.id = 'hljs-theme';
      link.rel = 'stylesheet';
      link.href = `${CDN}/styles/github-dark.min.css`;
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = `${CDN}/highlight.min.js`;
    script.async = true;
    script.onload = () => {
      if (window.hljs) resolve(window.hljs);
      else reject(new Error('highlight.js loaded but window.hljs is missing'));
    };
    script.onerror = () => {
      pending = null; // allow a later retry
      reject(new Error('Failed to load highlight.js'));
    };
    document.head.appendChild(script);
  });

  return pending;
}

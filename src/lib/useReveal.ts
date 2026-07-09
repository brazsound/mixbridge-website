import { useEffect, useRef } from 'react';

/**
 * Reveal-on-scroll. Attach the returned ref to an element that starts with the
 * `reveal` class; when it scrolls into view, `is-visible` is added so the CSS
 * transition plays. Fires once, then disconnects.
 *
 * Safe by default: if IntersectionObserver is unavailable, the element is
 * revealed immediately. Under `prefers-reduced-motion`, the CSS shows the
 * element with no transform/transition (see index.css).
 *
 * @param threshold Fraction of the element visible before revealing.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.12) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-visible');
            io.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin: '0px 0px -10% 0px' }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return ref;
}

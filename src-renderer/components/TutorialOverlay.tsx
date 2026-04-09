import { useState, useEffect, useCallback } from 'react';
import { useTutorial, TUTORIAL_STEPS } from '../contexts/TutorialContext';

const BUBBLE_WIDTH = 360;
const BUBBLE_HEIGHT = 180;

function useTargetRect(targetSelector: string | undefined) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!targetSelector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${targetSelector}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const update = () => setRect(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('scroll', update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update, true);
    };
  }, [targetSelector]);

  return rect;
}

export function TutorialOverlay() {
  const { active, step, stepIndex, next, skip } = useTutorial();
  const targetRect = useTargetRect(step?.target);
  const [bubblePosition, setBubblePosition] = useState<{ top: number; left: number } | null>(null);
  const [bubbleAboveTarget, setBubbleAboveTarget] = useState(true);
  const [exiting, setExiting] = useState(false);

  const handleNext = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      next();
      setExiting(false);
    }, 150);
  }, [next]);

  const handleSkip = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      skip();
      setExiting(false);
    }, 150);
  }, [skip]);

  useEffect(() => {
    if (!step || !active) return;

    if (!step.target || !targetRect) {
      setBubblePosition({
        top: window.innerHeight / 2 - 120,
        left: window.innerWidth / 2 - 180,
      });
      setBubbleAboveTarget(true);
      return;
    }

    const gap = 12;
    const padding = 16;

    const elCenterX = targetRect.left + targetRect.width / 2;
    let top: number;
    const above = targetRect.top > window.innerHeight / 2;

    if (above) {
      top = targetRect.top - BUBBLE_HEIGHT - gap;
    } else {
      top = targetRect.bottom + gap;
    }
    const left = Math.max(padding, Math.min(window.innerWidth - BUBBLE_WIDTH - padding, elCenterX - BUBBLE_WIDTH / 2));

    setBubblePosition({ top, left });
    setBubbleAboveTarget(above);
  }, [step, targetRect, active]);

  if (!active || !step) return null;

  const isLast = stepIndex >= TUTORIAL_STEPS.length - 1;
  const showTail = step.target && targetRect && bubblePosition;
  const tailOffset =
    showTail && targetRect && bubblePosition
      ? Math.max(16, Math.min(BUBBLE_WIDTH - 24, targetRect.left + targetRect.width / 2 - bubblePosition.left - 6))
      : 0;

  return (
    <div
      className="fixed inset-0 z-[70] pointer-events-none"
      style={{ isolation: 'isolate' }}
    >
      <div
        className="pointer-events-auto absolute"
        style={{
          width: BUBBLE_WIDTH,
          maxWidth: 'calc(100vw - 32px)',
          top: bubblePosition?.top ?? 0,
          left: bubblePosition?.left ?? 0,
          filter: 'drop-shadow(0 0 24px var(--accent-ring))',
          animation: exiting ? 'tutorialBubbleOut 0.15s ease-in forwards' : 'tutorialBubbleIn 0.2s ease-out',
        }}
      >
        <div
          className="rounded-2xl relative"
          style={{
            background: 'rgba(28, 30, 34, 0.98)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 24px 48px rgba(0,0,0,0.5)',
          }}
        >
          {showTail && (
            <div
              className="absolute w-0 h-0 border-[6px] border-transparent"
              style={{
                left: tailOffset,
                ...(bubbleAboveTarget
                  ? { bottom: -12, borderTopColor: 'rgba(28, 30, 34, 0.98)' }
                  : { top: -12, borderBottomColor: 'rgba(28, 30, 34, 0.98)' }),
              }}
            />
          )}
          <div className="p-4">
          <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {step.title}
          </h3>
          <p className="text-[13px] leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.78)' }}>
            {step.body}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleNext}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
            {!isLast && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs px-2 py-1.5 rounded-lg"
                style={{ color: 'var(--text-muted)' }}
              >
                Skip tutorial
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

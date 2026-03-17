import { useState, useEffect } from 'react';
import type { CapturedRange, RangeFormat } from './useBounceSettings';

/**
 * Converts the captured range to the selected display format in real-time.
 * When rangeFormat changes, fetches the converted values via ptsl.getTimeAsType.
 */
export function useDisplayRange(
  capturedRange: CapturedRange | null,
  rangeFormat: RangeFormat,
  connected: boolean
): { inLocation: string; outLocation: string } | null {
  const [display, setDisplay] = useState<{ inLocation: string; outLocation: string } | null>(null);

  useEffect(() => {
    if (!capturedRange) {
      setDisplay(null);
      return;
    }

    // Same format: no conversion needed
    if (capturedRange.timeTypeName === rangeFormat) {
      setDisplay({
        inLocation: capturedRange.inLocation,
        outLocation: capturedRange.outLocation,
      });
      return;
    }

    // No ptsl or not connected: show original
    if (!connected || !window.ptsl?.getTimeAsType) {
      setDisplay({
        inLocation: capturedRange.inLocation,
        outLocation: capturedRange.outLocation,
      });
      return;
    }

    // Show original immediately while converting
    setDisplay({
      inLocation: capturedRange.inLocation,
      outLocation: capturedRange.outLocation,
    });

    let cancelled = false;

    (async () => {
      const inRes = await window.ptsl.getTimeAsType(
        { location: capturedRange.inLocation, time_type: capturedRange.timeTypeName },
        rangeFormat
      );
      if (cancelled) return;

      const outRes = await window.ptsl.getTimeAsType(
        { location: capturedRange.outLocation, time_type: capturedRange.timeTypeName },
        rangeFormat
      );
      if (cancelled) return;

      setDisplay({
        inLocation: inRes.data?.location ?? capturedRange.inLocation,
        outLocation: outRes.data?.location ?? capturedRange.outLocation,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [capturedRange, rangeFormat, connected]);

  return display;
}

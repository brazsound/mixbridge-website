import { useState, useCallback, useEffect, useRef } from 'react';
import type { SessionInfo } from './useSessionInfo';
import type { TrackInfo, MemoryLocationInfo } from './useProToolsData';

export interface CachedSessionScan {
  sessionInfo: SessionInfo;
  tracks: TrackInfo[];
  memoryLocations: MemoryLocationInfo[];
  scannedAt: string;
}

export function useSessionScanCache() {
  const [cache, setCache] = useState<Record<string, CachedSessionScan>>({});
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!window.ptslSessionScanCache || loadedRef.current) return;
    loadedRef.current = true;
    window.ptslSessionScanCache.load().then((result) => {
      const c = (result.cache ?? {}) as Record<string, CachedSessionScan>;
      setCache(c);
    });
  }, []);

  const persist = useCallback((next: Record<string, CachedSessionScan>) => {
    if (!window.ptslSessionScanCache) return;
    void window.ptslSessionScanCache.save(next as unknown as Record<string, unknown>);
  }, []);

  const getCached = useCallback(
    (ptxPath: string): CachedSessionScan | null => {
      return cache[ptxPath] ?? null;
    },
    [cache]
  );

  const setCached = useCallback(
    (ptxPath: string, data: Omit<CachedSessionScan, 'scannedAt'>) => {
      const entry: CachedSessionScan = {
        ...data,
        scannedAt: new Date().toISOString(),
      };
      setCache((prev) => {
        const next = { ...prev, [ptxPath]: entry };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const mergeCached = useCallback(
    (ptxPath: string, partial: Partial<Omit<CachedSessionScan, 'scannedAt'>>) => {
      setCache((prev) => {
        const existing = prev[ptxPath] ?? {
          sessionInfo: {
            sampleRate: 0,
            sampleRateLabel: '',
            bitDepth: 0,
            bitDepthLabel: '',
            mixSources: [],
          },
          tracks: [],
          memoryLocations: [],
          scannedAt: new Date().toISOString(),
        };
        const next = {
          ...prev,
          [ptxPath]: {
            ...existing,
            ...partial,
            scannedAt: new Date().toISOString(),
          },
        };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { getCached, setCached, mergeCached, cache };
}

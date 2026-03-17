import { useState, useCallback, useEffect, useRef } from 'react';
import type { QueueItem } from './useQueue';
import type { BounceSettings } from './useBounceSettings';

export type SessionEntryStatus = 'pending' | 'running' | 'done' | 'error';

export interface SessionEntry {
  id: string;
  ptxPath: string;
  sessionName: string;
  queue: QueueItem[];
  settings: BounceSettings;
  status: SessionEntryStatus;
  errorMessage?: string;
}

function generateId(): string {
  return `sb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

/** Serialisable form — excludes runtime status so saved entries always start as 'pending'. */
type PersistedEntry = Omit<SessionEntry, 'status' | 'errorMessage'>;

export function useSessionBatch(options?: { onLoadError?: (err: Error) => void }) {
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const onLoadErrorRef = useRef(options?.onLoadError);
  onLoadErrorRef.current = options?.onLoadError;

  // Load from disk on mount
  useEffect(() => {
    if (!window.ptslSessionBatch) return;
    window.ptslSessionBatch.load().then((result) => {
      const loaded = (result.entries ?? []) as PersistedEntry[];
      setEntries(loaded.map((e) => ({ ...e, status: 'pending' as const })));
    }).catch((err) => {
      onLoadErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
    });
  }, []);

  const persist = useCallback((next: SessionEntry[]) => {
    if (!window.ptslSessionBatch) return;
    const toSave: PersistedEntry[] = next.map(({ status: _s, errorMessage: _e, ...rest }) => rest);
    void window.ptslSessionBatch.save(toSave);
  }, []);

  const addEntry = useCallback((
    ptxPath: string,
    queue: QueueItem[],
    settings: BounceSettings,
    options?: { skipPersist?: boolean; onAdded?: (entry: SessionEntry) => void }
  ) => {
    const entry: SessionEntry = {
      id: generateId(),
      ptxPath,
      sessionName: basename(ptxPath).replace(/\.ptx$/i, ''),
      queue,
      settings,
      status: 'pending',
    };
    setEntries((prev) => {
      const next = [...prev, entry];
      if (!options?.skipPersist) persist(next);
      return next;
    });
    options?.onAdded?.(entry);
  }, [persist]);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const reorderEntries = useCallback((fromIndex: number, toIndex: number) => {
    setEntries((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persist(next);
      return next;
    });
  }, [persist]);

  const updateEntryStatus = useCallback((id: string, status: SessionEntryStatus, errorMessage?: string) => {
    setEntries((prev) =>
      prev.map((e) => e.id === id ? { ...e, status, errorMessage } : e)
    );
  }, []);

  /** Persist queue + settings edits back to an entry (called on session switch). */
  const updateEntry = useCallback((id: string, queue: QueueItem[], settings: BounceSettings) => {
    setEntries((prev) => {
      const next = prev.map((e) => e.id === id ? { ...e, queue, settings } : e);
      persist(next);
      return next;
    });
  }, [persist]);

  const resetStatuses = useCallback(() => {
    setEntries((prev) => prev.map((e) => ({ ...e, status: 'pending' as const, errorMessage: undefined })));
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    persist([]);
  }, [persist]);

  return {
    entries,
    addEntry,
    removeEntry,
    reorderEntries,
    updateEntryStatus,
    updateEntry,
    resetStatuses,
    clearEntries,
  };
}

import { useReducer, useCallback, useEffect } from 'react';
import type { DefaultNaming } from '../hooks/useSettings';
import { applyNamingFromConfig } from '../hooks/useSettings';

export type QueueJobType = 'bounce_normal' | 'batch_stems' | 'bounce_soloed' | 'bounce_muted' | 'bounce_range';

export interface QueueItemBase {
  id: string;
  type: QueueJobType;
  outputName: string;
}

/** Bounce everything as-is — no track state changes */
export interface BounceNormalItem extends QueueItemBase {
  type: 'bounce_normal';
}

/** One bounce per track — each selected track becomes its own row */
export interface BatchStemsItem extends QueueItemBase {
  type: 'batch_stems';
  trackId: string;
  trackName: string;
}

export interface BounceSoloedItem extends QueueItemBase {
  type: 'bounce_soloed';
  trackNames: string[];
}

export interface BounceMutedItem extends QueueItemBase {
  type: 'bounce_muted';
  trackNames: string[];
}

export interface BounceRangeItem extends QueueItemBase {
  type: 'bounce_range';
  rangeSource: 'timeline' | 'marker';
  markerNumber?: number;
  markerName?: string;
}

export type QueueItem = BounceNormalItem | BatchStemsItem | BounceSoloedItem | BounceMutedItem | BounceRangeItem;

function generateId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}


// ---------------------------------------------------------------------------
// History reducer
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50;

interface HistoryState {
  past: QueueItem[][];
  present: QueueItem[];
  future: QueueItem[][];
}

type HistoryAction =
  | { type: 'SET'; getNext: (q: QueueItem[]) => QueueItem[] }
  | { type: 'LOAD'; items: QueueItem[] }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'SET': {
      const next = action.getNext(state.present);
      const past = [...state.past, state.present];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, present: next, future: [] };
    }
    case 'LOAD':
      // Replace entire queue and clear history (used when switching sessions)
      return { past: [], present: action.items, future: [] };
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

const INITIAL_STATE: HistoryState = { past: [], present: [], future: [] };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQueue() {
  const [{ past, present: queue, future }, dispatch] = useReducer(historyReducer, INITIAL_STATE);

  const setQueue = useCallback((getNext: (q: QueueItem[]) => QueueItem[]) => {
    dispatch({ type: 'SET', getNext });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  /** Replace the entire queue and clear undo/redo history. Used when switching sessions. */
  const loadQueue = useCallback((items: QueueItem[]) => {
    dispatch({ type: 'LOAD', items });
  }, []);

  const addBounceNormal = useCallback((outputName: string) => {
    setQueue((q) => [...q, { id: generateId(), type: 'bounce_normal', outputName }]);
  }, [setQueue]);

  const addBatchStems = useCallback(
    (
      trackIds: string[],
      trackNames: string[],
      naming: DefaultNaming,
      ctx?: { sessionName?: string }
    ) => {
      const items: BatchStemsItem[] = trackIds.map((trackId, i) => {
        const trackName = trackNames[i] ?? `Track ${i + 1}`;
        return {
          id: generateId(),
          type: 'batch_stems',
          trackId,
          trackName,
          outputName: applyNamingFromConfig(naming, {
            name: trackName,
            sessionName: ctx?.sessionName,
            trackNumber: i + 1,
          }),
        };
      });
      setQueue((q) => [...q, ...items]);
    },
    [setQueue]
  );

  const addBounceSoloed = useCallback((trackNames: string[], naming: DefaultNaming) => {
    setQueue((q) => [
      ...q,
      {
        id: generateId(),
        type: 'bounce_soloed',
        trackNames,
        outputName: applyNamingFromConfig(naming, { name: 'Solo' }),
      },
    ]);
  }, [setQueue]);

  const addBounceMuted = useCallback((trackNames: string[], naming: DefaultNaming) => {
    setQueue((q) => [
      ...q,
      {
        id: generateId(),
        type: 'bounce_muted',
        trackNames,
        outputName: applyNamingFromConfig(naming, { name: 'Mute' }),
      },
    ]);
  }, [setQueue]);

  const addBounceRange = useCallback(
    (
      rangeSource: 'timeline' | 'marker',
      naming: DefaultNaming,
      markerNumber?: number,
      markerName?: string
    ) => {
      const name = markerName ?? (markerNumber != null ? `Marker ${markerNumber}` : 'Range');
      setQueue((q) => [
        ...q,
        {
          id: generateId(),
          type: 'bounce_range',
          rangeSource,
          outputName: applyNamingFromConfig(naming, { name }),
          markerNumber,
          markerName,
        },
      ]);
    },
    [setQueue]
  );

  const updateItemName = useCallback((id: string, outputName: string) => {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, outputName } : item)));
  }, [setQueue]);

  const removeItem = useCallback((id: string) => {
    setQueue((q) => q.filter((item) => item.id !== id));
  }, [setQueue]);

  const reorderItems = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((q) => {
      const next = [...q];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, [setQueue]);

  const clearQueue = useCallback(() => setQueue(() => []), [setQueue]);

  return {
    queue,
    canUndo,
    canRedo,
    undo,
    redo,
    loadQueue,
    addBounceNormal,
    addBatchStems,
    addBounceSoloed,
    addBounceMuted,
    addBounceRange,
    updateItemName,
    removeItem,
    reorderItems,
    clearQueue,
  };
}

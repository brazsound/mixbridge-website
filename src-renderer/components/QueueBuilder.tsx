import { useState, useCallback, useEffect } from 'react';
import { useProToolsData } from '../hooks/useProToolsData';
import type { QueueItem, BatchStemsItem, BounceSoloedItem, BounceMutedItem, BounceRangeItem } from '../hooks/useQueue';
import type { DefaultNaming } from '../hooks/useSettings';
import { applyNamingFromConfig } from '../hooks/useSettings';
import { QueueItemRow } from './QueueItemRow';
import { RunQueueRunner } from './RunQueueRunner';

interface QueueBuilderProps {
  connected: boolean;
  queue: QueueItem[];
  defaultNaming: DefaultNaming;
  onAddBatchStems: (trackIds: string[], trackNames: string[], defaultName: string) => void;
  onAddBounceSoloed: (trackNames: string[], defaultName: string) => void;
  onAddBounceMuted: (trackNames: string[], defaultName: string) => void;
  onAddBounceRange: (rangeSource: 'timeline' | 'marker', defaultName: string, markerNumber?: number, markerName?: string) => void;
  onUpdateItemName: (id: string, outputName: string, outputNameAlt?: string) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
}

export function QueueBuilder({
  connected,
  queue,
  defaultNaming,
  onAddBatchStems,
  onAddBounceSoloed,
  onAddBounceMuted,
  onAddBounceRange,
  onUpdateItemName,
  onRemoveItem,
  onClearQueue,
}: QueueBuilderProps) {
  const [rangeWarn, setRangeWarn] = useState<string | null>(null);
  const {
    selectedTracks,
    soloedTracks,
    mutedTracks,
    hasTimelineSelection,
    timelineSelection,
    memoryLocations,
    loading,
    error,
    refreshAll,
  } = useProToolsData(connected);

  useEffect(() => {
    if (connected) refreshAll();
  }, [connected, refreshAll]);

  const handleRefresh = useCallback(() => {
    if (connected) refreshAll();
  }, [connected, refreshAll]);

  const addBatch = useCallback(() => {
    if (selectedTracks.length === 0) {
      setRangeWarn('No tracks selected in Pro Tools. Select tracks first.');
      return;
    }
    const name = applyNamingFromConfig(defaultNaming, { name: 'Batch' }, 'batch');
    onAddBatchStems(
      selectedTracks.map((t) => t.id),
      selectedTracks.map((t) => t.name),
      name
    );
    setRangeWarn(null);
  }, [selectedTracks, defaultNaming, onAddBatchStems]);

  const addSoloed = useCallback(() => {
    if (soloedTracks.length === 0) {
      setRangeWarn('No soloed tracks in Pro Tools. Solo the tracks you want to bounce first.');
      return;
    }
    const name = applyNamingFromConfig(defaultNaming, { name: 'Soloed' }, 'solo');
    onAddBounceSoloed(soloedTracks.map((t) => t.name), name);
    setRangeWarn(null);
  }, [soloedTracks, defaultNaming, onAddBounceSoloed]);

  const addMuted = useCallback(() => {
    const name = applyNamingFromConfig(defaultNaming, { name: 'Muted' }, 'mute');
    onAddBounceMuted(mutedTracks.map((t) => t.name), name);
    setRangeWarn(null);
  }, [mutedTracks, defaultNaming, onAddBounceMuted]);

  const addRangeTimeline = useCallback(() => {
    if (!hasTimelineSelection) {
      setRangeWarn('No timeline selection in Pro Tools. Set In/Out points first.');
      return;
    }
    const name = applyNamingFromConfig(defaultNaming, { name: 'Range' }, 'mix');
    onAddBounceRange('timeline', name);
    setRangeWarn(null);
  }, [hasTimelineSelection, defaultNaming, onAddBounceRange]);

  const addRangeMarker = useCallback(
    (markerNumber: number, markerName: string) => {
      const name = applyNamingFromConfig(
        defaultNaming,
        { name: markerName || `Marker ${markerNumber}` },
        'mix'
      );
      onAddBounceRange('marker', name, markerNumber, markerName);
      setRangeWarn(null);
    },
    [defaultNaming, onAddBounceRange]
  );

  return (
    <div className="space-y-6">
      {!connected && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
          Connect to Pro Tools above, then click <span className="font-semibold text-[var(--text)]">Refresh</span> to
          pull tracks, markers and timeline selection from your current session.
        </div>
      )}

      {connected && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="px-2 py-1.5 text-sm rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
              title="Refresh tracks and selection from Pro Tools"
            >
              Refresh
            </button>
            <div className="h-5 w-px bg-[var(--border)]" />
            <span className="text-sm font-medium text-[var(--text)]">Add to queue</span>
            <button
              type="button"
              onClick={addBatch}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
            >
              Batch stems ({selectedTracks.length} selected)
            </button>
            <button
              type="button"
              onClick={addSoloed}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
            >
              Bounce soloed ({soloedTracks.length})
            </button>
            <button
              type="button"
              onClick={addMuted}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
            >
              Bounce muted ({mutedTracks.length} muted)
            </button>
            <button
              type="button"
              onClick={addRangeTimeline}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
            >
              Bounce timeline selection
            </button>
            {memoryLocations.length > 0 && (
              <span className="text-sm text-[var(--text-muted)] ml-2">
                Markers:{' '}
                {memoryLocations.slice(0, 5).map((m) => (
                  <button
                    key={m.number}
                    type="button"
                    onClick={() => addRangeMarker(m.number, m.name)}
                    className="mx-0.5 underline hover:no-underline"
                  >
                    {m.number}: {m.name || 'Unnamed'}
                  </button>
                ))}
                {memoryLocations.length > 5 && ` +${memoryLocations.length - 5} more`}
              </span>
            )}
          </div>

          {rangeWarn && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {rangeWarn}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">Queue</h2>
        {queue.length > 0 && (
          <div className="flex gap-2">
            <RunQueueRunner
              queue={queue}
              connected={connected}
              hasTimelineSelection={connected ? hasTimelineSelection : false}
              timelineSelection={connected ? timelineSelection : null}
            />
            <button
              type="button"
              onClick={onClearQueue}
              className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            >
              Clear queue
            </button>
          </div>
        )}
      </div>

      {queue.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Queue is empty. Add bounces above.</p>
      ) : (
        <ul className="space-y-2">
          {queue.map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              onUpdateName={(name, alt) => onUpdateItemName(item.id, name, alt)}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

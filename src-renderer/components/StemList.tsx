import React, { useState, useCallback, useRef } from 'react';
import type { QueueItem } from '../hooks/useQueue';
import type { DefaultNaming } from '../hooks/useSettings';
import { applyNamingFromConfig } from '../hooks/useSettings';
import type { Shortcuts } from '../hooks/useShortcuts';
import { formatShortcutForDisplay } from '../hooks/useShortcuts';
import type { RunStatuses } from './RunQueueRunner';
import { StemRow } from './StemRow';

interface StemListProps {
  shortcuts?: Shortcuts;
  sessionName?: string | null;
  connected: boolean;
  queue: QueueItem[];
  canUndo: boolean;
  canRedo: boolean;
  defaultNaming: DefaultNaming;
  selectedTracks: TrackInfo[];
  soloedTracks: TrackInfo[];
  mutedTracks: TrackInfo[];
  ptDataLoading: boolean;
  ptDataError: string | null;
  runStatuses: RunStatuses;
  onRefresh: () => Promise<void>;
  onAddBounceNormal: (outputName: string) => void;
  onAddBatchStems: (trackIds: string[], trackNames: string[], naming: DefaultNaming, ctx?: { sessionName?: string }) => void;
  onAddBounceSoloed: (trackNames: string[], naming: DefaultNaming) => void;
  onAddBounceMuted: (trackNames: string[], naming: DefaultNaming) => void;
  onUpdateItemName: (id: string, name: string) => void;
  onRemoveItem: (id: string) => void;
  onReorderItems: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBounceOne?: (item: QueueItem) => void;
  canBounceOne?: boolean;
  queueRunning?: boolean;
}

export function StemList({
  shortcuts,
  sessionName,
  connected,
  queue,
  canUndo,
  canRedo,
  defaultNaming,
  selectedTracks,
  soloedTracks,
  mutedTracks,
  ptDataLoading,
  ptDataError,
  runStatuses,
  onRefresh,
  onAddBounceNormal,
  onAddBatchStems,
  onAddBounceSoloed,
  onAddBounceMuted,
  onUpdateItemName,
  onRemoveItem,
  onReorderItems,
  onClearQueue,
  onUndo,
  onRedo,
  onBounceOne,
  canBounceOne = false,
  queueRunning = false,
}: StemListProps) {
  const fmt = (s: string) => formatShortcutForDisplay(s);
  const [warn, setWarn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [pendingEditIndex, setPendingEditIndex] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const dragIndexRef = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((index: number) => {
    const from = dragIndexRef.current;
    if (from !== null && from !== index) {
      onReorderItems(from, index);
    }
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }, [onReorderItems]);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  const handleBatch = useCallback(() => {
    setWarn(null);
    if (selectedTracks.length === 0) {
      setWarn('No tracks are selected in Pro Tools. Select the tracks you want to bounce, then click Batch.');
      return;
    }
    onAddBatchStems(
      selectedTracks.map((t) => t.id),
      selectedTracks.map((t) => t.name),
      defaultNaming,
      sessionName ? { sessionName } : undefined
    );
  }, [selectedTracks, defaultNaming, sessionName, onAddBatchStems]);

  const handleSolo = useCallback(() => {
    setWarn(null);
    if (soloedTracks.length === 0) {
      setWarn('No tracks are soloed in Pro Tools. Solo the tracks you want, then click Solo.');
      return;
    }
    onAddBounceSoloed(soloedTracks.map((t) => t.name), defaultNaming);
  }, [soloedTracks, defaultNaming, onAddBounceSoloed]);

  const handleMute = useCallback(() => {
    setWarn(null);
    onAddBounceMuted(mutedTracks.map((t) => t.name), defaultNaming);
  }, [mutedTracks, defaultNaming, onAddBounceMuted]);

  const handleClearRequest = () => setConfirmClear(true);
  const handleClearConfirm = () => {
    setConfirmClear(false);
    onClearQueue();
  };
  const handleClearCancel = () => setConfirmClear(false);

  return (
    <section>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}
          >
            Build Stems
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Each button snapshots the current Pro Tools state into a bounce job.
          </p>
        </div>

        {/* Undo / Redo / Clear */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={shortcuts ? `Undo (${fmt(shortcuts.undo)})` : 'Undo'}
            className="btn-glass"
            style={{ padding: '4px 7px', opacity: canUndo ? 1 : 0.35 }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h10a5 5 0 010 10H9m-6-10l4-4M3 10l4 4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title={shortcuts ? `Redo (${fmt(shortcuts.redo)})` : 'Redo'}
            className="btn-glass"
            style={{ padding: '4px 7px', opacity: canRedo ? 1 : 0.35 }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 10H11a5 5 0 000 10h4m6-10l-4-4m4 4l-4 4" />
            </svg>
          </button>
          {queue.length > 0 && (
            <button
              type="button"
              onClick={handleClearRequest}
              className="btn-glass btn-danger text-xs"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {connected && (
        <div data-tutorial="build-stems" className="flex items-center gap-1.5 mb-4 flex-wrap">
          {/* Refresh */}
          <button
            type="button"
            onClick={() => { setWarn(null); void onRefresh(); }}
            disabled={ptDataLoading}
            title={shortcuts ? `Refresh track list from Pro Tools (${fmt(shortcuts.refresh)})` : 'Refresh track list from Pro Tools'}
            className="btn-glass"
          >
            <svg
              className={`w-3 h-3 ${ptDataLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>

          {/* Divider */}
          <div className="h-5 w-px mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Normal Bounce */}
          <button
            type="button"
            onClick={() => onAddBounceNormal(applyNamingFromConfig(defaultNaming, { name: 'Mix' }))}
            disabled={ptDataLoading}
            title={shortcuts ? `Bounce the full mix as-is (${fmt(shortcuts.mix)})` : 'Bounce the full mix as-is'}
            className="btn-glass"
            style={{ borderColor: 'rgba(52,211,153,0.35)' }}
          >
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: '#34d399' }} />
            Mix
          </button>

          {/* Divider */}
          <div className="h-5 w-px mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Batch */}
          <button
            type="button"
            onClick={handleBatch}
            disabled={ptDataLoading}
            title={shortcuts ? `Create one bounce per selected track (${fmt(shortcuts.batch)})` : 'Create one bounce per selected track'}
            className="btn-glass"
            style={{ borderColor: 'rgba(168,85,247,0.35)' }}
          >
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: '#a855f7' }} />
            Batch
            <span style={{ color: 'var(--text-muted)' }}>({selectedTracks.length})</span>
          </button>

          {/* Solo */}
          <button
            type="button"
            onClick={handleSolo}
            disabled={ptDataLoading}
            title={shortcuts ? `Capture current solo state as a bounce (${fmt(shortcuts.solo)})` : 'Capture current solo state as a bounce'}
            className="btn-glass"
            style={{ borderColor: 'rgba(250,204,21,0.3)' }}
          >
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: '#facc15' }} />
            Solo
            <span style={{ color: 'var(--text-muted)' }}>({soloedTracks.length})</span>
          </button>

          {/* Mute */}
          <button
            type="button"
            onClick={handleMute}
            disabled={ptDataLoading}
            title={shortcuts ? `Capture current mute state as a bounce (${fmt(shortcuts.mute)})` : 'Capture current mute state as a bounce'}
            className="btn-glass"
            style={{ borderColor: 'rgba(239,68,68,0.3)' }}
          >
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: '#ef4444' }} />
            Mute
            <span style={{ color: 'var(--text-muted)' }}>({mutedTracks.length})</span>
          </button>
        </div>
      )}

      {/* Warnings */}
      {warn && (
        <div
          className="mb-3 px-4 py-2.5 text-xs rounded-xl"
          style={{
            background: 'var(--warning-soft)',
            border: '1px solid rgba(255,159,10,0.3)',
            color: '#ffd580',
          }}
        >
          {warn}
        </div>
      )}
      {ptDataError && (
        <div
          className="mb-3 px-4 py-2.5 text-xs rounded-xl"
          style={{
            background: 'var(--danger-soft)',
            border: '1px solid rgba(255,69,58,0.3)',
            color: '#ff8a80',
          }}
        >
          {ptDataError}
        </div>
      )}

      {/* Not connected */}
      {!connected && (
        <div
          className="px-5 py-12 text-center rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px dashed rgba(255,255,255,0.1)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Not connected</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Connect to Pro Tools to start building your stem list.
          </p>
        </div>
      )}

      {/* Empty state */}
      {connected && queue.length === 0 && (
        <div
          className="px-5 py-12 text-center rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px dashed rgba(255,255,255,0.1)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No bounces in queue</p>
          <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
            Click Mix for a full mix, or select tracks / set solo/mute in Pro Tools and use the buttons above.
          </p>
        </div>
      )}

      {/* Bounce list */}
      {queue.length > 0 && (
        <div className="space-y-1.5">
          {queue.map((item, index) => (
            <React.Fragment key={item.id}>
              {/* Insertion line before this row (between rows) */}
              {dragOverIndex === index &&
                dragIndexRef.current !== null &&
                dragIndexRef.current !== index &&
                index < queue.length - 1 && (
                  <div
                    className="w-full rounded-full shrink-0"
                    style={{
                      height: '3px',
                      background: 'var(--accent)',
                      boxShadow: '0 0 8px rgba(10,132,255,0.6)',
                    }}
                  />
                )}
              <StemRow
                dataTutorial={index === 0 ? 'rename-stems' : undefined}
                item={item}
                index={index}
                isDragOver={false}
                runStatus={runStatuses[item.id]}
                onUpdateName={(name) => onUpdateItemName(item.id, name)}
                onRemove={() => onRemoveItem(item.id)}
                onBounceOne={onBounceOne ? () => void onBounceOne(item) : undefined}
                canBounceOne={canBounceOne}
                queueRunning={queueRunning}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                externalEdit={pendingEditIndex === index}
                onExternalEditConsumed={() => setPendingEditIndex(null)}
                onTabToNext={() => {
                  if (index + 1 < queue.length) setPendingEditIndex(index + 1);
                }}
              />
              {/* Insertion line after last row when dropping at end */}
              {dragOverIndex === index &&
                dragIndexRef.current !== null &&
                dragIndexRef.current !== index &&
                index === queue.length - 1 && (
                  <div
                    className="w-full rounded-full shrink-0"
                    style={{
                      height: '3px',
                      background: 'var(--accent)',
                      boxShadow: '0 0 8px rgba(10,132,255,0.6)',
                    }}
                  />
                )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Clear All confirmation dialog */}
      {confirmClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
          onClick={handleClearCancel}
        >
          <div
            className="rounded-2xl p-6 w-80 shadow-2xl"
            style={{
              background: '#1c1c1e',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <svg className="w-4.5 h-4.5" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Clear all bounces?</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {queue.length} {queue.length === 1 ? 'item' : 'items'} will be removed. You can undo this.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleClearCancel}
                className="btn-glass flex-1 text-xs justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                className="btn-glass btn-danger flex-1 text-xs justify-center"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

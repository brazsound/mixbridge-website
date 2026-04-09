import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { QueueItem } from '../hooks/useQueue';
import type { TrackInfo } from '../hooks/useProToolsData';
import type { DefaultNaming } from '../hooks/useSettings';
import { applyNamingFromConfig } from '../hooks/useSettings';
import type { NamingSessionAudio, NamingSessionCtx } from '../utils/naming';
import type { Shortcuts } from '../hooks/useShortcuts';
import { formatShortcutForDisplay } from '../hooks/useShortcuts';
import type { RunStatuses } from './RunQueueRunner';
import { StemRow } from './StemRow';
import { BatchActionsBar } from './BatchActionsBar';
import { BatchRenameModal } from './BatchRenameModal';

interface StemListProps {
  shortcuts?: Shortcuts;
  sessionName?: string | null;
  connected: boolean;
  queue: QueueItem[];
  canUndo: boolean;
  canRedo: boolean;
  defaultNaming: DefaultNaming;
  /** Current session sample rate / bit depth for {sampleRate} and {bitDepth} tokens */
  namingSessionAudio?: NamingSessionAudio;
  selectedTracks: TrackInfo[];
  soloedTracks: TrackInfo[];
  mutedTracks: TrackInfo[];
  ptDataLoading: boolean;
  ptDataError: string | null;
  runStatuses: RunStatuses;
  onRefresh: () => Promise<void>;
  onAddBounceNormal: (outputName: string) => void;
  onAddBatchStems: (
    trackIds: string[],
    trackNames: string[],
    naming: DefaultNaming,
    ctx?: { sessionName?: string } & NamingSessionAudio
  ) => void;
  onAddBounceSoloed: (trackNames: string[], naming: DefaultNaming, ctx?: NamingSessionCtx) => void;
  onAddBounceMuted: (trackNames: string[], naming: DefaultNaming, ctx?: NamingSessionCtx) => void;
  onUpdateItemName: (id: string, name: string) => void;
  onUpdateItemFolder: (id: string, customFolderPath: string) => void;
  onClearItemFolder: (id: string) => void;
  onBatchUpdateFolder?: (ids: Set<string>, path: string) => void;
  onBatchRename?: (ids: Set<string>, find: string, replace: string) => void;
  onRemoveItem: (id: string) => void;
  onReorderItems: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveAsTemplate?: () => void;
  onBounceOne?: (item: QueueItem) => void;
  canBounceOne?: boolean;
  queueRunning?: boolean;
  /** Display name for default output folder (e.g. "Bounced Files" or custom path's folder name) */
  defaultOutputFolderDisplay?: string;
}

export function StemList({
  shortcuts,
  sessionName,
  connected,
  queue,
  canUndo,
  canRedo,
  defaultNaming,
  namingSessionAudio = {},
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
  onUpdateItemFolder,
  onClearItemFolder,
  onBatchUpdateFolder,
  onBatchRename,
  onRemoveItem,
  onReorderItems,
  onClearQueue,
  onUndo,
  onRedo,
  onSaveAsTemplate,
  onBounceOne,
  canBounceOne = false,
  queueRunning = false,
  defaultOutputFolderDisplay = 'Bounced Files',
}: StemListProps) {
  const fmt = (s: string) => formatShortcutForDisplay(s);
  const namingCtx = useMemo(
    (): NamingSessionCtx => ({ sessionName: sessionName ?? undefined, ...namingSessionAudio }),
    [sessionName, namingSessionAudio]
  );
  const [warn, setWarn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [pendingEditIndex, setPendingEditIndex] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleToggleSelect = useCallback(
    (index: number, shiftKey: boolean) => {
      const item = queue[index];
      if (!item) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedIndex !== null) {
          const lo = Math.min(lastSelectedIndex, index);
          const hi = Math.max(lastSelectedIndex, index);
          for (let i = lo; i <= hi; i++) {
            const it = queue[i];
            if (it) next.add(it.id);
          }
        } else {
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
        }
        return next;
      });
      setLastSelectedIndex(index);
    },
    [queue, lastSelectedIndex]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      onRemoveItem(id);
    }
    setSelectedIds(new Set());
  }, [selectedIds, onRemoveItem]);

  const handleOutputFolder = useCallback(async () => {
    if (!onBatchUpdateFolder || selectedIds.size === 0) return;
    const res = await window.app?.pickFolder?.();
    if (!res?.canceled && res?.folderPath) onBatchUpdateFolder(selectedIds, res.folderPath);
  }, [selectedIds, onBatchUpdateFolder]);

  const handleBatchRenameApply = useCallback(
    (find: string, replace: string) => {
      if (onBatchRename && selectedIds.size > 0) onBatchRename(selectedIds, find, replace);
    },
    [selectedIds, onBatchRename]
  );

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
      namingCtx
    );
  }, [selectedTracks, defaultNaming, namingCtx, onAddBatchStems]);

  const handleSolo = useCallback(() => {
    setWarn(null);
    if (soloedTracks.length === 0) {
      setWarn('No tracks are soloed in Pro Tools. Solo the tracks you want, then click Solo.');
      return;
    }
    onAddBounceSoloed(soloedTracks.map((t) => t.name), defaultNaming, namingCtx);
  }, [soloedTracks, defaultNaming, namingCtx, onAddBounceSoloed]);

  const handleMute = useCallback(() => {
    setWarn(null);
    if (mutedTracks.length === 0) {
      setWarn('No tracks are muted in Pro Tools. Mute the tracks you want, then click Mute.');
      return;
    }
    onAddBounceMuted(mutedTracks.map((t) => t.name), defaultNaming, namingCtx);
  }, [mutedTracks, defaultNaming, namingCtx, onAddBounceMuted]);

  const handleClearRequest = () => setConfirmClear(true);
  const handleClearConfirm = () => {
    setConfirmClear(false);
    setSelectedIds(new Set());
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

        {/* Save as template / Undo / Redo / Clear */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onSaveAsTemplate && (
            <button
              type="button"
              onClick={onSaveAsTemplate}
              disabled={queue.length === 0}
              title="Save current queue as a template"
              className="btn-glass text-xs"
              style={{
                padding: '4px 8px',
                opacity: queue.length > 0 ? 1 : 0.35,
                borderColor: 'rgba(168,85,247,0.35)',
              }}
            >
              Save as template
            </button>
          )}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={shortcuts ? `Undo (${fmt(shortcuts.undo)})` : 'Undo'}
            aria-label={shortcuts ? `Undo (${fmt(shortcuts.undo)})` : 'Undo'}
            className="btn-glass"
            style={{ padding: '4px 7px', opacity: canUndo ? 1 : 0.35 }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h10a5 5 0 010 10H9m-6-10l4-4M3 10l4 4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title={shortcuts ? `Redo (${fmt(shortcuts.redo)})` : 'Redo'}
            aria-label={shortcuts ? `Redo (${fmt(shortcuts.redo)})` : 'Redo'}
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
        <div data-tutorial="build-stems" className="flex items-center gap-2 mb-4 flex-wrap">
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

          <div className="h-4 w-px" style={{ background: 'var(--divider-strong)' }} />

          {/* Normal Bounce */}
          <button
            type="button"
            onClick={() =>
              onAddBounceNormal(
                applyNamingFromConfig(defaultNaming, { name: 'Mix', ...namingCtx }, 'mix')
              )
            }
            disabled={ptDataLoading}
            title={shortcuts ? `Bounce the full mix as-is (${fmt(shortcuts.mix)})` : 'Bounce the full mix as-is'}
            className="btn-glass"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#34d399' }} />
            Mix
          </button>

          <div className="h-4 w-px" style={{ background: 'var(--divider-strong)' }} />

          {/* Batch */}
          <button
            type="button"
            onClick={handleBatch}
            disabled={ptDataLoading}
            title={shortcuts ? `Create one bounce per selected track (${fmt(shortcuts.batch)})` : 'Create one bounce per selected track'}
            className="btn-glass"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#a855f7' }} />
            Batch
            <span className="text-[var(--text-muted)]">({selectedTracks.length})</span>
          </button>

          {/* Solo */}
          <button
            type="button"
            onClick={handleSolo}
            disabled={ptDataLoading}
            title={shortcuts ? `Capture current solo state as a bounce (${fmt(shortcuts.solo)})` : 'Capture current solo state as a bounce'}
            className="btn-glass"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#facc15' }} />
            Solo
            <span className="text-[var(--text-muted)]">({soloedTracks.length})</span>
          </button>

          {/* Mute */}
          <button
            type="button"
            onClick={handleMute}
            disabled={ptDataLoading}
            title={shortcuts ? `Capture current mute state as a bounce (${fmt(shortcuts.mute)})` : 'Capture current mute state as a bounce'}
            className="btn-glass"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#ef4444' }} />
            Mute
            <span className="text-[var(--text-muted)]">({mutedTracks.length})</span>
          </button>
        </div>
      )}

      {/* Batch actions bar */}
      {selectedIds.size > 0 && (
        <BatchActionsBar
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onOutputFolder={handleOutputFolder}
          onBatchRename={() => setShowBatchRename(true)}
          onDeleteSelected={handleDeleteSelected}
        />
      )}

      {/* Rename modal */}
      <BatchRenameModal
        open={showBatchRename}
        selectedCount={selectedIds.size}
        onApply={handleBatchRenameApply}
        onClose={() => setShowBatchRename(false)}
      />

      {/* Warnings */}
      {warn && (
        <div
          className="mb-3 px-4 py-3 text-xs rounded-xl leading-snug"
          style={{
            background: 'var(--warning-soft)',
            border: '1px solid rgba(255,159,10,0.3)',
            color: 'var(--warning)',
          }}
        >
          {warn}
        </div>
      )}
      {ptDataError && (
        <div
          className="mb-3 px-4 py-3 text-xs rounded-xl leading-snug"
          style={{
            background: 'var(--danger-soft)',
            border: '1px solid rgba(255,69,58,0.3)',
            color: 'var(--danger)',
          }}
        >
          {ptDataError}
        </div>
      )}

      {/* Not connected */}
      {!connected && (
        <div className="empty-state">
          <p className="empty-state-title">Not connected</p>
          <p className="empty-state-body">Connect to Pro Tools to start building your stem list.</p>
        </div>
      )}

      {/* Empty state */}
      {connected && queue.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">No bounces in queue</p>
          <p className="empty-state-body">
            Click Mix for a full mix, or select tracks and use Batch, Solo, or Mute.
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
                isDragOver={dragOverIndex === index && dragIndexRef.current !== null && dragIndexRef.current !== index}
                runStatus={runStatuses[item.id]}
                defaultOutputFolderDisplay={defaultOutputFolderDisplay}
                onUpdateName={(name) => onUpdateItemName(item.id, name)}
                onUpdateFolder={(path) => onUpdateItemFolder(item.id, path)}
                onClearFolder={() => onClearItemFolder(item.id)}
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
                selectionMode={!!(onBatchUpdateFolder && onBatchRename)}
                selected={selectedIds.has(item.id)}
                onToggleSelect={(shiftKey) => handleToggleSelect(index, shiftKey)}
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

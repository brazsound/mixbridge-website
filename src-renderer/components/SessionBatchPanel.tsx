import React, { useState, useCallback, useRef } from 'react';
import type { SessionEntry } from '../hooks/useSessionBatch';

interface SessionBatchPanelProps {
  entries: SessionEntry[];
  running: boolean;
  onAddViaFilePicker: () => void;
  onRemoveEntry: (id: string) => void;
  onEditEntry: (entry: SessionEntry) => void;
  onReorderEntries: (from: number, to: number) => void;
  onClearAll: () => void;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'var(--text-muted)', bg: 'var(--surface-hover)', border: 'var(--divider-strong)' },
  running: { label: 'Running', color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--accent-border)' },
  done:    { label: 'Done',    color: 'var(--success)', bg: 'var(--success-soft)', border: 'rgba(50,215,75,0.3)' },
  error:   { label: 'Error',   color: 'var(--danger)', bg: 'var(--danger-soft)', border: 'rgba(255,69,58,0.3)' },
} as const;

function SessionEntryRow({
  entry,
  index,
  isDragOver,
  running,
  onRemove,
  onEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  entry: SessionEntry;
  index: number;
  isDragOver: boolean;
  running: boolean;
  onRemove: () => void;
  onEdit: () => void;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDrop: (i: number) => void;
  onDragEnd: () => void;
}) {
  const cfg = STATUS_CONFIG[entry.status];
  const isDraggable = !running;

  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? () => onDragStart(index) : undefined}
      onDragOver={isDraggable ? (e) => onDragOver(e, index) : undefined}
      onDrop={isDraggable ? () => onDrop(index) : undefined}
      onDragEnd={isDraggable ? onDragEnd : undefined}
      style={{
        background: isDragOver ? 'var(--accent-soft)' : 'var(--surface-pressed)',
        border: `1px solid ${isDragOver ? 'var(--accent-border-strong)' : 'var(--divider)'}`,
        borderRadius: '12px',
        overflow: 'hidden',
        transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
        transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
        cursor: isDraggable ? 'grab' : 'default',
      }}
    >
      {entry.status === 'running' && (
        <div
          className="animate-pulse"
          style={{ height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}
        />
      )}

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Drag handle */}
        <div
          className="shrink-0"
          style={{ color: isDraggable ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)' }}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <rect x="1" y="2" width="10" height="1.5" rx="0.75" />
            <rect x="1" y="5.25" width="10" height="1.5" rx="0.75" />
            <rect x="1" y="8.5" width="10" height="1.5" rx="0.75" />
          </svg>
        </div>

        {/* Index */}
        <span
          className="shrink-0 text-[10px] font-bold w-5 text-center"
          style={{ color: 'var(--text-muted)' }}
        >
          {index + 1}
        </span>

        {/* Session info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate leading-tight" style={{ color: 'var(--text)' }}>
            {entry.sessionName}
          </p>
          <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {entry.queue.length} bounce{entry.queue.length !== 1 ? 's' : ''}
            {' · '}
            {entry.ptxPath}
          </p>
          {entry.status === 'error' && entry.errorMessage && (
            <p className="text-[11px] leading-snug mt-1 break-words" style={{ color: 'var(--danger)' }}>
              {entry.errorMessage}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span
          className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-widest"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
        >
          {cfg.label}
        </span>

        {/* Actions */}
        {!running && (
          <div className="shrink-0 flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              title="Edit bounce queue & settings"
              className="p-1 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onRemove}
              title="Remove"
              className="p-1 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--danger)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {entry.status === 'running' && (
          <svg className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        )}
        {entry.status === 'done' && (
          <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </div>
  );
}

export function SessionBatchPanel({
  entries,
  running,
  onAddViaFilePicker,
  onRemoveEntry,
  onEditEntry,
  onReorderEntries,
  onClearAll,
}: SessionBatchPanelProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const dragIndexRef = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => { dragIndexRef.current = index; }, []);
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);
  const handleDrop = useCallback((index: number) => {
    const from = dragIndexRef.current;
    if (from !== null && from !== index) onReorderEntries(from, index);
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }, [onReorderEntries]);
  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  const doneCount = entries.filter((e) => e.status === 'done').length;
  const errorCount = entries.filter((e) => e.status === 'error').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Session Batch
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Queue up multiple Pro Tools sessions to stem out unattended.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {entries.length > 0 && !running && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="btn-glass btn-danger text-xs"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onAddViaFilePicker}
            disabled={running}
            className="btn-glass text-xs"
            style={{ borderColor: 'var(--accent-border)' }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Session
          </button>
        </div>
      </div>

      {/* Progress summary */}
      {entries.length > 0 && (doneCount > 0 || errorCount > 0) && (
        <div
          className="shrink-0 flex items-center gap-3 px-3 py-2 rounded-xl mb-3 text-xs"
          style={{ background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{entries.length} sessions</span>
          {doneCount > 0 && (
            <span style={{ color: 'var(--success)' }}>{doneCount} done</span>
          )}
          {errorCount > 0 && (
            <span style={{ color: 'var(--danger)' }}>{errorCount} failed</span>
          )}
          <span style={{ color: 'var(--text-muted)' }}>
            {entries.length - doneCount - errorCount} remaining
          </span>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div
          className="flex-1 flex flex-col items-center justify-center text-center rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px dashed rgba(255,255,255,0.1)' }}
        >
          <svg className="w-10 h-10 mb-3" style={{ color: 'rgba(255,255,255,0.12)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No sessions queued</p>
          <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
            Set up your queue and settings for each session in Normal mode, then use
            <strong style={{ color: 'var(--text-secondary)' }}> Add to Batch</strong>, or click
            <strong style={{ color: 'var(--text-secondary)' }}> Add Session</strong> above to pick a .ptx file.
          </p>
        </div>
      )}

      {/* Session list */}
      {entries.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {entries.map((entry, index) => (
            <SessionEntryRow
              key={entry.id}
              entry={entry}
              index={index}
              isDragOver={dragOverIndex === index}
              running={running}
              onRemove={() => onRemoveEntry(entry.id)}
              onEdit={() => onEditEntry(entry)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {/* Clear All confirmation */}
      {confirmClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
          onClick={() => setConfirmClear(false)}
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
                <svg className="w-4 h-4" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Clear all sessions?</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {entries.length} {entries.length === 1 ? 'session' : 'sessions'} will be removed.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setConfirmClear(false)} className="btn-glass flex-1 text-xs justify-center">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setConfirmClear(false); onClearAll(); }}
                className="btn-glass btn-danger flex-1 text-xs justify-center"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

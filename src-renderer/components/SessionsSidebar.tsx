import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { SessionEntry, SessionEntryStatus } from '../hooks/useSessionBatch';
import { ContextMenu } from './ContextMenu';

interface SessionsSidebarProps {
  entries: SessionEntry[];
  selectedId: string | null;
  running: boolean;
  finished: boolean;
  runError: string | null;
  paused?: boolean;
  /** When true, "Open in Pro Tools" is available in session context menu */
  connected?: boolean;
  onSelect: (id: string) => void;
  /** Open file picker to add .ptx sessions to the batch. */
  onAddSessions: () => void;
  /** Add the session currently open in Pro Tools. Undefined when not connected. */
  onAddCurrentSession: (() => void) | undefined;
  /** True when the session open in Pro Tools is not in the list (e.g. was removed). */
  currentSessionNotInList?: boolean;
  /** ID of the session entry that is currently open in Pro Tools (for "active" indicator). */
  activeInProToolsId?: string | null;
  onRemoveEntry: (id: string) => void;
  onReorderEntries: (from: number, to: number) => void;
  onRun: () => void;
  onRerun: () => void;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

const STATUS_DOT: Record<Exclude<SessionEntryStatus, 'done'>, string> = {
  pending: 'rgba(255,255,255,0.3)',
  running: '#3b82f6',
  error:   '#ff453a',
};

function StatusDot({ status }: { status: SessionEntryStatus }) {
  if (status === 'done') return null;
  if (status === 'running') {
    return (
      <span
        className="shrink-0 w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: STATUS_DOT.running, boxShadow: '0 0 5px #3b82f6' }}
      />
    );
  }
  return (
    <span
      className="shrink-0 w-1.5 h-1.5 rounded-full"
      style={{ background: STATUS_DOT[status] }}
    />
  );
}

export function SessionsSidebar({
  entries,
  selectedId,
  running,
  finished,
  runError,
  paused = false,
  connected = false,
  onSelect,
  onAddSessions,
  onAddCurrentSession,
  currentSessionNotInList = false,
  activeInProToolsId = null,
  onRemoveEntry,
  onReorderEntries,
  onRun,
  onRerun,
  onCancel,
  onPause,
  onResume,
}: SessionsSidebarProps) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: SessionEntry } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SessionEntry | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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

  const pendingCount = entries.filter((e) => e.status !== 'done').length;
  const canRun = !running && !paused && entries.length > 0;

  useEffect(() => {
    if (!pendingRemove) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingRemove(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pendingRemove]);

  return (
    <div className="flex flex-col h-full" style={{ gap: '0' }}>
      {pendingRemove && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPendingRemove(null)}
        >
          <div
            className="rounded-xl px-4 py-3 max-w-[280px]"
            style={{
              background: 'rgba(28,28,30,0.98)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
              Remove &quot;{pendingRemove.sessionName}&quot; from batch?
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Queue and settings will be lost.
            </p>
            <div className="flex gap-2 mt-3 justify-end">
              <button
                type="button"
                onClick={() => setPendingRemove(null)}
                className="btn-glass text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveEntry(pendingRemove.id);
                  setPendingRemove(null);
                }}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{
                  background: 'var(--danger-soft)',
                  color: '#ff8a80',
                  border: '1px solid rgba(255,69,58,0.3)',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: 'Open in Pro Tools',
              onClick: () => {
                void window.ptsl?.openSession(contextMenu.entry.ptxPath);
              },
              disabled: !connected || running,
            },
            {
              label: 'Show in Folder',
              onClick: () => {
                window.app?.showItemInFolder(contextMenu.entry.ptxPath);
              },
            },
            {
              label: 'Remove',
              onClick: () => {
                setPendingRemove(contextMenu.entry);
                setContextMenu(null);
              },
              danger: true,
              disabled: running,
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-2 mb-3" data-tutorial="sessions">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
        >
          Sessions
        </p>
        <div className="flex items-center gap-0.5">
          <div className="relative">
            <button
              type="button"
              onClick={onAddCurrentSession}
              disabled={running || !onAddCurrentSession}
              title={
                !onAddCurrentSession
                  ? 'Connect to Pro Tools first'
                  : currentSessionNotInList
                  ? 'The session open in Pro Tools was removed. Click to add it back.'
                  : 'Load the session currently open in Pro Tools'
              }
              className="p-1 rounded-lg transition-colors"
              style={{ color: onAddCurrentSession && !running ? 'var(--text-muted)' : 'rgba(255,255,255,0.18)', cursor: onAddCurrentSession && !running ? 'pointer' : 'not-allowed' }}
              onMouseEnter={(e) => { if (onAddCurrentSession && !running) (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = onAddCurrentSession && !running ? 'var(--text-muted)' : 'rgba(255,255,255,0.18)'; }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={onAddSessions}
            disabled={running}
            title="Add sessions (pick .ptx files)"
            className="p-1 rounded-lg transition-colors"
            style={{ color: !running ? 'var(--text-muted)' : 'rgba(255,255,255,0.18)', cursor: !running ? 'pointer' : 'not-allowed' }}
            onMouseEnter={(e) => { if (!running) (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = !running ? 'var(--text-muted)' : 'rgba(255,255,255,0.18)'; }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {currentSessionNotInList && onAddCurrentSession && !running && (
        <button
          type="button"
          onClick={onAddCurrentSession}
          className="w-full shrink-0 mb-2 px-2 py-1.5 rounded-lg text-left text-[10px] transition-colors"
          style={{
            background: 'rgba(255, 159, 10, 0.12)',
            border: '1px solid rgba(255, 159, 10, 0.3)',
            color: '#ffd580',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 159, 10, 0.18)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 159, 10, 0.12)';
          }}
        >
          Session open in Pro Tools was removed. <strong>Add back</strong>
        </button>
      )}

      {/* Sessions list */}
      <div
        className="flex-1 overflow-y-auto space-y-0.5"
        style={{ minHeight: 0 }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverIndex(null);
          }
        }}
      >
        {entries.length === 0 && (
          <div
            className="px-2 py-8 text-center rounded-xl"
            style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
          >
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No sessions yet</p>
            <p className="text-[9px] mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Press <strong style={{ color: 'rgba(255,255,255,0.35)' }}>+</strong> to pick .ptx files
            </p>
          </div>
        )}

        {entries.map((entry, index) => {
          const isSelected = entry.id === selectedId;
          const isHovered = hoveredId === entry.id;
          const from = dragIndexRef.current;
          const insertAt = dragOverIndex;
          const isActiveDrag = from !== null && insertAt !== null && from !== insertAt;

          // Line can appear in a DIFFERENT fragment from the hovered row (e.g. line between 1&2 is in row 2's fragment).
          // When we insert at K, the line position depends on drag source:
          // - from < K (drag down): item goes between row K and K+1 → line before row K+1
          // - from > K (drag up): item goes between row K-1 and K → line before row K
          // - K === 0: line before row 0
          // - K === last: line after last row
          const showInsertionBefore =
            isActiveDrag &&
            (insertAt === 0
              ? index === 0
              : insertAt < entries.length - 1 &&
                ((from < insertAt && index === insertAt + 1) || (from > insertAt && index === insertAt)));
          const showInsertionAfter = isActiveDrag && insertAt === entries.length - 1 && index === entries.length - 1;

          return (
            <React.Fragment key={entry.id}>
              {showInsertionBefore && (
                <div
                  className="w-full shrink-0 py-1 flex items-center"
                  onDragOver={!running ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; handleDragOver(e, insertAt); } : undefined}
                  onDrop={!running ? (e) => { e.preventDefault(); handleDrop(insertAt); } : undefined}
                >
                  <div
                    className="w-full rounded-full"
                    style={{
                      height: '3px',
                      background: 'var(--accent)',
                      boxShadow: '0 0 8px rgba(10,132,255,0.6)',
                    }}
                  />
                </div>
              )}
              <div
                {...(entry.sessionName === 'Demo Session' ? { 'data-tutorial': 'remove-session' } : {})}
                draggable={!running}
                onDragStart={!running ? (e) => {
                  e.dataTransfer.setData('text/plain', String(index));
                  e.dataTransfer.effectAllowed = 'move';
                  handleDragStart(index);
                } : undefined}
                onDragOver={!running ? (e) => handleDragOver(e, index) : undefined}
                onDrop={!running ? () => handleDrop(index) : undefined}
                onDragEnd={!running ? handleDragEnd : undefined}
                onClick={() => onSelect(entry.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, entry });
                }}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  borderRadius: '10px',
                  padding: '7px 8px',
                  cursor: running ? 'default' : 'pointer',
                  background:
                    entry.status === 'done'
                      ? 'rgba(50, 215, 75, 0.08)'
                      : isSelected
                      ? 'rgba(255,255,255,0.10)'
                      : isHovered
                      ? 'rgba(255,255,255,0.05)'
                      : 'transparent',
                  border:
                    entry.status === 'done'
                      ? '1px solid rgba(50, 215, 75, 0.35)'
                      : isSelected
                      ? '1px solid rgba(255,255,255,0.14)'
                      : '1px solid transparent',
                  borderLeft:
                    activeInProToolsId === entry.id
                      ? '3px solid var(--success)'
                      : undefined,
                  boxShadow:
                    activeInProToolsId === entry.id
                      ? 'inset 3px 0 12px -4px rgba(50, 215, 75, 0.5)'
                      : undefined,
                  transition: 'background 0.12s, border-color 0.12s, box-shadow 0.12s',
                }}
                title={activeInProToolsId === entry.id ? 'Open in Pro Tools' : undefined}
              >
              <div className="flex items-center gap-1.5">
                <StatusDot status={entry.status} />
                <p
                  className="text-xs font-medium truncate flex-1 leading-snug"
                  style={{ color: isSelected ? 'var(--text)' : 'var(--text-secondary)' }}
                >
                  {entry.sessionName}
                </p>

                {/* Remove button (shown on hover, not when running) */}
                {isHovered && !running && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPendingRemove(entry); }}
                    title="Remove"
                    className="shrink-0 p-0.5 rounded transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--danger)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Job count + error snippet */}
              <div className="flex items-center gap-1 mt-0.5 pl-3">
                <p className="text-[10px] leading-none" style={{ color: 'var(--text-muted)' }}>
                  {entry.queue.length} bounce{entry.queue.length !== 1 ? 's' : ''}
                </p>
                {entry.status === 'error' && entry.errorMessage && (
                  <p className="text-[10px] leading-none truncate" style={{ color: '#ff8a80', maxWidth: '80px' }}>
                    · {entry.errorMessage}
                  </p>
                )}
              </div>
            </div>
            {showInsertionAfter && (
              <div
                className="w-full shrink-0 py-1 flex items-center"
                onDragOver={!running ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; handleDragOver(e, insertAt); } : undefined}
                onDrop={!running ? (e) => { e.preventDefault(); handleDrop(insertAt); } : undefined}
              >
                <div
                  className="w-full rounded-full"
                  style={{
                    height: '3px',
                    background: 'var(--accent)',
                    boxShadow: '0 0 8px rgba(10,132,255,0.6)',
                  }}
                />
              </div>
            )}
          </React.Fragment>
          );
        })}
      </div>

      {/* Run controls at bottom */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '12px', marginTop: '12px' }}>
        {runError && (
          <p
            className="text-[10px] leading-snug break-words px-2 py-1.5 rounded-lg mb-2"
            style={{ color: '#ff8a80', background: 'var(--danger-soft)', border: '1px solid rgba(255,69,58,0.2)' }}
          >
            {runError}
          </p>
        )}
        {paused && !runError && (
          <p
            className="text-[10px] px-2 py-1 rounded-lg text-center mb-1.5"
            style={{ color: '#ffd580', background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.25)' }}
          >
            Paused — make adjustments, then Resume.
          </p>
        )}
        {finished && !running && !runError && (
          <>
            <p
              className="text-[10px] px-2 py-1 rounded-lg text-center mb-1.5"
              style={{ color: 'var(--success)', background: 'var(--success-soft)' }}
            >
              All done!
            </p>
            <button type="button" onClick={onRerun} className="w-full btn-glass text-xs justify-center mb-1.5">
              Run Again
            </button>
          </>
        )}
        <div className="flex gap-1.5 flex-wrap">
          {running ? (
            <>
              <button
                type="button"
                disabled
                className="py-2 text-xs font-semibold transition-all shrink-0 flex-1 flex items-center justify-center gap-1.5 min-w-0"
                style={{
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'default',
                }}
              >
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Running…
              </button>
              {onCancel && (
                <button type="button" onClick={onCancel} className="btn-glass py-2 text-xs shrink-0" style={{ borderRadius: '10px' }} title="Stop after current session">
                  Cancel
                </button>
              )}
              {onPause && (
                <button type="button" onClick={onPause} className="btn-glass py-2 text-xs shrink-0" style={{ borderRadius: '10px' }} title="Pause after current session">
                  Pause
                </button>
              )}
            </>
          ) : paused && onResume && onCancel ? (
            <>
              <button
                type="button"
                onClick={onResume}
                className="py-2 text-xs font-semibold transition-all shrink-0 flex-1"
                style={{
                  borderRadius: '10px',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 0 12px var(--accent-glow)',
                  cursor: 'pointer',
                }}
              >
                Resume
              </button>
              <button type="button" onClick={onCancel} className="btn-glass py-2 text-xs shrink-0" style={{ borderRadius: '10px' }} title="Cancel and clear pause">
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onRun}
              disabled={!canRun || (finished && !runError)}
              className="w-full py-2 text-xs font-semibold transition-all"
              style={{
                borderRadius: '10px',
                background: canRun && !(finished && !runError) ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: canRun && !(finished && !runError) ? '#fff' : 'var(--text-muted)',
                border: canRun && !(finished && !runError) ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)',
                boxShadow: canRun && !(finished && !runError) ? '0 0 12px var(--accent-glow)' : 'none',
                cursor: canRun && !(finished && !runError) ? 'pointer' : 'not-allowed',
                opacity: canRun && !(finished && !runError) ? 1 : 0.5,
                letterSpacing: '-0.01em',
              }}
            >
              {entries.length === 0
                ? 'No sessions'
                : paused
                ? `Paused — ${pendingCount} left`
                : `Run ${pendingCount} session${pendingCount !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

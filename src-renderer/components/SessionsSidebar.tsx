import React, { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  /** Available templates to apply to a session */
  templates?: { id: string; name: string }[];
  /** Called when user picks a template from the session context menu */
  onApplyTemplate?: (sessionId: string, templateId: string) => void;
}

const STATUS_DOT: Record<Exclude<SessionEntryStatus, 'done'>, string> = {
  pending: 'rgba(255,255,255,0.3)',
  running: 'var(--accent)',
  error:   'var(--danger)',
};

function StatusDot({ status }: { status: SessionEntryStatus }) {
  if (status === 'done') return null;
  if (status === 'running') {
    return (
      <span
        className="shrink-0 w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: STATUS_DOT.running, boxShadow: '0 0 6px var(--accent-glow)' }}
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
  templates = [],
  onApplyTemplate,
}: SessionsSidebarProps) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: SessionEntry } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SessionEntry | null>(null);
  const [dismissedRemovedSessionBanner, setDismissedRemovedSessionBanner] = useState(false);

  useEffect(() => {
    if (!currentSessionNotInList) setDismissedRemovedSessionBanner(false);
  }, [currentSessionNotInList]);

  const handleDragStart = useCallback((index: number, id: string) => {
    dragIndexRef.current = index;
    setDraggingId(id);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from !== null && from !== index) onReorderEntries(from, index);
    dragIndexRef.current = null;
    setDragOverIndex(null);
    setDraggingId(null);
  }, [onReorderEntries]);
  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
    setDraggingId(null);
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

  const removeConfirmModal = pendingRemove && (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={() => setPendingRemove(null)}
    >
      <div
        className="rounded-xl px-4 py-3 max-w-[280px]"
        style={{
          background: 'var(--modal-surface)',
          border: '1px solid var(--glass-border-hi)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
          Remove &quot;{pendingRemove.sessionName}&quot; from sessions list?
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
  );

  return (
    <div className="flex flex-col h-full gap-3">
      {removeConfirmModal && createPortal(removeConfirmModal, document.body)}
      {contextMenu && createPortal(
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: 'Open in Pro Tools',
              onClick: () => { void window.ptsl?.openSession(contextMenu.entry.ptxPath); },
              disabled: !connected || running,
            },
            {
              label: 'Show in Folder',
              onClick: () => { window.app?.showItemInFolder(contextMenu.entry.ptxPath); },
            },
            ...(templates.length > 0 && onApplyTemplate
              ? [
                  {
                    label: 'Apply Template',
                    onClick: () => {},
                    header: true,
                    separator: true,
                    icon: (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                      </svg>
                    ),
                  },
                  ...templates.map((t) => ({
                    label: t.name,
                    onClick: () => { onApplyTemplate(contextMenu.entry.id, t.id); },
                    icon: (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ),
                  })),
                ]
              : []),
            {
              label: 'Remove',
              onClick: () => { setPendingRemove(contextMenu.entry); setContextMenu(null); },
              danger: true,
              disabled: running,
              separator: true,
            },
          ]}
          onClose={() => setContextMenu(null)}
        />,
        document.body
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-1" data-tutorial="sessions">
        <p className="panel-header-title">Sessions</p>
        <div className="flex items-center gap-0.5">
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
            className="btn-icon p-1 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onAddSessions}
            disabled={running}
            title="Add sessions (pick .ptx files)"
            className="btn-icon p-1 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* "Session removed" banner */}
      {currentSessionNotInList && onAddCurrentSession && !running && !dismissedRemovedSessionBanner && (
        <div
          className="shrink-0 px-3 py-2 rounded-lg flex items-start gap-2"
          style={{
            background: 'var(--warning-soft)',
            border: '1px solid rgba(255, 159, 10, 0.3)',
            color: '#ffd580',
          }}
        >
          <p className="text-[10px] flex-1 min-w-0 leading-snug">
            Session open in Pro Tools was removed.{' '}
            <button
              type="button"
              onClick={onAddCurrentSession}
              className="font-bold hover:underline underline-offset-2"
              style={{ color: '#ffd580' }}
            >
              Add back
            </button>
          </p>
          <button
            type="button"
            onClick={() => setDismissedRemovedSessionBanner(true)}
            className="shrink-0 p-0.5 rounded transition-colors hover:bg-[rgba(255,159,10,0.2)]"
            style={{ color: 'rgba(255,213,128,0.85)' }}
            aria-label="Dismiss"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Sessions list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverIndex(null);
          }
        }}
      >
        {entries.length === 0 && (
          <div className="empty-state mt-2">
            <p className="empty-state-title text-[11px]">No sessions</p>
            <p className="empty-state-body text-[10px]">
              Press <strong style={{ color: 'var(--text-muted)' }}>+</strong> to pick .ptx files
            </p>
          </div>
        )}

        {entries.map((entry, index) => {
          const isSelected = entry.id === selectedId;
          const isHovered = hoveredId === entry.id;
          const from = dragIndexRef.current;
          const insertAt = dragOverIndex;
          const isActiveDrag = from !== null && insertAt !== null && from !== insertAt;

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
                    style={{ height: '2px', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
                  />
                </div>
              )}
              <div
                {...(entry.sessionName === 'Demo Session' ? { 'data-tutorial': 'remove-session' } : {})}
                draggable={!running}
                onDragStart={!running ? (e) => {
                  e.dataTransfer.setData('text/plain', String(index));
                  e.dataTransfer.effectAllowed = 'move';
                  handleDragStart(index, entry.id);
                } : undefined}
                onDragOver={!running ? (e) => handleDragOver(e, index) : undefined}
                onDrop={!running ? (e) => handleDrop(e, index) : undefined}
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
                  borderRadius: 'var(--radius-lg)',
                  padding: '7px 8px',
                  cursor: running ? 'default' : draggingId === entry.id ? 'grabbing' : draggingId ? 'grab' : 'pointer',
                  background:
                    entry.status === 'done'
                      ? 'rgba(50,215,75,0.07)'
                      : dragOverIndex === index && draggingId && draggingId !== entry.id
                      ? 'var(--accent-soft)'
                      : isHovered
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(255,255,255,0.05)',
                  border:
                    entry.status === 'done'
                      ? '1px solid rgba(50,215,75,0.3)'
                      : dragOverIndex === index && draggingId && draggingId !== entry.id
                      ? '1px solid var(--accent-border)'
                      : '1px solid var(--divider)',
                  borderLeft:
                    activeInProToolsId === entry.id
                      ? '3px solid var(--success)'
                      : undefined,
                  boxShadow:
                    activeInProToolsId === entry.id
                      ? 'inset 3px 0 10px -4px rgba(50,215,75,0.45)'
                      : isSelected
                      ? 'inset 3px 0 0 var(--accent)'
                      : undefined,
                  transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                }}
                title={activeInProToolsId === entry.id ? 'Open in Pro Tools' : undefined}
              >
                {/* Row 1: status dot + name + remove */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <StatusDot status={entry.status} />
                  <p
                    className="text-[12px] font-medium truncate flex-1 leading-snug"
                    style={{ color: isSelected ? 'var(--text)' : 'var(--text-secondary)' }}
                  >
                    {entry.sessionName}
                  </p>
                  {isHovered && !running && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingRemove(entry); }}
                      title="Remove"
                      className="shrink-0 p-0.5 rounded transition-colors hover:text-[var(--danger)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Row 2: bounce count badge + error */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span
                    className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md"
                    style={{
                      background: 'var(--surface-pressed)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--divider)',
                    }}
                  >
                    {entry.queue.length}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {entry.queue.length === 1 ? 'bounce' : 'bounces'}
                  </span>
                  {entry.status === 'error' && entry.errorMessage && (
                    <p className="text-[10px] truncate flex-1 min-w-0" style={{ color: '#ff8a80' }}>
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
                    style={{ height: '2px', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Run controls at bottom */}
      <div
        className="shrink-0 flex flex-col gap-2"
        style={{ borderTop: '1px solid var(--divider)', paddingTop: 'var(--space-3)' }}
      >
        {runError && (
          <p
            className="text-[10px] leading-snug break-words px-3 py-2 rounded-lg"
            style={{ color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid rgba(255,69,58,0.2)' }}
          >
            {runError}
          </p>
        )}
        {paused && !runError && (
          <p
            className="text-[10px] px-3 py-1.5 rounded-lg text-center"
            style={{ color: 'var(--warning)', background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.25)' }}
          >
            Paused — make adjustments, then Resume.
          </p>
        )}
        {finished && !running && !runError && (
          <>
            <p
              className="text-[10px] px-3 py-1.5 rounded-lg text-center"
              style={{ color: 'var(--success)', background: 'var(--success-soft)' }}
            >
              All done!
            </p>
            <button type="button" onClick={onRerun} className="w-full btn-glass text-xs justify-center">
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
                className="py-2 text-xs font-semibold flex-1 flex items-center justify-center gap-1.5 min-w-0"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface-pressed)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--divider)',
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
                <button type="button" onClick={onCancel} className="btn-glass py-2 text-xs shrink-0" style={{ borderRadius: 'var(--radius-lg)' }} title="Stop after current session">
                  Cancel
                </button>
              )}
              {onPause && (
                <button type="button" onClick={onPause} className="btn-glass py-2 text-xs shrink-0" style={{ borderRadius: 'var(--radius-lg)' }} title="Pause after current session">
                  Pause
                </button>
              )}
            </>
          ) : paused && onResume && onCancel ? (
            <>
              <button
                type="button"
                onClick={onResume}
                className="py-2 text-xs font-semibold flex-1"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 0 12px var(--accent-glow)',
                  cursor: 'pointer',
                }}
              >
                Resume
              </button>
              <button type="button" onClick={onCancel} className="btn-glass py-2 text-xs shrink-0" style={{ borderRadius: 'var(--radius-lg)' }} title="Cancel and clear pause">
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
                borderRadius: 'var(--radius-lg)',
                background: canRun && !(finished && !runError) ? 'var(--accent)' : 'var(--surface-pressed)',
                color: canRun && !(finished && !runError) ? '#fff' : 'var(--text-muted)',
                border: canRun && !(finished && !runError) ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--divider)',
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

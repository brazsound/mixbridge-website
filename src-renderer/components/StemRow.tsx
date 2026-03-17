import React, { useState, useEffect } from 'react';
import type { QueueItem } from '../hooks/useQueue';
import type { RunStatus } from './RunQueueRunner';
import { ContextMenu } from './ContextMenu';

interface StemRowProps {
  /** data-tutorial attribute for first row (tutorial targeting) */
  dataTutorial?: string;
  item: QueueItem;
  index: number;
  isDragOver: boolean;
  runStatus?: RunStatus;
  onUpdateName: (name: string) => void;
  onRemove: () => void;
  onBounceOne?: () => void;
  canBounceOne?: boolean;
  queueRunning?: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
  /** When true, this row enters edit mode (used by parent for Tab navigation). */
  externalEdit?: boolean;
  /** Called after externalEdit is consumed so the parent can clear the flag. */
  onExternalEditConsumed?: () => void;
  /** Called when the user presses Tab inside the name input. */
  onTabToNext?: () => void;
}

const TYPE_CONFIG = {
  bounce_normal: {
    label: 'MIX',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.10)',
    border: 'rgba(52,211,153,0.28)',
    text: '#6ee7b7',
  },
  batch_stems: {
    label: 'STEM',
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.12)',
    border: 'rgba(168,85,247,0.3)',
    text: '#d8b4fe',
  },
  bounce_soloed: {
    label: 'SOLO',
    color: '#facc15',
    bg: 'rgba(250,204,21,0.10)',
    border: 'rgba(250,204,21,0.3)',
    text: '#fde68a',
  },
  bounce_muted: {
    label: 'MUTE',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,58,0.28)',
    text: '#fca5a5',
  },
  bounce_range: {
    label: 'RANGE',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.10)',
    border: 'rgba(56,189,248,0.28)',
    text: '#bae6fd',
  },
} as const;

export function StemRow({
  dataTutorial,
  item,
  index,
  isDragOver,
  runStatus,
  onUpdateName,
  onRemove,
  onBounceOne,
  canBounceOne = false,
  queueRunning = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  externalEdit,
  onExternalEditConsumed,
  onTabToNext,
}: StemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(item.outputName);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (externalEdit) {
      setDraftName(item.outputName);
      setEditing(true);
      onExternalEditConsumed?.();
    }
  }, [externalEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRunning = runStatus?.state === 'running';
  const isDone    = runStatus?.state === 'done';
  const isError   = runStatus?.state === 'error';

  const cfg = TYPE_CONFIG[item.type];

  let subtitle = '';
  let expandList: string[] = [];
  let expandLabel = '';

  if (item.type === 'bounce_normal') {
    subtitle = 'Full mix, no track changes';
  } else if (item.type === 'batch_stems') {
    subtitle = item.trackName;
  } else if (item.type === 'bounce_soloed') {
    subtitle = `${item.trackNames.length} track${item.trackNames.length !== 1 ? 's' : ''} soloed`;
    expandList = item.trackNames;
    expandLabel = 'Soloed (included):';
  } else if (item.type === 'bounce_muted') {
    subtitle = item.trackNames.length > 0
      ? `${item.trackNames.length} track${item.trackNames.length !== 1 ? 's' : ''} muted`
      : 'No muted tracks';
    expandList = item.trackNames;
    expandLabel = 'Muted (excluded):';
  } else if (item.type === 'bounce_range') {
    subtitle = item.rangeSource === 'marker'
      ? `Marker: ${item.markerName ?? item.markerNumber}`
      : 'Timeline selection';
  }

  const hasDetail = expandList.length > 0;

  const commitName = () => {
    setEditing(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== item.outputName) onUpdateName(trimmed);
    else setDraftName(item.outputName);
  };

  const borderColor = isError
    ? 'rgba(255,69,58,0.5)'
    : isDone
    ? 'rgba(50,215,75,0.35)'
    : isRunning
    ? 'rgba(10,132,255,0.55)'
    : isDragOver
    ? 'rgba(10,132,255,0.6)'
    : 'rgba(255,255,255,0.08)';

  const bgColor = isError
    ? 'rgba(255,69,58,0.06)'
    : isDone
    ? 'rgba(50,215,75,0.04)'
    : isRunning
    ? 'rgba(10,132,255,0.06)'
    : isDragOver
    ? 'rgba(10,132,255,0.08)'
    : 'rgba(255,255,255,0.04)';

  const isDraggable = !isRunning && !editing;

  return (
    <div
      {...(dataTutorial ? { 'data-tutorial': dataTutorial } : {})}
      draggable={isDraggable}
      onDragStart={isDraggable ? () => onDragStart(index) : undefined}
      onDragOver={isDraggable ? (e) => onDragOver(e, index) : undefined}
      onDrop={isDraggable ? () => onDrop(index) : undefined}
      onDragEnd={isDraggable ? onDragEnd : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
        overflow: 'hidden',
        transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
        cursor: isRunning || editing ? 'default' : 'grab',
      }}
    >
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            ...(onBounceOne
              ? [{
                  label: 'Bounce only this stem',
                  onClick: onBounceOne,
                  disabled: !canBounceOne || queueRunning || isRunning,
                }]
              : []),
            {
              label: 'Remove',
              onClick: onRemove,
              danger: true,
              disabled: isRunning,
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
      {/* Running shimmer bar */}
      {isRunning && (
        <div
          className="animate-pulse"
          style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          }}
        />
      )}

      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <div
          className="shrink-0 flex flex-col gap-0.5 py-0.5"
          style={{
            cursor: isDraggable ? 'grab' : 'default',
            color: isDraggable ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
            transition: 'color 0.15s',
          }}
          title={isDraggable ? 'Drag to reorder' : undefined}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <rect x="1" y="2" width="10" height="1.5" rx="0.75" />
            <rect x="1" y="5.25" width="10" height="1.5" rx="0.75" />
            <rect x="1" y="8.5" width="10" height="1.5" rx="0.75" />
          </svg>
        </div>

        {/* Expand chevron */}
        <button
          type="button"
          onClick={() => hasDetail && setExpanded((e) => !e)}
          tabIndex={hasDetail ? 0 : -1}
          aria-hidden={!hasDetail}
          className="shrink-0 transition-colors"
          style={{ color: hasDetail ? 'var(--text-muted)' : 'transparent', cursor: hasDetail ? 'pointer' : 'default' }}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Type badge */}
        <span
          className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-widest"
          style={{
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            color: cfg.text,
            letterSpacing: '0.06em',
          }}
        >
          {cfg.label}
        </span>

        {/* Name + subtitle */}
        <div className="flex-1 min-w-0">
          {editing && !isRunning ? (
            <input
              type="text"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') {
                  setEditing(false);
                  setDraftName(item.outputName);
                }
                if (e.key === 'Tab') {
                  e.preventDefault();
                  commitName();
                  onTabToNext?.();
                }
              }}
              className="w-full bg-transparent text-sm focus:outline-none"
              style={{
                color: 'var(--text)',
                borderBottom: '1px solid var(--accent)',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => !isRunning && setEditing(true)}
              title={isRunning ? undefined : 'Click to rename'}
              disabled={isRunning}
              className="text-left w-full disabled:cursor-default group"
            >
              <span
                className="text-sm truncate block leading-tight transition-colors"
                style={{ color: 'var(--text)' }}
              >
                {item.outputName}
              </span>
              {subtitle && (
                <span
                  className="text-[11px] truncate block leading-tight mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {subtitle}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Status icons / remove */}
        <div className="shrink-0 flex items-center gap-3">
          {isRunning && (
            <svg
              className="w-4 h-4 animate-spin"
              style={{ color: 'var(--accent)' }}
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          )}
          {isDone && (
            <svg className="w-4 h-4" style={{ color: 'var(--success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isError && (
            <svg className="w-4 h-4" style={{ color: 'var(--danger)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {!isRunning && onBounceOne && (
            <button
              type="button"
              onClick={onBounceOne}
              disabled={!canBounceOne || queueRunning}
              title={!canBounceOne ? 'Capture range and select mix sources first' : queueRunning ? 'Wait for current bounce to finish' : 'Bounce only this stem'}
              className="p-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: canBounceOne && !queueRunning ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          {!isRunning && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove"
              className="p-1 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded track list */}
      {expanded && hasDetail && (
        <div
          className="px-10 pb-3 pt-1.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.07em' }}
          >
            {expandLabel}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {expandList.map((t) => (
              <span
                key={t}
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-secondary)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Inline error */}
      {isError && runStatus?.error && (
        <div
          className="px-3 pb-3 pt-0"
          style={{ borderTop: '1px solid rgba(255,69,58,0.15)' }}
        >
          <p
            className="text-[11px] leading-snug break-words"
            style={{ color: '#ff8a80' }}
          >
            {runStatus.error}
          </p>
        </div>
      )}
    </div>
  );
}

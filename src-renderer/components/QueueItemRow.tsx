import type { QueueItem } from '../hooks/useQueue';

interface QueueItemRowProps {
  item: QueueItem;
  onUpdateName: (name: string, alt?: string) => void;
  onRemove: () => void;
}

function typeLabel(item: QueueItem): string {
  switch (item.type) {
    case 'batch_stems':
      return `Batch stems (${item.trackNames.length} tracks)`;
    case 'bounce_soloed':
      return `Bounce soloed (${item.trackNames.length} tracks)`;
    case 'bounce_muted':
      return `Bounce muted (${item.trackNames.length} muted)`;
    case 'bounce_range':
      return item.rangeSource === 'marker' && item.markerName
        ? `Bounce range: ${item.markerName}`
        : 'Bounce timeline selection';
    default:
      return 'Bounce';
  }
}

export function QueueItemRow({ item, onUpdateName, onRemove }: QueueItemRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <span className="text-sm text-[var(--text-muted)] w-44 shrink-0">{typeLabel(item)}</span>
      <input
        type="text"
        value={item.outputName}
        onChange={(e) => onUpdateName(e.target.value)}
        className="flex-1 min-w-0 px-2 py-1.5 text-sm rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        placeholder="Output name"
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
        title="Remove"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </li>
  );
}

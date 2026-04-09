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
    <li className="flex items-center gap-3 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-4 py-3 transition-colors hover:bg-[var(--surface-hover-strong)] hover:border-[var(--divider-strong)]">
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
        className="btn-icon w-7 h-7 rounded-md transition-colors hover:text-[var(--danger)] hover:bg-[var(--danger-soft)]"
        title="Remove"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}

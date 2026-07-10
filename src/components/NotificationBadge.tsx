/** Small red count pill for unread/untriaged notification badges. */
export function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} new`}
      className="inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none shrink-0"
      style={{
        background: '#ef4444',
        color: '#fff',
        minWidth: 16,
        height: 16,
        padding: '0 4px',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

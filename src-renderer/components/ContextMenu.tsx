import { useEffect, useRef } from 'react';
import { useModalEscape } from '../hooks/useModalEscape';

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  /** Renders a thin divider line above this item */
  separator?: boolean;
  /** Renders as a non-interactive section label instead of a button */
  header?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useModalEscape(onClose, true);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [onClose]);

  // Adjust position so the menu doesn't overflow the viewport
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const menuW = 190;
  const menuH = items.length * 32 + 16;
  const left = x + menuW > viewW ? Math.max(0, viewW - menuW - 4) : x;
  const top = y + menuH > viewH ? Math.max(0, viewH - menuH - 4) : y;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Context menu"
      className="menu-panel fixed z-[9999] py-1 min-w-[170px]"
      style={{ left, top }}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separator && (
            <div className="my-1 mx-2" style={{ height: '1px', background: 'var(--divider)' }} />
          )}
          {item.header ? (
            <div
              className="flex items-center gap-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: item.danger ? 'var(--danger)' : 'var(--text)' }}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** Compact styling for inline use (e.g. TechnicalPanel) */
  compact?: boolean;
  /** Open dropdown above the trigger to avoid overlapping content below */
  dropdownPlacement?: 'below' | 'above';
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyMessage = 'No options',
  disabled = false,
  compact = false,
  dropdownPlacement = 'below',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
    listMaxHeight: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  useEffect(() => {
    if (!open) {
      setDropdownRect(null);
      return;
    }
    setSearch('');
    const trigger = containerRef.current?.querySelector('button');
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const gap = 4;
      const padding = 12;
      const searchInputHeight = 40;
      const maxListHeight = 200;
      const spaceBelow = window.innerHeight - rect.bottom - gap - padding - searchInputHeight;
      const spaceAbove = rect.top - gap - padding - searchInputHeight;
      const listMaxHeight = Math.min(
        maxListHeight,
        dropdownPlacement === 'above' ? spaceAbove : spaceBelow
      );
      setDropdownRect({
        left: rect.left,
        top: dropdownPlacement === 'above' ? rect.top : rect.bottom,
        width: rect.width,
        listMaxHeight: Math.max(80, listMaxHeight),
      });
    }
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, dropdownPlacement]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const handleSelect = (opt: SearchableSelectOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const triggerStyle: React.CSSProperties = compact
    ? {
        padding: '4px 8px',
        fontSize: '12px',
        minHeight: '24px',
      }
    : {
        padding: '8px 12px',
        fontSize: '12px',
      };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full text-left rounded-lg border outline-none transition-colors flex items-center justify-between gap-2"
        style={{
          ...triggerStyle,
          background: 'rgba(0,0,0,0.35)',
          borderColor: 'rgba(255,255,255,0.15)',
          color: value ? 'var(--text)' : 'var(--text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span className="truncate">{value ? selectedLabel : placeholder}</span>
        <svg
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open &&
        dropdownRect &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed rounded-lg overflow-hidden"
            style={{
              left: dropdownRect.left,
              width: dropdownRect.width,
              top: dropdownPlacement === 'above' ? undefined : dropdownRect.top + 4,
              bottom: dropdownPlacement === 'above' ? window.innerHeight - dropdownRect.top + 4 : undefined,
              zIndex: 99999,
              background: 'rgba(24, 24, 24, 0.98)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            <div className="p-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full px-2.5 py-1.5 text-xs rounded-md outline-none"
                style={{
                  background: 'rgba(0,0,0,0.75)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text)',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                }}
              />
            </div>
            <div
              className="overflow-y-auto py-1"
              style={{ maxHeight: dropdownRect.listMaxHeight }}
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  {options.length === 0 ? emptyMessage : 'No matches'}
                </div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className="w-full text-left px-3 py-1.5 text-xs truncate block transition-colors"
                    style={{
                      color: opt.value === value ? 'var(--accent)' : 'var(--text)',
                      background: opt.value === value ? 'rgba(59,130,246,0.15)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (opt.value !== value) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (opt.value !== value) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }
                    }}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { useModalEscape } from '../hooks/useModalEscape';
import type { MixSourceOption } from '../hooks/useSessionInfo';

interface MixSourcesModalProps {
  open: boolean;
  available: MixSourceOption[];
  selected: Array<{ sourceType: number; name: string }>;
  onClose: () => void;
  onConfirm: (sources: Array<{ sourceType: number; name: string }>) => void;
  onRefresh?: () => void;
}

type TabId = 'all' | 'outputs' | 'buses';

/** Infer channel width (Mono, Stereo, Quad, 5.1, 7.1) from Pro Tools output/bus name. */
function channelWidthFromName(name: string): string {
  if (name === 'Renderer') return '—';
  if (/\.(L|R)$/i.test(name)) return 'Mono';
  if (/^\d+$/.test(name)) return 'Mono';
  if (/^\d+-\d+$/.test(name)) return 'Stereo';
  if (/^\d+-\d+-\d+-\d+$/.test(name)) return 'Quad';
  if (/^\d+-\d+-\d+-\d+-\d+-\d+$/.test(name)) return '5.1';
  if (/^\d+-\d+-\d+-\d+-\d+-\d+-\d+-\d+$/.test(name)) return '7.1';
  const parts = name.split('-').filter((p) => /^\d+$/.test(p));
  const n = parts.length;
  if (n === 1) return 'Mono';
  if (n === 2) return 'Stereo';
  if (n === 4) return 'Quad';
  if (n === 6) return '5.1';
  if (n === 8) return '7.1';
  return n > 0 ? `${n}ch` : '—';
}

export function MixSourcesModal({
  open,
  available,
  selected,
  onClose,
  onConfirm,
  onRefresh,
}: MixSourcesModalProps) {
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Array<{ sourceType: number; name: string }>>(selected);

  useEffect(() => {
    if (open) setPending(selected);
  }, [open, selected]);

  useModalEscape(onClose, open);

  const renderer = available.find((s) => s.sourceTypeName === 'EMSType_Renderer');
  const outputs = available.filter((s) => s.sourceTypeName === 'EMSType_Output');
  const buses = available.filter((s) => s.sourceTypeName === 'EMSType_Bus');

  const filtered = useMemo(() => {
    const list =
      tab === 'outputs'
        ? outputs
        : tab === 'buses'
        ? buses
        : [...(renderer ? [renderer] : []), ...outputs, ...buses];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [tab, search, renderer, outputs, buses]);

  const isSelected = (s: MixSourceOption) =>
    pending.some((p) => p.sourceType === s.sourceType && p.name === s.name);

  const toggle = (s: MixSourceOption) => {
    if (isSelected(s)) {
      setPending((prev) => prev.filter((p) => !(p.sourceType === s.sourceType && p.name === s.name)));
    } else {
      setPending((prev) => [...prev, { sourceType: s.sourceType, name: s.name }]);
    }
  };

  const selectAll = () => {
    const toAdd = filtered.filter((s) => !isSelected(s));
    setPending((prev) => [...prev, ...toAdd.map((s) => ({ sourceType: s.sourceType, name: s.name }))]);
  };

  const handleConfirm = () => {
    onConfirm(pending);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select Mix Sources"
        className="flex flex-col rounded-2xl shadow-2xl"
        style={{
          width: 'min(420px, 90vw)',
          height: '480px',
          background: 'var(--modal-surface)',
          border: '1px solid var(--glass-border-hi)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--divider)' }}
        >
          <svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Select Mix Sources
          </h3>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-4 pt-3 shrink-0">
          {(['all', 'outputs', 'buses'] as TabId[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
              style={
                tab === t
                  ? { background: 'rgba(255,255,255,0.12)', color: 'var(--text)' }
                  : { color: 'var(--text-muted)' }
              }
            >
              {t === 'all' ? 'All' : t === 'outputs' ? `Outputs (${outputs.length})` : `Buses (${buses.length})`}
            </button>
          ))}
        </div>

        {/* Search + actions */}
        <div className="flex items-center gap-2 px-4 py-2 shrink-0">
          <div className="flex-1 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid var(--divider-strong)',
                color: 'var(--text)',
              }}
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--text-muted)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            type="button"
            onClick={selectAll}
            className="text-[11px] font-medium px-2 py-1 rounded"
            style={{ color: 'var(--accent)' }}
          >
            Select All
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="p-1.5 rounded"
              style={{ color: 'var(--text-muted)' }}
              title="Refresh"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>

        {/* List — flex-1 fills remaining space; modal has fixed height so header stays put */}
        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              {available.length === 0 ? 'Connect to Pro Tools to scan outputs.' : 'No matches.'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((s) => (
                <label
                  key={`${s.sourceType}-${s.name}`}
                  className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: isSelected(s) ? 'var(--accent-soft)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected(s)) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected(s)) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected(s)}
                    onChange={() => toggle(s)}
                    className="accent-[var(--accent)]"
                    style={{ width: '14px', height: '14px' }}
                  />
                  <span className="text-xs flex-1 truncate" style={{ color: 'var(--text)' }}>
                    {s.name}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={{ color: 'var(--text-muted)', background: 'var(--surface-hover)' }}
                  >
                    {channelWidthFromName(s.name)}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={
                      s.sourceTypeName === 'EMSType_Renderer'
                        ? { color: '#c084fc', background: 'rgba(192,132,252,0.2)' }
                        : s.sourceTypeName === 'EMSType_Output'
                        ? { color: '#60a5fa', background: 'rgba(96,165,250,0.2)' }
                        : { color: '#34d399', background: 'rgba(52,211,153,0.2)' }
                    }
                  >
                    {s.sourceTypeName === 'EMSType_Renderer'
                      ? 'Renderer'
                      : s.sourceTypeName === 'EMSType_Output'
                      ? 'Output'
                      : 'Bus'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: '1px solid var(--divider)' }}
        >
          <button type="button" onClick={onClose} className="btn-glass text-xs px-3 py-1.5">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending.length === 0}
            className="btn-accent text-xs px-4 py-1.5 disabled:opacity-50"
          >
            Confirm ({pending.length})
          </button>
        </div>
      </div>
    </div>
  );
}

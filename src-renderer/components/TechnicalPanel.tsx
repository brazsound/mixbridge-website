import React, { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { MixSourcesModal } from './MixSourcesModal';
import { SearchableSelect } from './SearchableSelect';
import type { BounceSettings, RangeFormat } from '../hooks/useBounceSettings';
import { useDisplayRange } from '../hooks/useDisplayRange';
import { FILE_TYPES, SAMPLE_RATES, BIT_DEPTHS, RANGE_FORMATS } from '../hooks/useBounceSettings';
import type { SessionInfo, MixSourceOption } from '../hooks/useSessionInfo';
import type { TrackInfo } from '../hooks/useProToolsData';
import type { MemoryLocationInfo } from '../hooks/useProToolsData';
import type { Preset, PresetSlots } from '../hooks/usePresets';

interface TechnicalPanelProps {
  settings: BounceSettings;
  sessionInfo: SessionInfo;
  connected: boolean;
  mixSources: MixSourceOption[];
  tracks: TrackInfo[];
  folderTracks: TrackInfo[];
  onUpdateSettings: (partial: Partial<BounceSettings>) => void;
  // Presets
  presetSlots: PresetSlots;
  activePresetSlot: number | null;
  onLoadPreset: (index: number) => void;
  onSavePreset: (index: number, name: string) => void;
  onRenamePreset: (index: number, name: string) => void;
  onDeletePreset: (index: number) => void;
  onExportPresets: () => void;
  onImportPresets: () => void;
  // Range (bounce selection)
  memoryLocations: MemoryLocationInfo[];
  /** True when the selected session is open in Pro Tools (or no session selected). Enables capture/refresh. */
  isSessionOpen?: boolean;
  /** When true (tutorial set-range step), show capture UI even if session not open in Pro Tools. */
  showRangeCaptureForTutorial?: boolean;
  onRefreshMixSources?: () => void;
  onCaptureTimeline: () => Promise<{ error?: string }>;
  onCaptureFromMarkers: (
    inMarker: { name: string; start_time?: string },
    outMarker: { name: string; start_time?: string }
  ) => { error?: string };
  onClearRange: () => void;
}

export interface TechnicalPanelRef {
  scrollToRange: () => void;
  scrollToTechnical: () => void;
}

const FILE_FORMATS = [
  { label: 'Interleaved', value: true },
  { label: 'Non-Interleaved', value: false },
] as const;

// ── Reusable row: left label + right control ──────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3" style={{ minHeight: '28px' }}>
      <span
        className="text-xs shrink-0"
        style={{ width: '120px', color: 'var(--text-muted)', textAlign: 'right' }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="flex items-center gap-2 pt-1 pb-0.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
      >
        {title}
      </span>
    </div>
  );
}

// ── Styled select ──────────────────────────────────────────────────────────────
const selectCls =
  'w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none transition-colors cursor-pointer';
const selectStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.35)',
  borderColor: 'rgba(255,255,255,0.12)',
  color: 'var(--text)',
};

// ── Radio option ──────────────────────────────────────────────────────────────
function RadioRow({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-h-[24px]">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="shrink-0 accent-[var(--accent)]"
        style={{ width: '13px', height: '13px' }}
      />
      <span className="text-xs shrink-0" style={{ color: checked ? 'var(--text)' : 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

// ── Location option: large clickable row for LOCATION section ──────────────────
function LocationOption({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onChange}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors"
        style={{
          background: checked ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${checked ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
          style={{
            border: `2px solid ${checked ? 'var(--accent)' : 'rgba(255,255,255,0.3)'}`,
            background: checked ? 'var(--accent)' : 'transparent',
          }}
        >
          {checked && <div className="w-1 h-1 rounded-full bg-white" />}
        </div>
        <span className="text-xs font-medium" style={{ color: checked ? 'var(--text)' : 'var(--text-muted)' }}>
          {label}
        </span>
      </button>
      {children}
    </div>
  );
}

// ── Checkbox row ──────────────────────────────────────────────────────────────
function CheckRow({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className="flex items-center gap-2 cursor-pointer"
      style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="shrink-0 accent-[var(--accent)]"
        style={{ width: '13px', height: '13px' }}
      />
      <span className="text-xs" style={{ color: 'var(--text)' }}>{label}</span>
    </label>
  );
}

// ── Preset slot context menu ───────────────────────────────────────────────────

interface PresetMenuProps {
  index: number;
  preset: Preset | null;
  isActive: boolean;
  currentSettings: BounceSettings;
  onLoad: () => void;
  onSave: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function PresetSlotButton({ index, preset, isActive, currentSettings, onLoad, onSave, onRename, onDelete }: PresetMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setRenaming(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      onSave(preset?.name ?? `Preset ${index + 1}`);
    } else if (preset) {
      onLoad();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(true);
    setRenaming(false);
  };

  const filled = !!preset;
  const btnStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    borderRadius: '7px',
    fontSize: '11px',
    fontWeight: 600,
    border: isActive
      ? '1px solid var(--accent)'
      : filled
      ? '1px solid rgba(255,255,255,0.18)'
      : '1px solid rgba(255,255,255,0.08)',
    background: isActive
      ? 'var(--accent)'
      : filled
      ? 'rgba(255,255,255,0.09)'
      : 'rgba(255,255,255,0.04)',
    color: isActive ? '#fff' : filled ? 'var(--text)' : 'var(--text-muted)',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.12s',
  };

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        type="button"
        style={btnStyle}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={preset ? `${preset.name} — click to recall, Shift+click to save` : `Empty — Shift+click to save current settings`}
      >
        {index + 1}
      </button>

      {menuOpen && (
        <div
          className="absolute z-50 py-1 rounded-xl shadow-lg"
          style={{
            top: '28px',
            left: '0',
            minWidth: '160px',
            background: 'rgba(28,28,32,0.97)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {renaming ? (
            <div className="px-2 py-1.5">
              <input
                ref={inputRef}
                className="w-full px-2 py-1 text-xs rounded-lg outline-none"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text)',
                }}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameValue.trim()) {
                    onRename(renameValue.trim());
                    setMenuOpen(false);
                    setRenaming(false);
                  } else if (e.key === 'Escape') {
                    setMenuOpen(false);
                    setRenaming(false);
                  }
                }}
                placeholder="Preset name…"
              />
            </div>
          ) : (
            <>
              {preset && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                  style={{ color: 'var(--text)', background: 'transparent' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  onClick={() => { onLoad(); setMenuOpen(false); }}
                >
                  Load "{preset.name}"
                </button>
              )}
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                style={{ color: 'var(--text)', background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                onClick={() => {
                  const defaultName = preset?.name ?? `Preset ${index + 1}`;
                  onSave(defaultName);
                  setMenuOpen(false);
                }}
              >
                {preset ? 'Overwrite with current' : 'Save current settings here'}
              </button>
              {preset && (
                <>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                    style={{ color: 'var(--text)', background: 'transparent' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    onClick={() => { setRenameValue(preset.name); setRenaming(true); }}
                  >
                    Rename…
                  </button>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                    style={{ color: '#ff6b6b', background: 'transparent' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,69,58,0.12)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    onClick={() => { onDelete(); setMenuOpen(false); }}
                  >
                    Delete
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type CaptureMode = 'timeline' | 'markers';

export const TechnicalPanel = forwardRef<TechnicalPanelRef, TechnicalPanelProps>(function TechnicalPanel({
  settings,
  sessionInfo,
  connected,
  mixSources,
  tracks,
  folderTracks,
  onUpdateSettings,
  presetSlots,
  activePresetSlot,
  onLoadPreset,
  onSavePreset,
  onRenamePreset,
  onDeletePreset,
  onExportPresets,
  onImportPresets,
  memoryLocations,
  isSessionOpen = true,
  showRangeCaptureForTutorial = false,
  onRefreshMixSources,
  onCaptureTimeline,
  onCaptureFromMarkers,
  onClearRange,
}, ref) {
  const rangeSectionRef = useRef<HTMLDivElement>(null);
  const mixSourcesSectionRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollToRange: () => rangeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    scrollToTechnical: () => mixSourcesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  }), []);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('timeline');
  const [inMarkerIdx, setInMarkerIdx] = useState(-1);
  const [outMarkerIdx, setOutMarkerIdx] = useState(-1);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [mixSourcesModalOpen, setMixSourcesModalOpen] = useState(false);
  const { sampleRate: sessionSR, sampleRateLabel: sessionSRLabel, bitDepthLabel: sessionBDLabel } = sessionInfo;
  const sampleRateMismatch =
    settings.sampleRate !== 0 && sessionSR !== 0 && settings.sampleRate !== sessionSR;

  const trackSelectOptions = useMemo(
    () => tracks.map((t) => ({ value: t.name, label: t.name })),
    [tracks]
  );
  const folderSelectOptions = useMemo(
    () => folderTracks.map((t) => ({ value: t.name, label: t.name })),
    [folderTracks]
  );

  const sampleRateOptions = SAMPLE_RATES.map((r) => ({
    ...r,
    display: r.value === 0
      ? (sessionSRLabel ? `Session default (${sessionSRLabel})` : 'Session default')
      : r.label,
  }));

  const bitDepthOptions = BIT_DEPTHS.map((d) => ({
    ...d,
    display: d.value === 0
      ? (sessionBDLabel ? `Session default (${sessionBDLabel})` : 'Session default')
      : d.label,
  }));

  const importDisabled = sampleRateMismatch;
  const showImportDest = settings.importAfterBounce && !importDisabled;

  const handleTimeline = async () => {
    setRangeError(null);
    setCapturing(true);
    const result = await onCaptureTimeline();
    if (result.error) setRangeError(result.error);
    setCapturing(false);
  };

  const handleUseMarkers = () => {
    if (inMarkerIdx < 0 || outMarkerIdx < 0) {
      setRangeError('Select both an In marker and an Out marker.');
      return;
    }
    setRangeError(null);
    const result = onCaptureFromMarkers(memoryLocations[inMarkerIdx], memoryLocations[outMarkerIdx]);
    if (result.error) setRangeError(result.error);
  };

  const { capturedRange } = settings;
  const displayRange = useDisplayRange(capturedRange, settings.rangeFormat, connected);

  return (
    <section className="flex flex-col gap-0" style={{ fontSize: '13px' }}>
      {/* ── Presets bar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          Presets
        </span>

        <div className="flex gap-1.5 ml-1">
          {([0, 1, 2, 3, 4] as const).map((i) => (
            <PresetSlotButton
              key={i}
              index={i}
              preset={presetSlots[i]}
              isActive={activePresetSlot === i}
              currentSettings={settings}
              onLoad={() => onLoadPreset(i)}
              onSave={(name) => onSavePreset(i, name)}
              onRename={(name) => onRenamePreset(i, name)}
              onDelete={() => onDeletePreset(i)}
            />
          ))}
        </div>

        {/* Active preset name */}
        <span
          className="text-xs flex-1 truncate ml-1"
          style={{ color: activePresetSlot !== null && presetSlots[activePresetSlot] ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: 'italic' }}
        >
          {activePresetSlot !== null && presetSlots[activePresetSlot]
            ? presetSlots[activePresetSlot]!.name
            : '‹unsaved›'}
        </span>

        {/* Export / Import */}
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={onExportPresets}
            title="Export all presets to a file"
            className="flex items-center justify-center rounded-lg transition-all"
            style={{ width: '22px', height: '22px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1v7M3 5l3 3 3-3M2 10h8" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onImportPresets}
            title="Import presets from a file"
            className="flex items-center justify-center rounded-lg transition-all"
            style={{ width: '22px', height: '22px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8V1M3 4l3-3 3 3M2 10h8" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Range ───────────────────────────────────────────────────────── */}
      <div ref={rangeSectionRef} data-tutorial="range" className="glass-inset px-4 pt-3 pb-4 mb-3 space-y-4">
        <SectionHeader title="Range" />

        <div>
          <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            Capture
          </p>
          {connected && (isSessionOpen || showRangeCaptureForTutorial) ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                {(['timeline', 'markers'] as CaptureMode[]).map((m) => (
                  <div key={m} className="flex-1 min-w-0">
                    <LocationOption
                      checked={captureMode === m}
                      onChange={() => { setCaptureMode(m); setRangeError(null); }}
                      label={m === 'timeline' ? 'Timeline' : 'Markers'}
                    />
                  </div>
                ))}
              </div>
              {captureMode === 'timeline' ? (
                <button
                  type="button"
                  onClick={handleTimeline}
                  disabled={capturing || showRangeCaptureForTutorial}
                  title={showRangeCaptureForTutorial ? 'Connect to Pro Tools to capture' : undefined}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer"
                  style={{
                    background: showRangeCaptureForTutorial ? 'rgba(59,130,246,0.4)' : 'var(--accent)',
                    color: '#fff',
                    border: '1px solid rgba(59,130,246,0.5)',
                    opacity: showRangeCaptureForTutorial ? 0.9 : 1,
                    cursor: showRangeCaptureForTutorial ? 'default' : undefined,
                  }}
                >
                  {capturing ? 'Capturing…' : capturedRange?.source === 'timeline' ? 'Re-capture' : 'Get Timeline'}
                </button>
              ) : memoryLocations.length === 0 ? (
                <p className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  No markers
                </p>
              ) : (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>IN</p>
                    <select
                      value={inMarkerIdx}
                      onChange={(e) => setInMarkerIdx(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none cursor-pointer"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
                    >
                      <option value={-1}>Select…</option>
                      {memoryLocations.map((m, i) => (
                        <option key={i} value={i}>{m.number}. {m.name || 'Unnamed'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>OUT</p>
                    <select
                      value={outMarkerIdx}
                      onChange={(e) => setOutMarkerIdx(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none cursor-pointer"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
                    >
                      <option value={-1}>Select…</option>
                      {memoryLocations.map((m, i) => (
                        <option key={i} value={i}>{m.number}. {m.name || 'Unnamed'}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseMarkers}
                    disabled={inMarkerIdx < 0 || outMarkerIdx < 0 || showRangeCaptureForTutorial}
                    title={showRangeCaptureForTutorial ? 'Connect to Pro Tools to capture' : undefined}
                    className="px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer shrink-0"
                    style={{
                      background: inMarkerIdx >= 0 && outMarkerIdx >= 0 ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      color: inMarkerIdx >= 0 && outMarkerIdx >= 0 ? '#fff' : 'var(--text-muted)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      opacity: inMarkerIdx < 0 || outMarkerIdx < 0 ? 0.6 : 1,
                    }}
                  >
                    Set
                  </button>
                </div>
              )}
            </div>
          ) : connected && !isSessionOpen ? (
            <p className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Open this session in Pro Tools to capture range
            </p>
          ) : (
            <p className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Connect to capture
            </p>
          )}
        </div>

        {rangeError && (
          <div
            className="px-2.5 py-1.5 text-[11px] rounded-lg leading-snug"
            style={{ color: '#ffd580', background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.2)' }}
          >
            {rangeError}
          </div>
        )}

        {capturedRange && (
          <div
            className="flex items-center gap-2 flex-wrap px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Start</span>
              <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>
                {(displayRange ?? capturedRange).inLocation}
              </span>
            </div>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>→</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Stop</span>
              <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>
                {(displayRange ?? capturedRange).outLocation}
              </span>
            </div>
            <button
              type="button"
              onClick={onClearRange}
              className="text-[11px] ml-1 font-medium"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              Clear
            </button>
          </div>
        )}

        <div>
          <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            Format
          </p>
          <div className="flex gap-2">
            {RANGE_FORMATS.map((f) => (
              <div key={f.value} className="flex-1 min-w-0">
                <LocationOption
                  checked={settings.rangeFormat === f.value}
                  onChange={() => onUpdateSettings({ rangeFormat: f.value as RangeFormat })}
                  label={f.short}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mix Sources ─────────────────────────────────────────────────── */}
      <div ref={mixSourcesSectionRef} data-tutorial="routing" className="glass-inset px-4 pt-3 pb-4 mb-3 space-y-4">
        <SectionHeader title="Mix Sources" />

        <button
          type="button"
          onClick={() => setMixSourcesModalOpen(true)}
          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer hover:bg-white/10"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: settings.mixSources.length > 0 ? 'var(--text)' : 'var(--text-muted)',
          }}
        >
          <span className="flex-1 truncate">
            {settings.mixSources.length === 0
              ? connected && mixSources.length === 0
                ? 'No outputs found'
                : 'Select outputs…'
              : settings.mixSources.length <= 3
              ? `${settings.mixSources.length} selected: ${settings.mixSources.map((s) => s.name).join(', ')}`
              : `${settings.mixSources.length} outputs selected`}
          </span>
          <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {!connected && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Connect to Pro Tools to scan session outputs.
          </p>
        )}
        {connected && !isSessionOpen && mixSources.length === 0 && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Open this session in Pro Tools to scan outputs.
          </p>
        )}
      </div>

      <MixSourcesModal
        open={mixSourcesModalOpen}
        available={mixSources}
        selected={settings.mixSources}
        onClose={() => setMixSourcesModalOpen(false)}
        onConfirm={(sources) => onUpdateSettings({ mixSources: sources })}
        onRefresh={isSessionOpen ? onRefreshMixSources : undefined}
      />

      {/* ── Audio ───────────────────────────────────────────────────────── */}
      <div className="glass-inset px-4 pt-3 pb-4 mb-3 space-y-4">
        <SectionHeader title="Audio" />

        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Export Type
            </p>
            <select
              value={settings.fileType}
              onChange={(e) => {
                const v = Number(e.target.value);
                onUpdateSettings(v === 3 ? { fileType: v, addMP3: false } : { fileType: v });
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
            >
              {FILE_TYPES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Compression Type
              </p>
              <p className="text-xs px-2.5 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                PCM (Uncompressed)
              </p>
            </div>
            <label
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                opacity: settings.fileType === 3 ? 0.5 : 1,
                cursor: settings.fileType === 3 ? 'not-allowed' : 'pointer',
                pointerEvents: settings.fileType === 3 ? 'none' : 'auto',
              }}
            >
              <input
                type="checkbox"
                checked={settings.fileType === 3 ? false : settings.addMP3}
                onChange={(e) => onUpdateSettings({ addMP3: e.target.checked })}
                disabled={settings.fileType === 3}
                className="shrink-0 accent-[var(--accent)]"
                style={{ width: '16px', height: '16px' }}
              />
              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                Add MP3
              </span>
            </label>
          </div>

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              File Format
            </p>
            <select
              value={settings.interleaved ? 'true' : 'false'}
              onChange={(e) => onUpdateSettings({ interleaved: e.target.value === 'true' })}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
            >
              {FILE_FORMATS.map((f) => (
                <option key={String(f.value)} value={String(f.value)}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {settings.bitDepth === 0 && sessionBDLabel ? `Bit Depth (${sessionBDLabel})` : 'Bit Depth'}
            </p>
            <select
              value={settings.bitDepth}
              onChange={(e) => onUpdateSettings({ bitDepth: Number(e.target.value) })}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
            >
              {bitDepthOptions.map((d) => (
                <option key={d.value} value={d.value}>{d.display}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {settings.sampleRate === 0 && sessionSRLabel ? `Sample Rate (${sessionSRLabel})` : 'Sample Rate'}
            </p>
            <select
              value={settings.sampleRate}
              onChange={(e) => onUpdateSettings({ sampleRate: Number(e.target.value) })}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
            >
              {sampleRateOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.display}</option>
              ))}
            </select>
          </div>

          {sampleRateMismatch && (
            <div
              className="px-2.5 py-1.5 text-[11px] rounded-lg leading-snug"
              style={{ color: '#ffd580', background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.2)' }}
            >
              Mismatch with session ({sessionSRLabel}). Import After Bounce disabled.
            </div>
          )}

          <label
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <input
              type="checkbox"
              checked={settings.padToFrameBoundary}
              onChange={(e) => onUpdateSettings({ padToFrameBoundary: e.target.checked })}
              className="shrink-0 accent-[var(--accent)]"
              style={{ width: '16px', height: '16px' }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
              Pad To Frame Boundary
            </span>
          </label>

          <label
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <input
              type="checkbox"
              checked={settings.offlineBounce}
              onChange={(e) => onUpdateSettings({ offlineBounce: e.target.checked })}
              className="shrink-0 accent-[var(--accent)]"
              style={{ width: '16px', height: '16px' }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
              Offline
            </span>
          </label>
        </div>
      </div>

      {/* ── Location ────────────────────────────────────────────────────── */}
      <div className="glass-inset px-4 pt-3 pb-4 mb-3 space-y-4">
        <SectionHeader title="Location" />

        {/* Import After Bounce */}
        <label
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            opacity: importDisabled ? 0.5 : 1,
            pointerEvents: importDisabled ? 'none' : 'auto',
          }}
        >
          <input
            type="checkbox"
            checked={settings.importAfterBounce && !importDisabled}
            disabled={importDisabled}
            onChange={(e) => onUpdateSettings({ importAfterBounce: e.target.checked })}
            className="shrink-0 accent-[var(--accent)]"
            style={{ width: '16px', height: '16px' }}
          />
          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
            Import After Bounce
          </span>
        </label>

        {/* File Destination on disk */}
        <div>
          <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            File Destination
          </p>
          <div className="space-y-2">
            <LocationOption
              checked={settings.destination === 'session'}
              onChange={() => onUpdateSettings({ destination: 'session' })}
              label="Session folder (Bounced Files/)"
            />
            <LocationOption
              checked={settings.destination === 'custom'}
              onChange={() => onUpdateSettings({ destination: 'custom' })}
              label="Custom directory"
            >
              {settings.destination === 'custom' && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await window.app?.pickFolder(settings.customPath || undefined);
                    if (!res.canceled && res.folderPath) {
                      onUpdateSettings({ customPath: res.folderPath });
                    }
                  }}
                  className="w-full text-left pl-6 pr-3 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer hover:bg-white/10"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: settings.customPath ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  <svg className="w-3.5 h-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="truncate font-mono flex-1">
                    {settings.customPath || 'Choose a folder…'}
                  </span>
                  <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </LocationOption>
          </div>
        </div>

        {/* Import destination inside the session */}
        {showImportDest && (
          <div>
            <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Import To
            </p>
            <div className="space-y-2">
              <LocationOption
                checked={settings.importDestType === 'clip_list'}
                onChange={() => onUpdateSettings({ importDestType: 'clip_list' })}
                label="Clip List"
              />
              <LocationOption
                checked={settings.importDestType === 'below_track'}
                onChange={() => onUpdateSettings({ importDestType: 'below_track', importDestCreateNew: false })}
                label="Below track"
              >
                {settings.importDestType === 'below_track' && (
                  <div className="pl-6 pt-1 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.importDestCreateNew}
                        onChange={(e) => onUpdateSettings({ importDestCreateNew: e.target.checked, importDestTrackName: e.target.checked ? settings.importDestTrackName : '' })}
                        className="accent-[var(--accent)]"
                        style={{ width: '14px', height: '14px' }}
                      />
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Create new track</span>
                    </label>
                    {settings.importDestCreateNew ? (
                      <input
                        type="text"
                        value={settings.importDestTrackName}
                        onChange={(e) => onUpdateSettings({ importDestTrackName: e.target.value })}
                        placeholder="New track name…"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none"
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
                      />
                    ) : (
                      <SearchableSelect
                        value={settings.importDestTrackName}
                        onChange={(v) => onUpdateSettings({ importDestTrackName: v })}
                        options={trackSelectOptions}
                        placeholder="Select track…"
                        emptyMessage="No tracks in session"
                        compact
                      />
                    )}
                  </div>
                )}
              </LocationOption>
              <LocationOption
                checked={settings.importDestType === 'into_folder'}
                onChange={() => onUpdateSettings({ importDestType: 'into_folder', importDestCreateNew: false })}
                label="Into folder"
              >
                {settings.importDestType === 'into_folder' && (
                  <div className="pl-6 pt-1 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.importDestCreateNew}
                        onChange={(e) => onUpdateSettings({ importDestCreateNew: e.target.checked, importDestFolderName: e.target.checked ? settings.importDestFolderName : '' })}
                        className="accent-[var(--accent)]"
                        style={{ width: '14px', height: '14px' }}
                      />
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Create new folder</span>
                    </label>
                    {settings.importDestCreateNew ? (
                      <input
                        type="text"
                        value={settings.importDestFolderName}
                        onChange={(e) => onUpdateSettings({ importDestFolderName: e.target.value })}
                        placeholder="New folder name…"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none"
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
                      />
                    ) : (
                      <SearchableSelect
                        value={settings.importDestFolderName}
                        onChange={(v) => onUpdateSettings({ importDestFolderName: v })}
                        options={folderSelectOptions}
                        placeholder="Select folder…"
                        emptyMessage="No folders in session"
                        compact
                      />
                    )}
                  </div>
                )}
              </LocationOption>
            </div>

            {/* Placement — only when a track/folder is chosen */}
            {(settings.importDestType === 'below_track' || settings.importDestType === 'into_folder') && (
              <div className="mt-4">
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  Place At
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ importPlacement: 'current_selection' })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: settings.importPlacement === 'current_selection'
                        ? 'rgba(59,130,246,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${settings.importPlacement === 'current_selection' ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      color: settings.importPlacement === 'current_selection' ? 'var(--text)' : 'var(--text-muted)',
                    }}
                  >
                    Bounce selection start
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ importPlacement: 'top_of_session' })}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: settings.importPlacement === 'top_of_session'
                        ? 'rgba(59,130,246,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${settings.importPlacement === 'top_of_session' ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      color: settings.importPlacement === 'top_of_session' ? 'var(--text)' : 'var(--text-muted)',
                    }}
                  >
                    Top of session
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
});

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
        className="text-xs shrink-0 text-right"
        style={{ minWidth: '80px', maxWidth: '120px', color: 'var(--text-muted)' }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Collapsible section ────────────────────────────────────────────────────────
function CollapsibleSection({
  title,
  summary,
  defaultOpen = true,
  children,
  sectionRef,
  dataTutorial,
}: {
  title: string;
  /** Shown next to title when collapsed, e.g. "48k 32bit WAV" */
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  dataTutorial?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      ref={sectionRef}
      className="glass-inset mb-2 overflow-hidden"
      {...(dataTutorial ? { 'data-tutorial': dataTutorial } : {})}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 text-left cursor-pointer transition-colors hover:bg-[var(--surface-pressed)]"
        style={{ borderBottom: open ? '1px solid var(--divider)' : 'none' }}
      >
        <span className="panel-header-title min-w-0 truncate">
          {summary && !open ? `${title} — ${summary}` : title}
        </span>
        <svg
          className="w-3 h-3 shrink-0 transition-transform"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)',
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pt-3 pb-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// selectCls / selectStyle removed — use className="select-input" instead

// ── Range format: pill toggle group ──────────────────────────────────────────
function RangeFormatTabs({
  value,
  onChange,
}: {
  value: RangeFormat;
  onChange: (next: RangeFormat) => void;
}) {
  return (
    <div
      className="flex flex-1 min-w-0 rounded-lg p-[3px] gap-[3px]"
      role="tablist"
      aria-label="Range display format"
      style={{ background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}
    >
      {RANGE_FORMATS.map((f) => {
        const selected = value === f.value;
        return (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(f.value)}
            className="flex-1 min-w-0 text-center text-[11px] font-medium transition-all duration-150 focus:outline-none rounded-md px-2 py-[3px]"
            style={
              selected
                ? {
                    color: 'var(--text)',
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }
                : {
                    color: 'var(--text-muted)',
                    background: 'transparent',
                    border: '1px solid transparent',
                  }
            }
          >
            {f.short}
          </button>
        );
      })}
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
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:brightness-110"
        style={{
          background: checked ? 'var(--accent-soft)' : 'var(--surface-pressed)',
          border: `1px solid ${checked ? 'var(--accent-border)' : 'var(--divider)'}`,
        }}
      >
        <div
          className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center"
          style={{
            border: `1.5px solid ${checked ? 'var(--accent)' : 'rgba(255,255,255,0.3)'}`,
            background: checked ? 'var(--accent)' : 'transparent',
          }}
        >
          {checked && <div className="w-1 h-1 rounded-full bg-white" />}
        </div>
        <span className="text-xs" style={{ color: checked ? 'var(--text)' : 'var(--text-secondary)' }}>
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
      className="flex items-center gap-2 cursor-pointer px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setRenaming(false);
        setConfirmDelete(false);
        setConfirmOverwrite(false);
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={preset ? `${preset.name} — click to recall, Shift+click to save` : `Empty — Shift+click to save current settings`}
        className="flex items-center justify-center text-[11px] font-semibold transition-all shrink-0 rounded-lg"
        style={{
          width: '24px',
          height: '24px',
          border: isActive
            ? '1px solid var(--accent)'
            : filled
            ? '1px solid var(--divider-strong)'
            : '1px solid var(--divider)',
          background: isActive
            ? 'var(--accent)'
            : filled
            ? 'var(--surface-hover)'
            : 'var(--surface-pressed)',
          color: isActive ? '#fff' : filled ? 'var(--text)' : 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        {index + 1}
      </button>

      {menuOpen && (
        <div className="menu-panel absolute z-50 py-1 min-w-[160px] rounded-xl" style={{ top: '28px', left: '0' }}>
          {renaming ? (
            <div className="px-2 py-1.5">
              <input
                ref={inputRef}
                className="w-full px-2 py-1 text-xs rounded-lg outline-none"
                style={{
                  background: 'var(--surface-hover-strong)',
                  border: '1px solid var(--divider-strong)',
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
          ) : confirmDelete ? (
            <div className="px-3 py-2 space-y-1.5">
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Delete &quot;{preset?.name}&quot;?</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="flex-1 py-1 text-[11px] rounded-lg transition-colors"
                  style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--divider)' }}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="flex-1 py-1 text-[11px] rounded-lg font-medium transition-colors"
                  style={{ background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid rgba(255,69,58,0.3)' }}
                  onClick={() => { onDelete(); setMenuOpen(false); setConfirmDelete(false); }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : confirmOverwrite ? (
            <div className="px-3 py-2 space-y-1.5">
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Overwrite &quot;{preset?.name}&quot; with current settings?</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="flex-1 py-1 text-[11px] rounded-lg transition-colors"
                  style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--divider)' }}
                  onClick={() => setConfirmOverwrite(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 py-1 text-[11px] rounded-lg font-medium transition-colors"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                  onClick={() => { onSave(preset!.name); setMenuOpen(false); setConfirmOverwrite(false); }}
                >
                  Overwrite
                </button>
              </div>
            </div>
          ) : (
            <>
              {preset && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text)' }}
                  onClick={() => { onLoad(); setMenuOpen(false); }}
                >
                  Load &quot;{preset.name}&quot;
                </button>
              )}
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text)' }}
                onClick={() => {
                  if (preset) {
                    setConfirmOverwrite(true);
                  } else {
                    onSave(`Preset ${index + 1}`);
                    setMenuOpen(false);
                  }
                }}
              >
                {preset ? 'Overwrite with current' : 'Save current settings here'}
              </button>
              {preset && (
                <>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--surface-hover)]"
                    style={{ color: 'var(--text)' }}
                    onClick={() => { setRenameValue(preset.name); setRenaming(true); }}
                  >
                    Rename…
                  </button>
                  <div style={{ height: '1px', background: 'var(--divider)', margin: '2px 0' }} />
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--danger-soft)]"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => setConfirmDelete(true)}
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

  // Short summaries for collapsed sections
  const rangeSummary = capturedRange
    ? (() => {
        const fmt = RANGE_FORMATS.find((f) => f.value === settings.rangeFormat)?.short ?? '';
        const rangePart =
          capturedRange.source === 'marker' && capturedRange.markerName
            ? capturedRange.markerName
            : (displayRange ?? capturedRange).inLocation + ' → ' + (displayRange ?? capturedRange).outLocation;
        return fmt ? `${rangePart} · ${fmt}` : rangePart;
      })()
    : 'Not captured';
  const mixSourcesSummary =
    settings.mixSources.length > 0
      ? `${settings.mixSources.length} output${settings.mixSources.length !== 1 ? 's' : ''}`
      : 'Select outputs…';
  const srShort =
    settings.sampleRate === 0
      ? sessionSRLabel
        ? sessionSRLabel.replace(/\s*kHz$/i, 'k').replace(/\s*Hz$/i, '')
        : '—'
      : settings.sampleRate >= 1000
        ? `${settings.sampleRate / 1000}k`
        : `${settings.sampleRate}Hz`;
  const bdShort =
    settings.bitDepth === 0
      ? sessionBDLabel
        ? sessionBDLabel.replace(/-bit.*/i, 'bit')
        : '—'
      : `${settings.bitDepth}bit`;
  const fileTypeShort = FILE_TYPES.find((f) => f.value === settings.fileType)?.label.split(' (')[0] ?? '—';
  const onlineOffline = settings.offlineBounce ? 'Offline' : 'Online';
  const audioSummary = `${srShort} ${bdShort} ${fileTypeShort} · ${onlineOffline}`;
  const destPart =
    settings.destination === 'session'
      ? 'Session folder'
      : settings.customPath
        ? `Custom · ${settings.customPath.split('/').pop() ?? '…'}`
        : 'Custom · Choose…';
  const importDestName =
    settings.importDestType === 'clip_list'
      ? 'Clip List'
      : settings.importDestType === 'below_track'
        ? settings.importDestCreateNew && settings.importDestTrackName
          ? settings.importDestTrackName
          : settings.importDestTrackName || 'track…'
        : settings.importDestCreateNew && settings.importDestFolderName
          ? settings.importDestFolderName
          : settings.importDestFolderName || 'folder…';
  const locationSummary =
    settings.importAfterBounce && !importDisabled
      ? `${destPart} — into ${importDestName}`
      : destPart;

  return (
    <section className="flex flex-col gap-0" style={{ fontSize: '13px' }}>
      {/* ── Presets bar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl"
        style={{ background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}
      >
        <span className="panel-header-title shrink-0">Presets</span>

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
            className="btn-icon rounded-lg"
            style={{ width: '22px', height: '22px', color: 'var(--text-muted)', border: '1px solid var(--divider)' }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1v7M3 5l3 3 3-3M2 10h8" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onImportPresets}
            title="Import presets from a file"
            className="btn-icon rounded-lg"
            style={{ width: '22px', height: '22px', color: 'var(--text-muted)', border: '1px solid var(--divider)' }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8V1M3 4l3-3 3 3M2 10h8" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Range ───────────────────────────────────────────────────────── */}
      <CollapsibleSection title="Range" summary={rangeSummary} sectionRef={rangeSectionRef} dataTutorial="range">
        <div data-tutorial="range" className="space-y-3">
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
                  className="w-full btn-panel-accent justify-center"
                  style={{ opacity: showRangeCaptureForTutorial ? 0.85 : 1 }}
                >
                  {capturing ? 'Capturing…' : capturedRange?.source === 'timeline' ? 'Re-capture Timeline' : 'Get Timeline'}
                </button>
              ) : memoryLocations.length === 0 ? (
                <p className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}>
                  No markers
                </p>
              ) : (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>IN</p>
                    <select
                      value={inMarkerIdx}
                      onChange={(e) => setInMarkerIdx(Number(e.target.value))}
                      className="select-input"
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
                      className="select-input"
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
                    className={`shrink-0 ${inMarkerIdx >= 0 && outMarkerIdx >= 0 ? 'btn-panel-accent' : 'btn-panel'}`}
                  >
                    Set
                  </button>
                </div>
              )}
            </div>
          ) : connected && !isSessionOpen ? (
            <p className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}>
              Open this session in Pro Tools to capture range
            </p>
          ) : (
            <p className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}>
              Connect to capture
            </p>
          )}
        </div>

        {rangeError && (
          <div
            className="px-2.5 py-1.5 text-[11px] rounded-lg leading-snug"
            style={{ color: 'var(--warning)', background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.25)' }}
          >
            {rangeError}
          </div>
        )}

        {capturedRange && (
          <div
            className="flex items-center gap-2 flex-wrap px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}
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
              className="text-[11px] ml-1 font-medium transition-colors hover:text-[var(--danger)]"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear
            </button>
          </div>
        )}

        <Row label="Format">
          <RangeFormatTabs
            value={settings.rangeFormat}
            onChange={(rangeFormat) => onUpdateSettings({ rangeFormat })}
          />
        </Row>
        </div>
      </CollapsibleSection>

      {/* ── Mix Sources ─────────────────────────────────────────────────── */}
      <CollapsibleSection title="Mix Sources" summary={mixSourcesSummary} sectionRef={mixSourcesSectionRef} dataTutorial="routing">
        <div data-tutorial="routing">
        <button
          type="button"
          onClick={() => setMixSourcesModalOpen(true)}
          className="w-full text-left btn-panel flex items-center gap-2"
          style={{ color: settings.mixSources.length > 0 ? 'var(--text)' : 'var(--text-muted)' }}
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
      </CollapsibleSection>

      <MixSourcesModal
        open={mixSourcesModalOpen}
        available={mixSources}
        selected={settings.mixSources}
        onClose={() => setMixSourcesModalOpen(false)}
        onConfirm={(sources) => onUpdateSettings({ mixSources: sources })}
        onRefresh={isSessionOpen ? onRefreshMixSources : undefined}
      />

      {/* ── Audio ───────────────────────────────────────────────────────── */}
      <CollapsibleSection title="Audio" summary={audioSummary}>
        <div className="space-y-2.5">
          <Row label="Export Type">
            <select
              value={settings.fileType}
              onChange={(e) => {
                const v = Number(e.target.value);
                onUpdateSettings(v === 3 ? { fileType: v, addMP3: false } : { fileType: v });
              }}
              className="select-input"
            >
              {FILE_TYPES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </Row>

          <Row label="Compression">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs px-2.5 py-1.5 rounded-lg truncate" style={{ color: 'var(--text-muted)', background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}>
                PCM (Uncompressed)
              </p>
              <label
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer hover:bg-[var(--surface-hover)]"
                style={{
                  background: 'var(--surface-pressed)',
                  border: '1px solid var(--divider)',
                  opacity: settings.fileType === 3 ? 0.5 : 1,
                  pointerEvents: settings.fileType === 3 ? 'none' : 'auto',
                }}
              >
                <input
                  type="checkbox"
                  checked={settings.fileType === 3 ? false : settings.addMP3}
                  onChange={(e) => onUpdateSettings({ addMP3: e.target.checked })}
                  disabled={settings.fileType === 3}
                  className="shrink-0 accent-[var(--accent)]"
                  style={{ width: '14px', height: '14px' }}
                />
                <span className="text-xs" style={{ color: 'var(--text)' }}>MP3</span>
              </label>
            </div>
          </Row>

          <Row label="File Format">
            <select
              value={settings.interleaved ? 'true' : 'false'}
              onChange={(e) => onUpdateSettings({ interleaved: e.target.value === 'true' })}
              className="select-input"
            >
              {FILE_FORMATS.map((f) => (
                <option key={String(f.value)} value={String(f.value)}>{f.label}</option>
              ))}
            </select>
          </Row>

          <Row label="Bit Depth">
            <select
              value={settings.bitDepth}
              onChange={(e) => onUpdateSettings({ bitDepth: Number(e.target.value) })}
              className="select-input"
            >
              {bitDepthOptions.map((d) => (
                <option key={d.value} value={d.value}>{d.display}</option>
              ))}
            </select>
          </Row>

          <Row label="Sample Rate">
            <select
              value={settings.sampleRate}
              onChange={(e) => onUpdateSettings({ sampleRate: Number(e.target.value) })}
              className="select-input"
            >
              {sampleRateOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.display}</option>
              ))}
            </select>
          </Row>

          {sampleRateMismatch && (
            <div
              className="px-2.5 py-1.5 text-[11px] rounded-lg leading-snug"
              style={{ color: 'var(--warning)', background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.25)' }}
            >
              Mismatch with session ({sessionSRLabel}). Import After Bounce disabled.
            </div>
          )}

          <CheckRow
            checked={settings.padToFrameBoundary}
            onChange={(v) => onUpdateSettings({ padToFrameBoundary: v })}
            label="Pad To Frame Boundary"
          />
          <CheckRow
            checked={settings.offlineBounce}
            onChange={(v) => onUpdateSettings({ offlineBounce: v })}
            label="Offline"
          />
        </div>
      </CollapsibleSection>

      {/* ── Location ────────────────────────────────────────────────────── */}
      <CollapsibleSection title="Location" summary={locationSummary}>
        <div className="space-y-2.5">
          {/* Import After Bounce */}
          <CheckRow
            checked={settings.importAfterBounce && !importDisabled}
            onChange={(v) => onUpdateSettings({ importAfterBounce: v })}
            label="Import After Bounce"
            disabled={importDisabled}
          />

          {/* File Destination on disk */}
          <div className="space-y-1.5">
            <p className="panel-header-title px-0.5">File Destination</p>
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
                  className="w-full text-left btn-panel flex items-center gap-2 mt-1"
                  style={{ paddingLeft: '16px', color: settings.customPath ? 'var(--text)' : 'var(--text-muted)' }}
                >
                  <svg className="w-3 h-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="truncate font-mono text-[11px] flex-1">
                    {settings.customPath || 'Choose a folder…'}
                  </span>
                  <svg className="w-3 h-3 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </LocationOption>
          </div>

          {/* Import destination inside the session */}
          {showImportDest && (
            <div className="space-y-1.5">
              <p className="panel-header-title px-0.5">Import To</p>
              <div className="space-y-1.5">
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
                    <div className="pl-5 pt-1.5 space-y-2">
                      <CheckRow
                        checked={settings.importDestCreateNew}
                        onChange={(v) => onUpdateSettings({ importDestCreateNew: v, importDestTrackName: v ? settings.importDestTrackName : '' })}
                        label="Create new track"
                      />
                      {settings.importDestCreateNew ? (
                        <input
                          type="text"
                          value={settings.importDestTrackName}
                          onChange={(e) => onUpdateSettings({ importDestTrackName: e.target.value })}
                          placeholder="New track name…"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none"
                          style={{ background: 'var(--surface-input)', border: '1px solid var(--divider-strong)', color: 'var(--text)' }}
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
                    <div className="pl-5 pt-1.5 space-y-2">
                      <CheckRow
                        checked={settings.importDestCreateNew}
                        onChange={(v) => onUpdateSettings({ importDestCreateNew: v, importDestFolderName: v ? settings.importDestFolderName : '' })}
                        label="Create new folder"
                      />
                      {settings.importDestCreateNew ? (
                        <input
                          type="text"
                          value={settings.importDestFolderName}
                          onChange={(e) => onUpdateSettings({ importDestFolderName: e.target.value })}
                          placeholder="New folder name…"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg outline-none"
                          style={{ background: 'var(--surface-input)', border: '1px solid var(--divider-strong)', color: 'var(--text)' }}
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

              {/* Place At — segmented control matching RangeFormatTabs style */}
              {(settings.importDestType === 'below_track' || settings.importDestType === 'into_folder') && (
                <Row label="Place At">
                  <div
                    className="flex flex-1 min-w-0 rounded-lg p-[3px] gap-[3px]"
                    style={{ background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}
                  >
                    {(['current_selection', 'top_of_session'] as const).map((opt) => {
                      const active = settings.importPlacement === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => onUpdateSettings({ importPlacement: opt })}
                          className="flex-1 min-w-0 rounded-md px-2 py-[3px] text-center text-[11px] font-medium transition-all focus:outline-none"
                          style={
                            active
                              ? {
                                  color: 'var(--text)',
                                  background: 'rgba(255,255,255,0.12)',
                                  border: '1px solid rgba(255,255,255,0.14)',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                }
                              : {
                                  color: 'var(--text-muted)',
                                  background: 'transparent',
                                  border: '1px solid transparent',
                                }
                          }
                        >
                          {opt === 'current_selection' ? 'Bounce selection' : 'Top of session'}
                        </button>
                      );
                    })}
                  </div>
                </Row>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </section>
  );
});

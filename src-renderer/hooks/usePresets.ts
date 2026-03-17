import { useState, useCallback, useEffect, useRef } from 'react';
import type { BounceSettings } from './useBounceSettings';

// Settings that make sense to snapshot into a preset.
// capturedRange is live session data; importDestTrackName / importDestFolderName
// are session-specific track names — all three are excluded.
export type PresetableSettings = Omit<
  BounceSettings,
  'capturedRange' | 'importDestTrackName' | 'importDestFolderName'
>;

export interface Preset {
  name: string;
  settings: PresetableSettings;
}

// 5 slots, matching Pro Tools' Bounce Mix preset convention.
export type PresetSlots = [
  Preset | null,
  Preset | null,
  Preset | null,
  Preset | null,
  Preset | null,
];

const EMPTY_SLOTS: PresetSlots = [null, null, null, null, null];

/** Migrate old preset format (mixSourceType/mixSourceName) to mixSources array. */
function migratePresetSettings(s: Record<string, unknown>): PresetableSettings {
  const migrated: Record<string, unknown> = { ...s };
  if (!Array.isArray(migrated.mixSources)) {
    const type = s.mixSourceType as number | undefined;
    const name = s.mixSourceName as string | undefined;
    if (type != null && type > 0 && name) {
      migrated.mixSources = [{ sourceType: type, name }];
    } else {
      migrated.mixSources = [];
    }
    delete migrated.mixSourceType;
    delete migrated.mixSourceName;
  }
  if (typeof migrated.addMP3 !== 'boolean') migrated.addMP3 = false;
  if (migrated.fileType === 3) migrated.addMP3 = false; // MP3 as primary and Add MP3 are mutually exclusive
  if (migrated.fileType === 6) migrated.fileType = 1; // MOV not supported for bounce; fallback to WAV
  if (typeof migrated.importDestCreateNew !== 'boolean') migrated.importDestCreateNew = false;
  return migrated as PresetableSettings;
}

export function extractPresetableSettings(s: BounceSettings): PresetableSettings {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    capturedRange, importDestTrackName, importDestFolderName,
    ...rest
  } = s;
  return rest;
}

export function usePresets(
  onApply: (s: PresetableSettings) => void,
  options?: { onLoadError?: (err: Error) => void }
) {
  const [slots, setSlots] = useState<PresetSlots>(EMPTY_SLOTS);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const onLoadErrorRef = useRef(options?.onLoadError);
  onLoadErrorRef.current = options?.onLoadError;

  // Load from disk on mount and apply the last active preset automatically.
  useEffect(() => {
    if (!window.ptslPresets) return;
    window.ptslPresets.load().then((result) => {
      const s = (result.slots ?? EMPTY_SLOTS) as PresetSlots;
      setSlots(s);
      const last = result.lastActiveSlot ?? null;
      if (last !== null && s[last]) {
        setActiveSlot(last);
        onApply(migratePresetSettings(s[last]!.settings as Record<string, unknown>));
      }
      setLoaded(true);
    }).catch((err) => {
      setLoaded(true);
      onLoadErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
    });
  // onApply is stable (useCallback in parent) so this only runs once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(async (newSlots: PresetSlots, newActive: number | null) => {
    if (!window.ptslPresets) return;
    await window.ptslPresets.save(newSlots, newActive);
  }, []);

  /** Load a saved preset into the app settings. */
  const loadSlot = useCallback((index: number) => {
    const preset = slots[index];
    if (!preset) return;
    onApply(migratePresetSettings(preset.settings as Record<string, unknown>));
    setActiveSlot(index);
    void persist(slots, index);
  }, [slots, onApply, persist]);

  /** Save current settings into a slot (creates or overwrites). */
  const saveToSlot = useCallback(async (index: number, name: string, current: PresetableSettings) => {
    const newSlots = [...slots] as PresetSlots;
    newSlots[index] = { name, settings: current };
    setSlots(newSlots);
    setActiveSlot(index);
    await persist(newSlots, index);
  }, [slots, persist]);

  /** Rename a slot without changing its settings. */
  const renameSlot = useCallback(async (index: number, name: string) => {
    const existing = slots[index];
    if (!existing) return;
    const newSlots = [...slots] as PresetSlots;
    newSlots[index] = { ...existing, name };
    setSlots(newSlots);
    await persist(newSlots, activeSlot);
  }, [slots, activeSlot, persist]);

  /** Delete a slot. */
  const deleteSlot = useCallback(async (index: number) => {
    const newSlots = [...slots] as PresetSlots;
    newSlots[index] = null;
    setSlots(newSlots);
    const newActive = activeSlot === index ? null : activeSlot;
    setActiveSlot(newActive);
    await persist(newSlots, newActive);
  }, [slots, activeSlot, persist]);

  /** Export all 5 slots to a JSON file (for sharing between machines). */
  const exportPresets = useCallback(async () => {
    if (!window.ptslPresets) return;
    await window.ptslPresets.export(slots);
  }, [slots]);

  /** Import slots from a JSON file, merging into current slots or replacing. */
  const importPresets = useCallback(async () => {
    if (!window.ptslPresets) return;
    const result = await window.ptslPresets.import();
    if (result.canceled || !result.slots) return;
    const raw = result.slots as PresetSlots;
    const imported = raw.map((p) =>
      p ? { ...p, settings: migratePresetSettings(p.settings as Record<string, unknown>) } : null
    ) as PresetSlots;
    setSlots(imported);
    setActiveSlot(null);
    await persist(imported, null);
  }, [persist]);

  return {
    slots,
    activeSlot,
    loaded,
    loadSlot,
    saveToSlot,
    renameSlot,
    deleteSlot,
    exportPresets,
    importPresets,
  };
}

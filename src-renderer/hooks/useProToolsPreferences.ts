import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'stem-bounce-protools-prefs';

export type SessionRenameMode = 'custom' | 'prefix' | 'suffix';

export interface ProToolsPreferences {
  ignoreMissingFiles: boolean;
  ignoreMissingPlugins: boolean;
  ignoreIOChange: boolean;
  /** Rename session after batch run completes (Save As with new name before close). */
  renameSessionAfterBatch: boolean;
  renameMode: SessionRenameMode;
  renameCustomName: string;
  renamePrefix: string;
  renameSuffix: string;
}

const DEFAULT: ProToolsPreferences = {
  ignoreMissingFiles: false,
  ignoreMissingPlugins: false,
  ignoreIOChange: false,
  renameSessionAfterBatch: false,
  renameMode: 'suffix',
  renameCustomName: '',
  renamePrefix: '',
  renameSuffix: '_Stems',
};

function load(): ProToolsPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProToolsPreferences>;
      return { ...DEFAULT, ...parsed };
    }
  } catch (_) {}
  return { ...DEFAULT };
}

function save(prefs: ProToolsPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

/** True when we should pass behavior_options to suppress dialogs during OpenSession. */
export function shouldSuppressDialogs(prefs: ProToolsPreferences): boolean {
  return prefs.ignoreMissingFiles || prefs.ignoreMissingPlugins || prefs.ignoreIOChange;
}

export function useProToolsPreferences() {
  const [prefs, setPrefsState] = useState<ProToolsPreferences>(load);

  useEffect(() => {
    save(prefs);
  }, [prefs]);

  const setPrefs = useCallback((next: Partial<ProToolsPreferences>) => {
    setPrefsState((prev) => ({ ...prev, ...next }));
  }, []);

  const setIgnoreMissingFiles = useCallback((v: boolean) => {
    setPrefsState((prev) => ({ ...prev, ignoreMissingFiles: v }));
  }, []);

  const setIgnoreMissingPlugins = useCallback((v: boolean) => {
    setPrefsState((prev) => ({ ...prev, ignoreMissingPlugins: v }));
  }, []);

  const setIgnoreIOChange = useCallback((v: boolean) => {
    setPrefsState((prev) => ({ ...prev, ignoreIOChange: v }));
  }, []);

  const setRenameSessionAfterBatch = useCallback((v: boolean) => {
    setPrefsState((prev) => ({ ...prev, renameSessionAfterBatch: v }));
  }, []);

  const setRenameSettings = useCallback((settings: {
    renameMode?: SessionRenameMode;
    renameCustomName?: string;
    renamePrefix?: string;
    renameSuffix?: string;
  }) => {
    setPrefsState((prev) => ({ ...prev, ...settings }));
  }, []);

  return {
    ...prefs,
    setPrefs,
    setIgnoreMissingFiles,
    setIgnoreMissingPlugins,
    setIgnoreIOChange,
    setRenameSessionAfterBatch,
    setRenameSettings,
    suppressDialogs: shouldSuppressDialogs(prefs),
  };
}

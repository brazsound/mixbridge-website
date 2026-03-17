import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'stem-shortcuts';

export type ShortcutAction =
  | 'mix'
  | 'batch'
  | 'solo'
  | 'mute'
  | 'refresh'
  | 'undo'
  | 'redo'
  | 'settings';

export interface Shortcuts {
  mix: string;
  batch: string;
  solo: string;
  mute: string;
  refresh: string;
  undo: string;
  redo: string;
  settings: string;
}

export const DEFAULT_SHORTCUTS: Shortcuts = {
  mix: 'meta+e',
  batch: 'meta+b',
  solo: 'meta+s',
  mute: 'meta+m',
  refresh: 'meta+r',
  undo: 'meta+z',
  redo: 'meta+shift+z',
  settings: 'meta+,',
};

function load(): Shortcuts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Shortcuts>;
      return { ...DEFAULT_SHORTCUTS, ...parsed };
    }
  } catch (_) {}
  return { ...DEFAULT_SHORTCUTS };
}

function save(shortcuts: Shortcuts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (_) {}
}

/** Parse "meta+shift+e" into { meta: true, shift: true, key: 'e' } */
function parseShortcut(raw: string): {
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
} {
  const parts = raw.toLowerCase().split('+').map((p) => p.trim());
  const key = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1);
  return {
    meta: mods.includes('meta') || mods.includes('cmd') || mods.includes('command'),
    ctrl: mods.includes('ctrl') || mods.includes('control'),
    shift: mods.includes('shift'),
    alt: mods.includes('alt') || mods.includes('option'),
    key,
  };
}

/** Check if a KeyboardEvent matches the given shortcut string */
export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  const keyMatch = e.key.toLowerCase() === parsed.key;
  const metaMatch = parsed.meta ? e.metaKey : !e.metaKey;
  const ctrlMatch = parsed.ctrl ? e.ctrlKey : !e.ctrlKey;
  const shiftMatch = parsed.shift === e.shiftKey;
  const altMatch = parsed.alt === e.altKey;
  return keyMatch && metaMatch && ctrlMatch && shiftMatch && altMatch;
}

/** Format shortcut for display: "⌘E" on Mac, "Ctrl+E" on Windows */
export function formatShortcutForDisplay(shortcut: string): string {
  const parsed = parseShortcut(shortcut);
  const parts: string[] = [];
  if (parsed.meta) parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  if (parsed.ctrl && !parsed.meta) parts.push('Ctrl');
  if (parsed.alt) parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
  if (parsed.shift) parts.push('⇧');
  const keyDisplay = parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key;
  parts.push(keyDisplay);
  return parts.join('');
}

/** Convert a KeyboardEvent to a shortcut string for storage */
export function eventToShortcutString(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push('meta');
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

export function useShortcuts() {
  const [shortcuts, setShortcutsState] = useState<Shortcuts>(load);

  useEffect(() => {
    save(shortcuts);
  }, [shortcuts]);

  const setShortcuts = useCallback((next: Shortcuts | ((prev: Shortcuts) => Shortcuts)) => {
    setShortcutsState((prev) => (typeof next === 'function' ? next(prev) : next));
  }, []);

  const setShortcut = useCallback((action: ShortcutAction, value: string) => {
    setShortcutsState((prev) => ({ ...prev, [action]: value }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setShortcutsState({ ...DEFAULT_SHORTCUTS });
  }, []);

  return {
    shortcuts,
    setShortcuts,
    setShortcut,
    resetToDefaults,
  };
}

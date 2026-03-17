import { useState, useCallback, useEffect, useRef } from 'react';
import type { Shortcuts, ShortcutAction } from '../hooks/useShortcuts';
import {
  formatShortcutForDisplay,
  eventToShortcutString,
  DEFAULT_SHORTCUTS,
} from '../hooks/useShortcuts';

interface ShortcutRowProps {
  label: string;
  shortcut: string;
  defaultShortcut: string;
  errorMessage: string | null;
  onSet: (value: string) => void;
  onResetOne: () => void;
  onErrorAnimationEnd?: () => void;
}

function ShortcutRow({ label, shortcut, defaultShortcut, errorMessage, onSet, onResetOne, onErrorAnimationEnd }: ShortcutRowProps) {
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);
  const previousValueRef = useRef<string>(shortcut);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      // Esc cancels and restores previous value
      if (e.key === 'Escape') {
        onSet(previousValueRef.current);
        setRecording(false);
        window.removeEventListener('keydown', handleKeyDown, true);
        return;
      }
      // Ignore modifier-only keys
      if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;
      const str = eventToShortcutString(e);
      onSet(str);
      setRecording(false);
      window.removeEventListener('keydown', handleKeyDown, true);
    },
    [onSet]
  );

  const startRecording = useCallback(() => {
    previousValueRef.current = shortcut;
    setRecording(true);
    window.addEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown, shortcut]);

  const cancelRecording = useCallback(() => {
    setRecording(false);
    window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!recording) return;
    const handleBlur = () => {
      cancelRecording();
    };
    const el = inputRef.current;
    el?.addEventListener('blur', handleBlur);
    return () => el?.removeEventListener('blur', handleBlur);
  }, [recording, cancelRecording]);

  const isCustom = shortcut !== defaultShortcut;

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-[var(--text)] min-w-[100px]">{label}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {errorMessage && (
          <span
            className="text-xs shrink-0 truncate animate-shortcut-error"
            style={{ color: 'var(--danger)', maxWidth: '180px' }}
            title={errorMessage}
            onAnimationEnd={onErrorAnimationEnd}
          >
            {errorMessage}
          </span>
        )}
        {isCustom && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onResetOne(); }}
            title="Reset to default"
            className="p-1.5 rounded transition-colors shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        <button
          ref={inputRef}
          type="button"
          onClick={recording ? cancelRecording : startRecording}
          className="px-3 py-2 rounded-md text-sm min-w-[120px] text-left transition-colors"
          style={{
            background: recording ? 'var(--accent-soft, rgba(10,132,255,0.2))' : 'var(--surface)',
            border: `1px solid ${recording ? 'var(--accent)' : 'var(--border)'}`,
            color: 'var(--text)',
          }}
        >
          {recording ? (
            <span style={{ color: 'var(--accent)' }}>Press a key…</span>
          ) : shortcut ? (
            formatShortcutForDisplay(shortcut)
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Click to set</span>
          )}
        </button>
      </div>
    </div>
  );
}

const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  mix: 'Add Mix',
  batch: 'Add Batch',
  solo: 'Add Solo',
  mute: 'Add Mute',
  refresh: 'Refresh',
  undo: 'Undo',
  redo: 'Redo',
  settings: 'Open Settings',
};

interface SettingsShortcutsProps {
  shortcuts: Shortcuts;
  onSetShortcut: (action: ShortcutAction, value: string) => void;
  onResetShortcut: (action: ShortcutAction) => void;
  onReset: () => void;
}

export function SettingsShortcuts({
  shortcuts,
  onSetShortcut,
  onResetShortcut,
  onReset,
}: SettingsShortcutsProps) {
  const [conflictError, setConflictError] = useState<{ action: ShortcutAction; message: string } | null>(null);
  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        Keyboard shortcuts
      </h2>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Click a shortcut and press the keys you want. Use meta (⌘) or ctrl, plus shift/alt as needed. Press Esc to cancel.
      </p>
      <div
        className="rounded-xl p-4 space-y-1"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map((action) => (
            <ShortcutRow
              key={action}
              label={SHORTCUT_LABELS[action]}
              shortcut={shortcuts[action]}
              defaultShortcut={DEFAULT_SHORTCUTS[action]}
              errorMessage={conflictError?.action === action ? conflictError.message : null}
              onErrorAnimationEnd={() => setConflictError(null)}
              onSet={(value) => {
                const conflict = (Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).find(
                  (a) => a !== action && shortcuts[a] === value
                );
                if (conflict) {
                  setConflictError({
                    action,
                    message: `Already used by ${SHORTCUT_LABELS[conflict]}`,
                  });
                  return;
                }
                setConflictError(null);
                onSetShortcut(action, value);
              }}
              onResetOne={() => onResetShortcut(action)}
            />
        ))}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="px-4 py-2 text-sm rounded-md transition-colors"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        Reset to defaults
      </button>
    </div>
  );
}

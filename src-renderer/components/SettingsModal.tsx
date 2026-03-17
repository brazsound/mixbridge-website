import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SettingsNaming } from './SettingsNaming';
import { SettingsShortcuts } from './SettingsShortcuts';
import { SettingsAccount } from './SettingsAccount';
import { SettingsProTools } from './SettingsProTools';
import type { DefaultNaming } from '../hooks/useSettings';
import type { Shortcuts, ShortcutAction } from '../hooks/useShortcuts';
import type { ProToolsPreferences, SessionRenameMode } from '../hooks/useProToolsPreferences';

export type SettingsTab = 'shortcuts' | 'naming' | 'account' | 'protools';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  defaultNaming: DefaultNaming;
  onSaveNaming: (naming: DefaultNaming) => void;
  shortcuts: Shortcuts;
  onSetShortcut: (action: ShortcutAction, value: string) => void;
  onResetShortcut: (action: ShortcutAction) => void;
  onResetShortcuts: () => void;
  proToolsPrefs?: ProToolsPreferences;
  onSetIgnoreMissingFiles?: (v: boolean) => void;
  onSetIgnoreMissingPlugins?: (v: boolean) => void;
  onSetIgnoreIOChange?: (v: boolean) => void;
  onSetRenameSessionAfterBatch?: (v: boolean) => void;
  onSetRenameSettings?: (settings: {
    renameMode?: SessionRenameMode;
    renameCustomName?: string;
    renamePrefix?: string;
    renameSuffix?: string;
  }) => void;
  onRestartTutorial?: () => void;
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'naming', label: 'Naming' },
  { id: 'protools', label: 'Session Dialogs' },
  { id: 'account', label: 'Account' },
];

export function SettingsModal({
  open,
  onClose,
  activeTab,
  onTabChange,
  defaultNaming,
  onSaveNaming,
  shortcuts,
  onSetShortcut,
  onResetShortcut,
  onResetShortcuts,
  proToolsPrefs,
  onSetIgnoreMissingFiles,
  onSetIgnoreMissingPlugins,
  onSetIgnoreIOChange,
  onSetRenameSessionAfterBatch,
  onSetRenameSettings,
  onRestartTutorial,
}: SettingsModalProps) {

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="flex flex-col w-full max-w-[520px] h-[70vh] min-h-[360px] overflow-hidden rounded-2xl"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.06) inset',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0 px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-0.5 shrink-0 px-4 pt-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors"
              style={{
                color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {activeTab === 'shortcuts' && (
            <SettingsShortcuts
              shortcuts={shortcuts}
              onSetShortcut={onSetShortcut}
              onResetShortcut={onResetShortcut}
              onReset={onResetShortcuts}
            />
          )}
          {activeTab === 'naming' && (
            <SettingsNaming defaultNaming={defaultNaming} onSave={onSaveNaming} />
          )}
          {activeTab === 'account' && <SettingsAccount onRestartTutorial={onRestartTutorial} />}
          {activeTab === 'protools' && proToolsPrefs && onSetIgnoreMissingFiles && onSetIgnoreMissingPlugins && onSetIgnoreIOChange && (
            <SettingsProTools
              prefs={proToolsPrefs}
              onSetIgnoreMissingFiles={onSetIgnoreMissingFiles}
              onSetIgnoreMissingPlugins={onSetIgnoreMissingPlugins}
              onSetIgnoreIOChange={onSetIgnoreIOChange}
              onSetRenameSessionAfterBatch={onSetRenameSessionAfterBatch}
              onSetRenameSettings={onSetRenameSettings}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

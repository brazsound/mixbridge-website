import { useCallback } from 'react';
import { useModalEscape } from '../hooks/useModalEscape';
import { createPortal } from 'react-dom';
import { SettingsGeneral } from './SettingsGeneral';
import { SettingsNaming } from './SettingsNaming';
import { SettingsShortcuts } from './SettingsShortcuts';
import { SettingsAccount } from './SettingsAccount';
import { SettingsProTools } from './SettingsProTools';
import { SettingsNotifications } from './SettingsNotifications';
import type { DefaultNaming } from '../hooks/useSettings';
import type { Shortcuts, ShortcutAction } from '../hooks/useShortcuts';
import type { ProToolsPreferences, SessionRenameMode } from '../hooks/useProToolsPreferences';
import type { AppTheme } from '../hooks/useGeneralSettings';

export type SettingsTab = 'general' | 'shortcuts' | 'naming' | 'account' | 'protools' | 'notifications';

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
  autoAddSessionToBatch?: boolean;
  onSetAutoAddSessionToBatch?: (v: boolean) => void;
  theme?: AppTheme;
  onSetTheme?: (t: AppTheme) => void;
  alwaysOnTop?: boolean;
  onSetAlwaysOnTop?: (v: boolean) => void;
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'naming', label: 'Naming' },
  { id: 'protools', label: 'Session Dialogs' },
  { id: 'notifications', label: 'Notifications' },
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
  autoAddSessionToBatch = true,
  onSetAutoAddSessionToBatch,
  theme = 'dark',
  onSetTheme,
  alwaysOnTop = false,
  onSetAlwaysOnTop,
}: SettingsModalProps) {

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  useModalEscape(onClose, open);

  if (!open) return null;

  const content = (
    <div
      className="backdrop-modal fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="modal-panel flex flex-col w-full max-w-[640px] h-[70vh] min-h-[360px] overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0 px-5 py-4"
          style={{ borderBottom: '1px solid var(--divider)' }}
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

        {/* Sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Vertical sidebar */}
          <div
            className="flex flex-col shrink-0 w-[140px] py-3"
            style={{ borderRight: '1px solid var(--divider)' }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className="w-full text-left px-4 py-2.5 text-sm font-medium rounded-r-md transition-colors hover:bg-[var(--surface-hover)]"
                style={{
                  color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
                  background: activeTab === tab.id ? 'var(--surface-hover-strong)' : 'transparent',
                  borderLeft: activeTab === tab.id ? '3px solid var(--accent)' : '3px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5 min-h-0 min-w-0">
          {activeTab === 'general' && onSetAutoAddSessionToBatch && onSetTheme && onSetAlwaysOnTop && (
            <SettingsGeneral
              autoAddSessionToBatch={autoAddSessionToBatch ?? true}
              onSetAutoAddSessionToBatch={onSetAutoAddSessionToBatch}
              theme={theme}
              onSetTheme={onSetTheme}
              alwaysOnTop={alwaysOnTop}
              onSetAlwaysOnTop={onSetAlwaysOnTop}
            />
          )}
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
          {activeTab === 'notifications' && <SettingsNotifications />}
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
    </div>
  );

  return createPortal(content, document.body);
}

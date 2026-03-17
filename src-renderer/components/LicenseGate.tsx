import { useState, useCallback } from 'react';
import { useLicense } from '../hooks/useLicense';
import { SettingsModal } from './SettingsModal';
import type { DefaultNaming } from '../hooks/useSettings';
import type { Shortcuts, ShortcutAction } from '../hooks/useShortcuts';
import type { ProToolsPreferences } from '../hooks/useProToolsPreferences';
import type { SettingsTab } from './SettingsModal';

interface LicenseGateProps {
  children: React.ReactNode;
  defaultNaming: DefaultNaming;
  shortcuts: Shortcuts;
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
  onSaveNaming: (naming: DefaultNaming) => void;
  onSetShortcut: (action: ShortcutAction, value: string) => void;
  onResetShortcut: (action: ShortcutAction) => void;
  onResetShortcuts: () => void;
  formatShortcutForDisplay: (value: string) => string;
  proToolsPrefs?: ProToolsPreferences;
  onSetIgnoreMissingFiles?: (v: boolean) => void;
  onSetIgnoreMissingPlugins?: (v: boolean) => void;
  onSetIgnoreIOChange?: (v: boolean) => void;
  onSetRenameSessionAfterBatch?: (v: boolean) => void;
  onSetRenameSettings?: (settings: {
    renameMode?: import('../hooks/useProToolsPreferences').SessionRenameMode;
    renameCustomName?: string;
    renamePrefix?: string;
    renameSuffix?: string;
  }) => void;
}

export function LicenseGate({
  children,
  defaultNaming,
  shortcuts,
  settingsTab,
  onSettingsTabChange,
  onSaveNaming,
  onSetShortcut,
  onResetShortcut,
  onResetShortcuts,
  formatShortcutForDisplay,
  proToolsPrefs,
  onSetIgnoreMissingFiles,
  onSetIgnoreMissingPlugins,
  onSetIgnoreIOChange,
  onSetRenameSessionAfterBatch,
  onSetRenameSettings,
}: LicenseGateProps) {
  const { hasAccess, loading, refresh, activateWithEmail, openCheckout } = useLicense();
  const [showSettings, setShowSettings] = useState(false);
  const [email, setEmail] = useState('');
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const handleActivate = useCallback(async () => {
    if (!email.trim()) return;
    setActivating(true);
    setActivateError(null);
    const result = await activateWithEmail(email);
    setActivating(false);
    if (result.ok) setEmail('');
    else setActivateError(result.error ?? 'Activation failed');
  }, [email, activateWithEmail]);

  const handleStartTrial = useCallback(async () => {
    const result = await openCheckout();
    if (result.error) setActivateError(result.error);
    else void refresh();
  }, [openCheckout, refresh]);

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4"
        style={{ height: '100vh', background: 'var(--bg)', color: 'var(--text-muted)' }}
      >
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Checking license...</span>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <>
        <div
          className="flex flex-col items-center justify-center p-8"
          style={{ height: '100vh', background: 'var(--bg)' }}
        >
          <div
            className="flex flex-col items-center max-w-md w-full gap-6"
            style={{ color: 'var(--text)' }}
          >
            <h1 className="text-xl font-semibold">Mix Bridge</h1>
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              Start a 7-day free trial or subscribe to continue.
            </p>

            <div
              className="w-full rounded-xl p-6 flex flex-col gap-4"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={handleStartTrial}
                className="w-full py-3 px-4 rounded-lg font-medium"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                Start 7-day free trial
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  Already have a subscription?
                </span>
                <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
              </div>

              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent"
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                />
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating || !email.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {activating ? 'Activating...' : 'Activate'}
                </button>
              </div>

              {activateError && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {activateError}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="text-sm hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Open Settings
            </button>
          </div>
        </div>

        <SettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          activeTab={settingsTab}
          onTabChange={onSettingsTabChange}
          defaultNaming={defaultNaming}
          onSaveNaming={onSaveNaming}
          shortcuts={shortcuts}
          onSetShortcut={onSetShortcut}
          onResetShortcut={onResetShortcut}
          onResetShortcuts={onResetShortcuts}
          proToolsPrefs={proToolsPrefs}
          onSetIgnoreMissingFiles={onSetIgnoreMissingFiles}
          onSetIgnoreMissingPlugins={onSetIgnoreMissingPlugins}
          onSetIgnoreIOChange={onSetIgnoreIOChange}
          onSetRenameSessionAfterBatch={onSetRenameSessionAfterBatch}
          onSetRenameSettings={onSetRenameSettings}
        />
      </>
    );
  }

  return <>{children}</>;
}

import type { ProToolsPreferences, SessionRenameMode } from '../hooks/useProToolsPreferences';
import { SettingsSwitch } from './SettingsSwitch';

interface SettingsProToolsProps {
  prefs: ProToolsPreferences;
  onSetIgnoreMissingFiles: (v: boolean) => void;
  onSetIgnoreMissingPlugins: (v: boolean) => void;
  onSetIgnoreIOChange: (v: boolean) => void;
  onSetRenameSessionAfterBatch?: (v: boolean) => void;
  onSetRenameSettings?: (settings: {
    renameMode?: SessionRenameMode;
    renameCustomName?: string;
    renamePrefix?: string;
    renameSuffix?: string;
  }) => void;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: '1px solid var(--divider)' }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {label}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      </div>
      <SettingsSwitch checked={checked} onChange={onChange} aria-label={label} />
    </div>
  );
}

export function SettingsProTools({
  prefs,
  onSetIgnoreMissingFiles,
  onSetIgnoreMissingPlugins,
  onSetIgnoreIOChange,
  onSetRenameSessionAfterBatch,
  onSetRenameSettings,
}: SettingsProToolsProps) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>
        When opening sessions via Mix Bridge, these options tell Pro Tools to skip the corresponding dialogs (requires Pro Tools 2025.06+).
      </p>
      <Toggle
        checked={prefs.ignoreMissingFiles}
        onChange={onSetIgnoreMissingFiles}
        label="Ignore Missing Files"
        description="Skip the dialog when audio/video files are missing. Pro Tools will use “Skip All”."
      />
      <Toggle
        checked={prefs.ignoreMissingPlugins}
        onChange={onSetIgnoreMissingPlugins}
        label="Ignore Missing Plugins"
        description="Skip the dialog when AAX plugins are missing."
      />
      <Toggle
        checked={prefs.ignoreIOChange}
        onChange={onSetIgnoreIOChange}
        label="Ignore IO Change"
        description="Skip the dialog when the session’s IO setup differs from the current hardware."
      />

      {onSetRenameSessionAfterBatch && onSetRenameSettings && (
        <>
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--divider)' }}>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
              After a batch run completes, optionally save the session with a new name (creates a new .ptx file in the same folder).
            </p>
            <Toggle
              checked={prefs.renameSessionAfterBatch}
              onChange={onSetRenameSessionAfterBatch}
              label="Rename session after bounce"
              description="Save As with a new name before closing each session."
            />
          </div>

          {prefs.renameSessionAfterBatch && (
            <div className="mt-3 pl-1 space-y-3" style={{ borderLeft: '2px solid var(--accent)' }}>
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                  Rename mode
                </p>
                <div className="flex gap-2">
                  {(['custom', 'prefix', 'suffix'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSetRenameSettings({ renameMode: mode })}
                      className="px-3 py-1.5 text-xs rounded-lg transition-colors capitalize"
                      style={{
                        background: prefs.renameMode === mode ? 'var(--accent)' : 'var(--surface-hover-strong)',
                        color: prefs.renameMode === mode ? '#fff' : 'var(--text-muted)',
                        border: `1px solid ${prefs.renameMode === mode ? 'var(--accent-border-strong)' : 'var(--divider-strong)'}`,
                      }}
                    >
                      {mode === 'custom' ? 'Custom name' : mode}
                    </button>
                  ))}
                </div>
              </div>

              {prefs.renameMode === 'custom' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                    New session name
                  </label>
                  <input
                    type="text"
                    value={prefs.renameCustomName}
                    onChange={(e) => onSetRenameSettings({ renameCustomName: e.target.value })}
                    placeholder="e.g. MySession_Stems"
                    className="w-full px-3 py-2 text-sm rounded-lg"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              )}

              {prefs.renameMode === 'prefix' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                    Prefix (added before session name)
                  </label>
                  <input
                    type="text"
                    value={prefs.renamePrefix}
                    onChange={(e) => onSetRenameSettings({ renamePrefix: e.target.value })}
                    placeholder="e.g. Stems_"
                    className="w-full px-3 py-2 text-sm rounded-lg"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              )}

              {prefs.renameMode === 'suffix' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                    Suffix (added after session name)
                  </label>
                  <input
                    type="text"
                    value={prefs.renameSuffix}
                    onChange={(e) => onSetRenameSettings({ renameSuffix: e.target.value })}
                    placeholder="e.g. _Stems"
                    className="w-full px-3 py-2 text-sm rounded-lg"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

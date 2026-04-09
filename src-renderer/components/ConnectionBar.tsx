interface ConnectionBarProps {
  connected: boolean;
  sessionName: string | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  onSettingsClick: () => void;
  showingSettings: boolean;
  settingsShortcut?: string;
}

export function ConnectionBar({
  connected,
  sessionName,
  loading,
  error,
  onRetry,
  onSettingsClick,
  showingSettings,
  settingsShortcut,
}: ConnectionBarProps) {
  return (
    <header
      className="window-drag flex items-center justify-between select-none"
      style={{
        padding: '0 var(--panel-p-sm)',
        height: '42px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid var(--divider)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* App title */}
      <div className="window-no-drag flex items-center gap-2 window-title-offset">
        <div
          className="w-1.5 h-1.5 rounded-full transition-all duration-500 shrink-0"
          style={{
            background: connected
              ? 'var(--success)'
              : loading
              ? 'var(--warning)'
              : 'rgba(255,255,255,0.2)',
            boxShadow: connected ? '0 0 5px var(--success)' : 'none',
          }}
        />
        <span
          className="text-[13px] font-semibold"
          style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}
        >
          Mix Bridge
        </span>
      </div>

      {/* Right side controls */}
      <div className="window-no-drag flex items-center gap-2">
        {/* Session / status pill */}
        {connected ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: 'var(--surface-pressed)',
              border: '1px solid var(--divider)',
            }}
            data-tutorial="connect"
          >
            <span
              className="text-[11px] font-medium whitespace-nowrap max-w-[180px] truncate"
              style={{ color: 'var(--text-secondary)' }}
              title={sessionName ?? undefined}
            >
              {sessionName ?? 'Pro Tools'}
            </span>
          </div>
        ) : (
          <button
            type="button"
            data-tutorial="connect"
            onClick={error && onRetry && !loading ? onRetry : undefined}
            disabled={loading || !onRetry}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover-strong)] hover:border-[var(--divider-strong)] disabled:cursor-default disabled:hover:bg-transparent disabled:hover:border-[var(--divider)]"
            style={{
              background: 'var(--surface-pressed)',
              border: '1px solid var(--divider)',
              cursor: error && onRetry && !loading ? 'pointer' : 'default',
            }}
            title={error ? 'Could not connect to Pro Tools. Make sure Pro Tools is running with a session open, then click to retry.' : 'Open Pro Tools with a session loaded. The app will auto-connect.'}
          >
            <span
              className="text-[11px] text-left"
              style={{ color: error ? 'var(--danger)' : 'var(--text-muted)' }}
            >
              {loading ? 'Connecting…' : error ? 'Could not connect — Retry' : 'Not connected'}
            </span>
          </button>
        )}

        {/* Settings icon button */}
        <button
          type="button"
          onClick={onSettingsClick}
          title={settingsShortcut ? `Settings (${settingsShortcut})` : 'Settings'}
          data-active={showingSettings}
          className="btn-icon w-8 h-8 rounded-lg"
          style={{
            background: showingSettings ? 'var(--accent-soft-mid)' : 'transparent',
            border: `1px solid ${showingSettings ? 'var(--accent-border)' : 'transparent'}`,
            color: showingSettings ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

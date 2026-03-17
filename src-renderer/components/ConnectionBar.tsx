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
      className="window-drag flex items-center justify-between px-5 py-2 select-none"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* App title */}
      <div className="window-no-drag flex items-center gap-2.5 window-title-offset">
        <div
          className="w-2 h-2 rounded-full transition-all duration-500"
          style={{
            background: connected
              ? 'var(--success)'
              : loading
              ? 'var(--warning)'
              : 'rgba(255,255,255,0.2)',
            boxShadow: connected ? '0 0 6px var(--success)' : 'none',
          }}
        />
        <span
          className="text-sm font-semibold tracking-tight"
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
            data-tutorial="connect"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span
              className="text-[11px] font-medium whitespace-nowrap"
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: error && onRetry && !loading ? 'pointer' : 'default',
            }}
            title={error ? `${error} Click to retry.` : 'Open Pro Tools with a session loaded. The app will auto-connect.'}
            onMouseEnter={(e) => {
              if (error && onRetry && !loading) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <span
              className="text-[11px] text-left"
              style={{ color: error ? '#ff8a80' : 'var(--text-muted)' }}
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
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150"
          style={{
            background: showingSettings
              ? 'rgba(10,132,255,0.18)'
              : 'rgba(255,255,255,0.06)',
            border: showingSettings
              ? '1px solid rgba(10,132,255,0.4)'
              : '1px solid rgba(255,255,255,0.10)',
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

import { useEffect, useCallback } from 'react';

interface UpdateAvailableDialogProps {
  version: string;
  releaseNotes?: string;
  downloading: boolean;
  progress?: number;
  downloaded: boolean;
  onUpdate: () => void;
  onSkip: () => void;
  onRestart: () => void;
  onClose: () => void;
}

export function UpdateAvailableDialog({
  version,
  releaseNotes,
  downloading,
  progress = 0,
  downloaded,
  onUpdate,
  onSkip,
  onRestart,
  onClose,
}: UpdateAvailableDialogProps) {
  const handleClose = useCallback(() => {
    if (!downloading && !downloaded) onClose();
  }, [downloading, downloaded, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !downloading && !downloaded) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [downloading, downloaded, handleClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="flex flex-col w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: '#141416',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            {downloaded ? 'Update ready' : 'Update available'}
          </h3>
          <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
            {downloaded
              ? `Version ${version} has been downloaded. Restart the app to install.`
              : `A new version (${version}) is available.`}
          </p>
          {releaseNotes && !downloaded && (
            <div
              className="mt-3 text-xs rounded-lg p-3 max-h-24 overflow-y-auto"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {releaseNotes}
            </div>
          )}
          {downloading && (
            <div className="mt-3">
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Downloading... {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 pb-5">
          {downloaded ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Later
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                Restart to install
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onSkip}
                disabled={downloading}
                className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={onUpdate}
                disabled={downloading}
                className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {downloading ? 'Downloading...' : 'Update'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';

const DEBOUNCE_MS = 60_000; // Don't show again within 60 seconds

interface ErrorReportPromptProps {
  onSend: () => Promise<{ ok: boolean; error?: string }>;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function ErrorReportPrompt({ onSend, onSuccess, onError }: ErrorReportPromptProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastShownAt, setLastShownAt] = useState(0);

  const handleErrorOccurred = useCallback(() => {
    const now = Date.now();
    if (now - lastShownAt < DEBOUNCE_MS) return;
    setLastShownAt(now);
    setOpen(true);
  }, [lastShownAt]);

  useEffect(() => {
    const unsubscribe = window.appLog?.onErrorOccurred?.(handleErrorOccurred);
    return () => unsubscribe?.();
  }, [handleErrorOccurred]);

  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      const result = await onSend();
      if (result.ok) {
        onSuccess();
        setOpen(false);
      } else {
        onError(result.error ?? 'Failed to send report');
      }
    } finally {
      setSending(false);
    }
  }, [onSend, onSuccess, onError]);

  const handleDismiss = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleDismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && handleDismiss()}
    >
      <div
        className="flex flex-col w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: '#141416',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            An error occurred
          </h3>
          <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Send a report to help us fix it?
          </p>
        </div>

        <div className="flex gap-2 justify-end px-5 pb-5">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={sending}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
            className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {sending ? 'Sending...' : 'Send report'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';

interface ReportBugModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (description: string) => Promise<{ ok: boolean; error?: string }>;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function ReportBugModal({
  open,
  onClose,
  onSubmit,
  onSuccess,
  onError,
}: ReportBugModalProps) {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const result = await onSubmit(description);
      if (result.ok) {
        onSuccess();
        onClose();
        setDescription('');
      } else {
        onError(result.error ?? 'Failed to send report');
      }
    } finally {
      setSubmitting(false);
    }
  }, [description, onSubmit, onSuccess, onError, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
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
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Report a bug
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Technical log will be included automatically. No project or session info is sent.
          </p>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div>
            <label htmlFor="report-bug-desc" className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Describe what happened (optional but helpful)
            </label>
            <textarea
              id="report-bug-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bounce failed after connecting to Pro Tools..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                border: '1px solid var(--border)',
                color: 'var(--text)',
                background: 'rgba(0,0,0,0.2)',
              }}
              disabled={submitting}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {submitting ? 'Sending...' : 'Send report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

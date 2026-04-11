import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type FeedbackType = 'general' | 'bug' | 'feature';

const inputClass =
  'w-full px-4 py-2.5 rounded-[var(--radius)] bg-white/[0.03] border text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-colors border-[rgba(255,255,255,0.08)]';

const types: { value: FeedbackType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
];

export function AccountFeedback() {
  const { user } = useAuth();
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { setError('Please enter your feedback.'); return; }
    setError(null);
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = (import.meta.env.VITE_LICENSE_API_URL as string ?? '').replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/web/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ type, message: message.trim() }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to send feedback.');
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Feedback</h1>
      <p className="text-text-muted text-sm mb-8">
        Share your thoughts and help us improve Mix Bridge.
      </p>

      <div className="glass-card p-6 max-w-lg">
        <h2 className="font-medium mb-1">App Feedback</h2>
        <p className="text-text-muted text-sm mb-6">
          {"Your feedback helps make Mix Bridge better for everyone. Whether it's a bug you've found or a feature you'd love to see, we want to hear from you."}
        </p>

        {sent ? (
          <div className="space-y-4">
            <p className="text-emerald-400/90 text-sm">
              Thanks! Your feedback has been sent. We'll get back to you if needed.
            </p>
            <button
              type="button"
              className="btn-accent text-sm py-2 px-4"
              onClick={() => setSent(false)}
            >
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset>
              <legend className="text-sm font-medium mb-3">Type</legend>
              <div className="flex flex-wrap gap-3">
                {types.map((t) => (
                  <label
                    key={t.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors border ${
                      type === t.value
                        ? 'border-accent/30 bg-accent/8 text-accent'
                        : 'text-text-muted hover:bg-white/[0.04] hover:text-text-secondary'
                    }`}
                    style={{ borderColor: type === t.value ? undefined : 'var(--border)', background: type === t.value ? undefined : 'var(--surface)' }}
                  >
                    <input
                      type="radio"
                      name="feedback-type"
                      value={t.value}
                      checked={type === t.value}
                      onChange={() => setType(t.value)}
                      className="sr-only"
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: type === t.value ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }}
                    >
                      {type === t.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      )}
                    </span>
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="feedback-message" className="block text-sm font-medium mb-2">
                Your Feedback
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think…"
                rows={6}
                className={inputClass + ' resize-y'}
                required
              />
            </div>

            {error && <p className="text-amber-400 text-sm">{error}</p>}

            <button type="submit" disabled={sending} className="btn-accent text-sm py-2.5 px-5">
              {sending ? 'Opening…' : 'Submit Feedback'}
            </button>
          </form>
        )}
      </div>

      {/* Feedback history placeholder */}
      <div className="glass-card p-6 max-w-lg mt-6">
        <h2 className="font-medium mb-2">Your Feedback History</h2>
        <p className="text-text-muted text-sm">No feedback submitted yet.</p>
      </div>
    </div>
  );
}

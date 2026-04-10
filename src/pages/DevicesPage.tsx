import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_LICENSE_API_URL ?? '';

interface Activation {
  device_id: string;
  display_name: string | null;
  activated_at: string;
}

export function DevicesPage() {
  const { session } = useAuth();
  const [activations, setActivations] = useState<Activation[]>([]);
  const [tier, setTier] = useState<string | null>(null);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token || !API_URL) {
      setLoading(false);
      if (!API_URL) setError('License server URL is not configured for this site build.');
      return;
    }

    setError(null);
    fetch(`${API_URL.replace(/\/$/, '')}/api/web/list-activations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        let data: { activations?: Activation[]; tier?: string | null; activation_used?: number; activation_limit?: number; error?: string };
        try { data = await res.json(); }
        catch { setError('Invalid response from the license server.'); return; }
        if (!res.ok) { setError(data.error ?? `Could not load devices (${res.status}).`); return; }
        setActivations(data.activations ?? []);
        setTier(data.tier ?? null);
        setUsed(data.activation_used ?? 0);
        setLimit(data.activation_limit ?? 0);
        setError(data.error ?? null);
      })
      .catch(() => setError('Could not reach the license server.'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const handleDeactivate = async (deviceId: string) => {
    if (!session?.access_token || !API_URL) return;
    if (!window.confirm('Deactivate this device? You can use that slot on another Mac.')) return;

    setDeactivating(deviceId);
    try {
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/web/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ device_id: deviceId }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setActivations((prev) => prev.filter((a) => a.device_id !== deviceId)); setUsed((prev) => Math.max(0, prev - 1)); }
    } catch { setError('Failed to deactivate'); }
    finally { setDeactivating(null); }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Devices</h1>
      <p className="text-text-muted text-sm mb-8">
        {used} of {limit} device{limit !== 1 ? 's' : ''} activated{tier ? ` (${tier})` : ''}
      </p>

      {loading ? (
        <p className="text-text-muted">Loading\u2026</p>
      ) : error ? (
        <p className="text-amber-400 text-sm">{error}</p>
      ) : activations.length === 0 ? (
        <div className="glass-card p-6">
          <p className="text-text-muted text-sm">
            No devices yet. Install Mix Bridge on your Mac and sign in with your email to add one.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {activations.map((a) => (
            <li key={a.device_id} className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-text-muted shrink-0">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                <div>
                  <p className="font-medium text-sm">{a.display_name || a.device_id.slice(0, 16) + '\u2026'}</p>
                  <p className="text-text-muted text-xs">{formatDate(a.activated_at)} \u00B7 {a.device_id.slice(0, 8)}\u2026</p>
                </div>
              </div>
              <button
                onClick={() => handleDeactivate(a.device_id)}
                disabled={deactivating === a.device_id}
                className="px-3 py-1.5 text-xs rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                {deactivating === a.device_id ? 'Deactivating\u2026' : 'Deactivate'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

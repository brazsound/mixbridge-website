import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Nav } from '@/components/Nav';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_LICENSE_API_URL ?? '';

interface Activation {
  device_id: string;
  display_name: string | null;
  activated_at: string;
}

export function DevicesPage() {
  const { user, session, loading: authLoading } = useAuth();
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
      return;
    }

    fetch(`${API_URL.replace(/\/$/, '')}/api/web/list-activations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        setActivations(data.activations ?? []);
        setTier(data.tier ?? null);
        setUsed(data.activation_used ?? 0);
        setLimit(data.activation_limit ?? 0);
        setError(data.error ?? null);
      })
      .catch(() => setError('Failed to load devices'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const handleDeactivate = async (deviceId: string) => {
    if (!session?.access_token || !API_URL) return;
    if (!window.confirm('Deactivate this device? You can use that slot on another Mac.')) return;

    setDeactivating(deviceId);
    try {
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/web/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ device_id: deviceId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setActivations((prev) => prev.filter((a) => a.device_id !== deviceId));
        setUsed((prev) => Math.max(0, prev - 1));
      }
    } catch {
      setError('Failed to deactivate');
    } finally {
      setDeactivating(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="pt-24 flex justify-center">
          {!user ? (
            <Link to="/account" className="text-accent hover:underline">
              Sign in to manage devices
            </Link>
          ) : (
            <p className="text-text-muted">Loading…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />
      <div className="pt-24 px-6 max-w-2xl mx-auto pb-20">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/account" className="text-text-secondary hover:text-text text-sm">
            ← Account
          </Link>
          <h1 className="text-2xl font-semibold">Devices</h1>
        </div>

        <p className="text-text-secondary mb-6">
          {used} of {limit} device{limit !== 1 ? 's' : ''} activated
          {tier && ` (${tier})`}
        </p>

        {loading ? (
          <p className="text-text-muted">Loading…</p>
        ) : error ? (
          <p className="text-amber-400">{error}</p>
        ) : activations.length === 0 ? (
          <div className="glass-card p-6">
            <p className="text-text-muted">
              No devices yet. Install Mix Bridge on your Mac and sign in with your email to add one.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {activations.map((a) => (
              <li key={a.device_id} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {a.display_name || a.device_id.slice(0, 16) + '…'}
                  </p>
                  <p className="text-text-muted text-sm">
                    {formatDate(a.activated_at)} · {a.device_id.slice(0, 8)}…
                  </p>
                </div>
                <button
                  onClick={() => handleDeactivate(a.device_id)}
                  disabled={deactivating === a.device_id}
                  className="px-4 py-2 text-sm rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {deactivating === a.device_id ? 'Deactivating…' : 'Deactivate'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

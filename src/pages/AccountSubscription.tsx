import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_LICENSE_API_URL ?? '';

interface SubData {
  status: string | null;
  tier: string | null;
  activation_used: number;
  activation_limit: number;
  error?: string;
}

const tiers = [
  { name: 'Solo', price: 49, devices: 1, current: false },
  { name: 'Pro', price: 99, devices: 3, current: false },
  { name: 'Team', price: 199, devices: 10, current: false },
];

export function AccountSubscription() {
  const { session } = useAuth();
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token || !API_URL) {
      setLoading(false);
      if (!API_URL) setError('License server URL is not configured.');
      return;
    }
    fetch(`${API_URL.replace(/\/$/, '')}/api/web/list-activations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Could not load subscription.'); return; }
        setData({
          status: json.status ?? null,
          tier: json.tier ?? null,
          activation_used: json.activation_used ?? 0,
          activation_limit: json.activation_limit ?? 0,
          error: json.error,
        });
      })
      .catch(() => setError('Could not reach the license server.'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const currentTier = data?.tier?.toLowerCase();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Subscription</h1>
      <p className="text-text-muted text-sm mb-8">
        Your current plan and billing information.
      </p>

      {loading ? (
        <p className="text-text-muted">Loading\u2026</p>
      ) : error ? (
        <p className="text-amber-400 text-sm">{error}</p>
      ) : (
        <div className="space-y-6">
          {/* Current subscription card */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">Subscription</h2>
              {data?.status ? (
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                  {data.status === 'free' ? 'NFR' : data.status}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                  Free
                </span>
              )}
            </div>

            {!data?.status ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-text">Free Plan</p>
                <p className="text-text-secondary text-sm">
                  Upgrade to unlock full Mix Bridge features. Billing opens soon.
                </p>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-muted)' }} />
                  Status: Free
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-text-secondary">
                  Plan: <span className="text-text capitalize font-medium">{data.tier ?? 'Unknown'}</span>
                </p>
                <p className="text-text-secondary">
                  Devices: {data.activation_used} / {data.activation_limit}
                </p>
                <p className="text-text-secondary">
                  Status: <span className="text-text capitalize">{data.status === 'free' ? 'NFR (complimentary)' : data.status}</span>
                </p>
              </div>
            )}
          </div>

          {/* Plans grid */}
          <div>
            <h2 className="font-medium mb-4">Available Plans</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {tiers.map((tier) => {
                const isCurrent = currentTier === tier.name.toLowerCase();
                return (
                  <div
                    key={tier.name}
                    className="glass-card p-5 flex flex-col"
                    style={isCurrent ? { border: '1px solid rgba(110,86,207,0.35)' } : undefined}
                  >
                    <h3 className="font-semibold mb-1">{tier.name}</h3>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-semibold">${tier.price}</span>
                      <span className="text-text-muted text-sm">/ year</span>
                    </div>
                    <p className="text-text-muted text-sm mb-4">
                      Up to {tier.devices} Mac{tier.devices > 1 ? 's' : ''}
                    </p>
                    {isCurrent ? (
                      <span className="mt-auto text-center py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid rgba(110,86,207,0.2)' }}>
                        Current plan
                      </span>
                    ) : (
                      <span className="mt-auto text-center py-2 rounded-lg text-sm font-medium text-text-muted" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        Coming soon
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-text-muted text-xs">
            Billing is not yet open. <Link to="/account" className="text-accent hover:underline">Return to dashboard</Link> and check back soon.
          </p>
        </div>
      )}
    </div>
  );
}

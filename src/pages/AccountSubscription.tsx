import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

const API_URL = import.meta.env.VITE_LICENSE_API_URL ?? '';

interface SubData {
  status: string | null;
  tier: string | null;
  activation_used: number;
  activation_limit: number;
  error?: string;
}

interface AnnualTier {
  name: string;
  price: number;
  devices: number;
  deviceLabel: string;
  features: string[];
  highlight: boolean;
}

const annualTiers: AnnualTier[] = [
  {
    name: 'Solo',
    price: 49,
    devices: 1,
    deviceLabel: '1 Mac',
    features: ['Unlimited bounce queue', 'WAV, MP3 & AIFF export', 'Session templates', 'Timeline & marker ranges'],
    highlight: false,
  },
  {
    name: 'Pro',
    price: 99,
    devices: 3,
    deviceLabel: 'Up to 3 Macs',
    features: ['Everything in Solo', 'Up to 3 activated Macs', 'Switch machines anytime', 'Priority support'],
    highlight: true,
  },
  {
    name: 'Team',
    price: 199,
    devices: 10,
    deviceLabel: 'Up to 10 Macs',
    features: ['Everything in Pro', 'Up to 10 activated Macs', 'Centralised licence management', 'Priority support'],
    highlight: false,
  },
];

const checkIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

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
    fetchWithRetry(
      `${API_URL.replace(/\/$/, '')}/api/web/list-activations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      },
    )
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
  const isComplimentary = data?.status === 'free';
  const isLifetime = currentTier === 'lifetime';
  const hasActivePlan = !!data?.status;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Subscription</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Your current plan and available options.
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card p-6 animate-pulse h-24" />
          ))}
        </div>
      ) : error ? (
        <p className="text-amber-400 text-sm">{error}</p>
      ) : (
        <div className="space-y-8">

          {/* Current plan card */}
          {hasActivePlan && (
            <div className="glass-card p-6" style={{ border: '1px solid rgba(110,86,207,0.2)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Current plan</p>
                  <p className="text-xl font-semibold capitalize" style={{ color: 'var(--text)' }}>
                    {isComplimentary ? 'Complimentary' : (isLifetime ? 'Lifetime V1' : (data?.tier ?? 'Unknown'))}
                  </p>
                  {isComplimentary && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      Complimentary access — no subscription required.
                    </p>
                  )}
                  {isLifetime && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      One-time purchase — no recurring fees, all V1 updates included.
                    </p>
                  )}
                  {!isComplimentary && !isLifetime && data?.status && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      Annual subscription · {data.activation_used} / {data.activation_limit} Mac{data.activation_limit !== 1 ? 's' : ''} activated
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
                >
                  {isComplimentary || isLifetime ? 'Active' : (data?.status ?? 'Active')}
                </span>
              </div>
            </div>
          )}

          {/* Annual plans */}
          {!isComplimentary && (
            <div>
              <h2 className="font-medium mb-1" style={{ color: 'var(--text)' }}>
                {hasActivePlan && !isLifetime ? 'Other plans' : 'Annual plans'}
              </h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                Licence stays active while you subscribe.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {annualTiers.map((tier) => {
                  const isCurrent = currentTier === tier.name.toLowerCase();
                  return (
                    <div
                      key={tier.name}
                      className="glass-card p-5 flex flex-col relative"
                      style={isCurrent ? { border: '1px solid rgba(110,86,207,0.35)' } : undefined}
                    >
                      {tier.highlight && !isCurrent && (
                        <div
                          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          Most popular
                        </div>
                      )}
                      <h3 className="font-semibold mb-1">{tier.name}</h3>
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-2xl font-semibold">${tier.price}</span>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/ year</span>
                      </div>
                      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{tier.deviceLabel}</p>
                      <ul className="space-y-2 mb-5 flex-1">
                        {tier.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{checkIcon}</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <span
                          className="mt-auto text-center py-2 rounded-lg text-sm font-medium"
                          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid rgba(110,86,207,0.2)' }}
                        >
                          Current plan
                        </span>
                      ) : (
                        <span
                          className="mt-auto text-center py-2 rounded-lg text-sm font-medium"
                          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        >
                          Coming soon
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lifetime tier */}
          {!isComplimentary && (
            <div>
              <h2 className="font-medium mb-1" style={{ color: 'var(--text)' }}>Lifetime</h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                Pay once, own Mix Bridge V1 forever.
              </p>
              <div
                className="glass-card p-6 flex flex-col md:flex-row md:items-center gap-6 md:gap-10"
                style={
                  isLifetime
                    ? { border: '1px solid rgba(110,86,207,0.35)' }
                    : { border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
                }
              >
                <div className="shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(110,86,207,0.15)', color: 'var(--accent)' }}
                    >
                      Own it forever
                    </span>
                  </div>
                  <p className="text-xl font-semibold mb-0.5">Lifetime V1</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold">$350</span>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>one-time</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Up to 3 Macs</p>
                </div>

                <div className="hidden md:block self-stretch" style={{ width: 1, background: 'rgba(255,255,255,0.07)' }} />

                <div className="flex-1">
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Pay once, use Mix Bridge V1 on up to 3 Macs — no subscription, no expiry.
                    When V2 ships, existing Lifetime holders get a discounted upgrade price.
                  </p>
                  <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {['No recurring fees', 'Up to 3 activated Macs', 'All V1 updates included', 'Discounted V2 upgrade', 'Priority support'].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{checkIcon}</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="shrink-0">
                  {isLifetime ? (
                    <span
                      className="px-6 py-2.5 text-sm font-medium rounded-[var(--radius)] block text-center"
                      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid rgba(110,86,207,0.2)' }}
                    >
                      Current plan
                    </span>
                  ) : (
                    <span
                      className="px-6 py-2.5 text-sm font-medium rounded-[var(--radius)] block text-center whitespace-nowrap"
                      style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Complimentary note */}
          {isComplimentary && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Your account has complimentary access. No billing or subscription is required.
            </p>
          )}

          {!isComplimentary && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Plan upgrades and billing are not yet open. Check back soon.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

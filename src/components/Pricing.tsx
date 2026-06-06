import { Link } from 'react-router-dom';

const annualTiers = [
  {
    name: 'Solo',
    price: 49,
    deviceLabel: '1 system',
    description: 'For individual engineers working from a single machine.',
    features: [
      'Unlimited bounce queue',
      'WAV, MP3 & AIFF export',
      'Session templates',
      'Timeline & marker ranges',
      '1 activated system',
    ],
    highlight: false,
  },
  {
    name: 'Pro',
    price: 99,
    deviceLabel: 'Up to 3 systems',
    description: 'For freelancers who move between studio, home, and laptop.',
    features: [
      'Everything in Solo',
      'Up to 3 activated systems',
      'Switch machines anytime',
      'Priority support',
    ],
    highlight: true,
  },
  {
    name: 'Team',
    price: 199,
    deviceLabel: 'Up to 10 systems',
    description: 'For commercial studios and post-production facilities.',
    features: [
      'Everything in Pro',
      'Up to 10 activated systems',
      'Centralized licence management',
      'Priority support',
    ],
    highlight: false,
  },
];

const checkIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function Pricing() {
  return (
    <section id="pricing" className="px-6 py-24 md:py-32" style={{ background: 'rgba(0,0,0,0.2)' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">Simple pricing</h2>
          <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
            Annual plans keep your licence active while you subscribe.
            Or pay once and own this version forever.
          </p>
        </div>

        {/* Annual tiers */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {annualTiers.map((tier) => (
            <div
              key={tier.name}
              className="glass-card p-6 flex flex-col relative"
              style={tier.highlight ? { border: '1px solid rgba(110,86,207,0.35)' } : undefined}
            >
              {tier.highlight && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-medium px-3 py-1 rounded-full whitespace-nowrap"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Most popular
                </div>
              )}

              <div className="mb-5">
                <h3 className="font-medium text-base mb-3">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-semibold">${tier.price}</span>
                  <span className="text-text-muted text-sm">/ year</span>
                </div>
                <p className="text-text-muted text-xs">{tier.deviceLabel}</p>
              </div>

              <p className="text-text-secondary text-sm leading-relaxed mb-5">
                {tier.description}
              </p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-text-muted">
                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{checkIcon}</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/account"
                className={`w-full text-center py-2.5 rounded-[var(--radius)] text-sm font-medium transition-colors block ${
                  tier.highlight ? 'btn-accent' : 'pricing-card-secondary'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>

        {/* Lifetime tier */}
        <div
          className="glass-card p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 md:gap-10"
          style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
        >
          {/* Left: price + label */}
          <div className="shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(110,86,207,0.15)', color: 'var(--accent)' }}
              >
                Own it forever
              </span>
            </div>
            <h3 className="font-semibold text-xl mt-2 mb-1">Lifetime V1</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold">$350</span>
              <span className="text-text-muted text-sm">one-time</span>
            </div>
            <p className="text-text-muted text-xs mt-1">Up to 3 systems</p>
          </div>

          {/* Divider */}
          <div className="hidden md:block self-stretch" style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />

          {/* Right: description + features */}
          <div className="flex-1">
            <p className="text-text-secondary text-sm leading-relaxed mb-4">
              Pay once, use Mix Bridge V1 on up to 3 systems. No subscription, no expiry.
              When V2 ships, existing Lifetime holders get a discounted upgrade price.
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                'No recurring fees',
                'Up to 3 activated systems',
                'All V1 updates included',
                'Discounted V2 upgrade',
                'Priority support',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-text-muted">
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{checkIcon}</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="shrink-0">
            <Link
              to="/account"
              className="btn-accent px-6 py-2.5 text-sm font-medium whitespace-nowrap block text-center"
            >
              Buy Lifetime
            </Link>
          </div>
        </div>

        <p className="text-center text-text-muted text-sm mt-8">
          <Link to="/account" className="underline underline-offset-2 hover:text-text-secondary transition-colors">
            Sign in to your account
          </Link>{' '}
          to manage your licence or devices.
        </p>

      </div>
    </section>
  );
}

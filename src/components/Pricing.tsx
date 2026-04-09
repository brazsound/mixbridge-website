import { Link } from 'react-router-dom';

const tiers = [
  {
    name: 'Solo',
    price: 49,
    devices: 1,
    deviceLabel: '1 Mac',
    description: 'For individual engineers working from a single machine.',
    features: [
      'Unlimited bounce queue',
      'WAV, MP3 & AIFF export',
      'Session templates',
      'Timeline & marker ranges',
      '1 activated Mac',
    ],
    highlight: false,
  },
  {
    name: 'Pro',
    price: 99,
    devices: 3,
    deviceLabel: 'Up to 3 Macs',
    description: 'For freelancers who move between studio, home, and laptop.',
    features: [
      'Everything in Solo',
      'Up to 3 activated Macs',
      'Switch machines anytime',
      'Priority support',
    ],
    highlight: true,
  },
  {
    name: 'Team',
    price: 199,
    devices: 10,
    deviceLabel: 'Up to 10 Macs',
    description: 'For commercial studios and post-production facilities.',
    features: [
      'Everything in Pro',
      'Up to 10 activated Macs',
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
    <section
      id="pricing"
      className="px-6 py-24 md:py-32"
      style={{ background: 'rgba(0,0,0,0.25)' }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Simple pricing
          </h2>
          <p className="text-text-secondary max-w-md mx-auto leading-relaxed">
            One licence per account. Activate on up to your plan's device count.
            Deactivate and move to a new Mac anytime — no extra charge.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="glass-card p-7 flex flex-col relative"
              style={tier.highlight ? {
                border: '1px solid rgba(10,132,255,0.4)',
                boxShadow: '0 0 40px rgba(10,132,255,0.08)',
              } : undefined}
            >
              {tier.highlight && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Most popular
                </div>
              )}

              <div className="mb-5">
                <h3 className="font-semibold text-lg mb-3">{tier.name}</h3>
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
                  <li key={f} className="flex items-center gap-2.5 text-sm text-text-secondary">
                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{checkIcon}</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/account"
                className="w-full text-center py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={tier.highlight ? {
                  background: 'var(--accent)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  display: 'block',
                } : {
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'block',
                }}
                onMouseEnter={(e) => {
                  if (!tier.highlight) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                    e.currentTarget.style.color = 'var(--text)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!tier.highlight) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                Get early access
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-text-muted text-sm">
          Billing not yet open.{' '}
          <Link to="/account" className="underline underline-offset-2 hover:text-text-secondary transition-colors">
            Sign in to your account
          </Link>{' '}
          to hold your spot — pricing goes live soon.
        </p>
      </div>
    </section>
  );
}

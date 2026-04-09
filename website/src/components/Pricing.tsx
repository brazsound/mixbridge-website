const tiers = [
  {
    name: 'Solo',
    devices: 1,
    deviceLabel: '1 Mac',
    description: 'For individual engineers who work from a single machine.',
    highlight: false,
  },
  {
    name: 'Pro',
    devices: 3,
    deviceLabel: 'Up to 3 Macs',
    description: 'For freelancers who move between studio, home, and laptop.',
    highlight: true,
  },
  {
    name: 'Team',
    devices: 10,
    deviceLabel: 'Up to 10 Macs',
    description: 'For commercial studios and post-production facilities.',
    highlight: false,
  },
];

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
            Pricing
          </h2>
          <p className="text-text-secondary max-w-md mx-auto leading-relaxed">
            One licence per account. Activate on up to your plan's device count. Switch Macs anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
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
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full"
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                  }}
                >
                  Most popular
                </div>
              )}

              <h3 className="font-semibold text-lg mb-1">{tier.name}</h3>
              <p
                className="text-2xl font-semibold mb-1"
                style={{ color: 'var(--accent)' }}
              >
                {tier.deviceLabel}
              </p>
              <p className="text-text-muted text-sm leading-relaxed mt-2 flex-1">
                {tier.description}
              </p>

              <a
                href="#download"
                className="mt-6 w-full text-center py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={tier.highlight ? {
                  background: 'var(--accent)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                } : {
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(255,255,255,0.1)',
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
                Get started
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-text-muted text-sm mt-8">
          Deactivate and move your licence to a new Mac anytime. No extra charge.
        </p>
      </div>
    </section>
  );
}

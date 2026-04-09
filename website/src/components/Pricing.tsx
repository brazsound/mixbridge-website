const tiers = [
  {
    name: 'Solo',
    devices: 1,
    description: 'One Mac. Perfect for you.',
  },
  {
    name: 'Pro',
    devices: 3,
    description: 'Up to 3 Macs. Great for freelancers.',
  },
  {
    name: 'Team',
    devices: 10,
    description: 'Up to 10 Macs. Built for studios.',
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="px-6 py-20 md:py-28 bg-black/20">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-4">
          Simple pricing
        </h2>
        <p className="text-text-secondary text-center mb-16 max-w-xl mx-auto">
          Use Mix Bridge on your Macs. Switch devices anytime, no hassle.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="glass-card p-6 flex flex-col items-center text-center"
            >
              <h3 className="font-semibold text-xl mb-1">{tier.name}</h3>
              <p className="text-3xl font-semibold text-accent mb-2">
                {tier.devices} device{tier.devices > 1 ? 's' : ''}
              </p>
              <p className="text-text-muted text-sm">{tier.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

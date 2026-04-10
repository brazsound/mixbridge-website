interface Row {
  label: string;
  mixBridge: string | boolean;
  fastBounce: string | boolean;
  bounceFactory: string | boolean;
  soundflow: string | boolean;
}

const rows: Row[] = [
  { label: 'Pro Tools API (PTSL)', mixBridge: true, fastBounce: false, bounceFactory: false, soundflow: false },
  { label: 'Multi-session batch', mixBridge: true, fastBounce: 'Limited', bounceFactory: true, soundflow: false },
  { label: 'Session templates', mixBridge: true, fastBounce: true, bounceFactory: false, soundflow: false },
  { label: 'File naming control', mixBridge: 'Full', fastBounce: 'Basic', bounceFactory: 'Basic', soundflow: 'Basic' },
  { label: 'WAV / MP3 / AIFF', mixBridge: true, fastBounce: true, bounceFactory: true, soundflow: true },
  { label: 'Offline bounce', mixBridge: true, fastBounce: true, bounceFactory: true, soundflow: true },
  { label: 'No screen-scraping', mixBridge: true, fastBounce: false, bounceFactory: false, soundflow: false },
  { label: 'macOS native app', mixBridge: true, fastBounce: true, bounceFactory: true, soundflow: 'Script' },
  { label: 'Windows support', mixBridge: false, fastBounce: true, bounceFactory: false, soundflow: true },
  { label: 'Video tutorials', mixBridge: false, fastBounce: true, bounceFactory: false, soundflow: true },
  { label: 'Pricing (annual)', mixBridge: '$49 – $199', fastBounce: '$149', bounceFactory: 'Annual', soundflow: 'Subscription' },
];

const competitors = ['Mix Bridge', 'Fast Bounce', 'Bounce Factory', 'SoundFlow'] as const;

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Yes">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ) : (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(245,245,247,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="No">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  return <span className="text-xs text-text-secondary">{value}</span>;
}

export function Comparison() {
  return (
    <section id="compare" className="px-6 py-24 md:py-32" style={{ background: 'rgba(0,0,0,0.25)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">How Mix Bridge compares</h2>
          <p className="text-text-secondary max-w-lg mx-auto leading-relaxed">
            An honest look at what each tool brings to the table.
          </p>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="text-left text-text-muted font-medium py-3 pr-4 border-b border-white/10" />
                {competitors.map((name) => (
                  <th
                    key={name}
                    className={`text-center font-semibold py-3 px-3 border-b ${
                      name === 'Mix Bridge' ? 'text-accent border-accent/30' : 'text-text-secondary border-white/10'
                    }`}
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4 text-text-secondary whitespace-nowrap">{row.label}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex justify-center"><CellValue value={row.mixBridge} /></span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex justify-center"><CellValue value={row.fastBounce} /></span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex justify-center"><CellValue value={row.bounceFactory} /></span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex justify-center"><CellValue value={row.soundflow} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          Information based on publicly available documentation. Last reviewed April 2026.
        </p>
      </div>
    </section>
  );
}

/** MixBridge waveform-bridge mark. Colored via `color` (defaults to currentColor). */
export function BrandLogo({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size * (280 / 432)}
      viewBox="40 106 432 260"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g fill={color}>
        <rect x="53" y="292" width="26" height="64" rx="13" />
        <rect x="91" y="252" width="26" height="104" rx="13" />
        <rect x="129" y="204" width="26" height="152" rx="13" />
        <rect x="167" y="156" width="26" height="200" rx="13" />
        <rect x="205" y="116" width="26" height="240" rx="13" />
        <rect x="243" y="140" width="26" height="216" rx="13" />
        <rect x="281" y="116" width="26" height="240" rx="13" />
        <rect x="319" y="156" width="26" height="200" rx="13" />
        <rect x="357" y="204" width="26" height="152" rx="13" />
        <rect x="395" y="252" width="26" height="104" rx="13" />
        <rect x="433" y="292" width="26" height="64" rx="13" />
      </g>
    </svg>
  );
}

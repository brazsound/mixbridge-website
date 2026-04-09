export function Hero() {
  return (
    <header className="relative min-h-[85vh] flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(10, 132, 255, 0.08) 0%, transparent 50%), linear-gradient(180deg, #060609 0%, #0a0a0e 100%)',
        }}
      />
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-center mb-4">
        Mix Bridge
      </h1>
      <p className="text-lg md:text-xl text-text-secondary text-center max-w-xl mb-10">
        Stop wasting time on manual exports. Automate your stems and bounces in Pro Tools.
      </p>
      <a
        href="#download"
        className="btn-accent"
      >
        Download for Mac
      </a>
    </header>
  );
}

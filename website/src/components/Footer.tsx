export function Footer() {
  return (
    <footer className="px-6 py-12 border-t border-white/10">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-text-muted text-sm">
          © {new Date().getFullYear()} Braz Sound
        </p>
        <div className="flex gap-6 text-sm">
          <a
            href="https://github.com/matheusbraz/mix-bridge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://github.com/matheusbraz/mix-bridge/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text transition-colors"
          >
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}

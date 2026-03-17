/**
 * Renderer-side logging for support/troubleshooting.
 * All data is sanitized before sending to main process (no paths, project names, PII).
 */

export function logInfo(message: string, context?: Record<string, unknown>): void {
  window.appLog?.log('info', message, context).catch(() => {});
}

export function logWarn(message: string, context?: Record<string, unknown>): void {
  window.appLog?.log('warn', message, context).catch(() => {});
}

export function logError(err: unknown, context?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  window.appLog?.logError(message, stack, context).catch(() => {});
}

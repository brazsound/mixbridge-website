/**
 * Support log system — captures errors and events for troubleshooting.
 * PRIVACY: Never stores session paths, project names, file names, or PII.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app, dialog, BrowserWindow } from 'electron';

const MAX_ENTRIES = 500;

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  source: 'main' | 'renderer';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

/** Redact paths, file names, and project-identifying content. */
export function sanitize(str: string): string {
  if (typeof str !== 'string') return '[non-string]';
  return str
    .replace(/\/[\w.-]+\/[\w./-]+/g, '[path]')
    .replace(/[A-Z]:\\[\w.\\-]+/gi, '[path]')
    .replace(/\b[\w-]+\.ptx\b/gi, '[session]')
    .replace(/\b[\w-]+\.(wav|aif|mp3|m4a)\b/gi, '[file]')
    .replace(/\/Users\/[^/]+/g, '[user]')
    .replace(/\/home\/[^/]+/g, '[user]')
    .replace(/C:\\Users\\[^\\]+/gi, '[user]');
}

function sanitizeContext(ctx: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string') out[k] = sanitize(v);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = sanitizeContext(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

class SupportLogger {
  private entries: LogEntry[] = [];

  log(level: LogLevel, message: string, context?: Record<string, unknown>, source: 'main' | 'renderer' = 'main'): void {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      source,
      message: sanitize(message),
      context: sanitizeContext(context),
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
  }

  logError(err: unknown, context?: Record<string, unknown>, source: 'main' | 'renderer' = 'main'): void {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level: 'error',
      source,
      message: sanitize(message),
      stack: stack ? sanitize(stack) : undefined,
      context: sanitizeContext(context),
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getSystemInfo(): Record<string, string> {
    let appVersion = '0.0.0';
    try {
      const pkgPath = path.join(__dirname, '..', 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
      appVersion = pkg.version ?? appVersion;
    } catch {
      // ignore
    }
    return {
      appVersion,
      electronVersion: process.versions.electron ?? 'unknown',
      chromeVersion: process.versions.chrome ?? 'unknown',
      nodeVersion: process.versions.node ?? 'unknown',
      platform: process.platform,
      arch: process.arch,
    };
  }

  exportPayload(): { exportedAt: string; system: Record<string, string>; entries: LogEntry[] } {
    return {
      exportedAt: new Date().toISOString(),
      system: this.getSystemInfo(),
      entries: this.getEntries(),
    };
  };

  async exportToFile(win?: BrowserWindow | null): Promise<{ filePath?: string; content: string; error?: string }> {
    const payload = this.exportPayload();
    const content = JSON.stringify(payload, null, 2);

    try {
      const defaultPath = path.join(app.getPath('downloads'), `mix-bridge-support-log-${Date.now()}.json`);
      const opts = {
        title: 'Export support log',
        defaultPath,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, opts)
        : await dialog.showSaveDialog(opts);

      if (result.canceled || !result.filePath) {
        return { content, error: 'canceled' };
      }

      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { filePath: result.filePath, content };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return { content, error: err };
    }
  }
}

export const supportLogger = new SupportLogger();

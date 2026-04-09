/**
 * In-app update service using electron-updater.
 * Handles check-for-updates, skip logic, and event forwarding to renderer.
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { gt } from 'semver';
import { autoUpdater } from 'electron-updater';
import type { UpdateInfo, ProgressInfo } from 'electron-updater';

const SKIP_FILE = () => path.join(app.getPath('userData'), 'mix-bridge-update-skip.json');

interface SkipData {
  lastSkippedVersion: string;
}

function loadLastSkippedVersion(): string | null {
  try {
    const p = SKIP_FILE();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as SkipData;
    return data.lastSkippedVersion ?? null;
  } catch {
    return null;
  }
}

function saveLastSkippedVersion(version: string): void {
  try {
    const data: SkipData = { lastSkippedVersion: version };
    fs.writeFileSync(SKIP_FILE(), JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

export interface UpdaterEventPayloads {
  'updater:updateAvailable': { version: string; releaseNotes?: string | string[] };
  'updater:updateNotAvailable': { manual: boolean };
  'updater:updateDownloaded': { version: string };
  'updater:error': { message: string; manual: boolean };
  'updater:downloadProgress': { percent: number; transferred: number; total: number };
}

function sendToRenderer(
  win: BrowserWindow | null,
  channel: keyof UpdaterEventPayloads,
  payload: UpdaterEventPayloads[keyof UpdaterEventPayloads]
): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

let getMainWindow: () => BrowserWindow | null = () => null;

export function setUpdater(getWindow: () => BrowserWindow | null): void {
  getMainWindow = getWindow;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  if (!app.isPackaged) {
    (autoUpdater as { forceDevUpdateConfig?: boolean }).forceDevUpdateConfig = true;
  }

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const version = info.version;

    if (!pendingIsManual) {
      const lastSkipped = loadLastSkippedVersion();
      if (lastSkipped && !gt(version, lastSkipped)) {
        return;
      }
    }

    const releaseNotes = info.releaseNotes;
    const releaseNotesStr =
      typeof releaseNotes === 'string'
        ? releaseNotes
        : Array.isArray(releaseNotes)
          ? releaseNotes.map((n) => (typeof n === 'string' ? n : (n as { note?: string })?.note ?? '')).join('\n')
          : undefined;

    sendToRenderer(getMainWindow(), 'updater:updateAvailable', {
      version,
      releaseNotes: releaseNotesStr,
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendToRenderer(getMainWindow(), 'updater:updateNotAvailable', { manual: pendingIsManual });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendToRenderer(getMainWindow(), 'updater:updateDownloaded', { version: info.version });
  });

  autoUpdater.on('error', (err: Error) => {
    sendToRenderer(getMainWindow(), 'updater:error', {
      message: err.message,
      manual: pendingIsManual,
    });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    sendToRenderer(getMainWindow(), 'updater:downloadProgress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });
}

let pendingIsManual = false;

export function checkForUpdates(isManual: boolean): void {
  pendingIsManual = isManual;
  void autoUpdater.checkForUpdates();
}

export function skipUpdate(version: string): void {
  saveLastSkippedVersion(version);
}

export function startDownload(): void {
  void autoUpdater.downloadUpdate();
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true);
}

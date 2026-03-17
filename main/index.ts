import 'dotenv/config';
import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { PTSLClientWrapper } from './ptsl-client';
import type {
  RegisterConnectionBody,
  GetTrackListBody,
  GetTimelineSelectionBody,
  GetMemoryLocationsBody,
  SelectMemoryLocationBody,
  SetTrackSoloStateBody,
  SetTrackMuteStateBody,
  ExportMixBody,
  BounceTrackBody,
  OpenSessionBody,
  CloseSessionBody,
  SaveSessionAsBody,
} from './ptsl-commands';
import { CommandId } from './ptsl-commands';
import { supportLogger } from './logger';
import {
  setUpdater,
  checkForUpdates,
  skipUpdate,
  startDownload,
  quitAndInstall,
} from './updater';

const ptsl = new PTSLClientWrapper();

function createWindow(): BrowserWindow {
  // Use Vite dev server when not packaged (dev/test); load built files when packaged.
  const isDev = !app.isPackaged;
  const bounds = loadWindowBounds();
  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'Mix Bridge',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // built from main/preload.ts
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    show: false,
  });

  if (isDev) {
    void win.loadURL('http://localhost:5173');
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    supportLogger.logError(new Error(`did-fail-load: ${code} ${desc}`), { url: '[url]' });
    notifyReportableError({ action: 'did-fail-load' });
  });

  win.once('ready-to-show', () => win.show());

  // Persist window bounds on resize/move (debounced)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const scheduleSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveTimeout = null;
      saveWindowBounds(win);
    }, 250);
  };
  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('close', () => saveWindowBounds(win));

  return win;
}

let mainWindow: BrowserWindow | null = null;

/** Notify renderer to show "Send error report?" prompt. Skip for appLog:submitReport to avoid loops. */
function notifyReportableError(context?: Record<string, unknown>): void {
  const action = context?.action;
  if (action === 'appLog:submitReport') return;
  mainWindow?.webContents?.send('appLog:errorOccurred');
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  setUpdater(() => mainWindow);

  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Mix Bridge',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => checkForUpdates(true),
        },
        ...(isMac ? [{ role: 'close' as const }] : [{ type: 'separator' as const }, { role: 'quit' as const }]),
      ],
    },
    { role: 'editMenu' as const },
    { role: 'viewMenu' as const },
    { role: 'windowMenu' as const },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  app.on('window-all-closed', () => {
    ptsl.disconnect();
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

// --- IPC: Updater ---
ipcMain.handle('updater:checkForUpdates', (_, isManual: boolean) => {
  checkForUpdates(isManual);
});
ipcMain.handle('updater:startDownload', () => {
  startDownload();
});
ipcMain.handle('updater:skipUpdate', (_, version: string) => {
  skipUpdate(version);
});
ipcMain.handle('updater:quitAndInstall', () => {
  quitAndInstall();
});

// --- IPC: PTSL connection ---
ipcMain.handle('ptsl:connect', async (_, company: string, appName: string) => {
  try {
    ptsl.disconnect();
    await ptsl.connect();
    const out = await ptsl.registerConnection(company || 'Braz Sound', appName || 'Mix Bridge');
    return out;
  } catch (e) {
    supportLogger.logError(e, { action: 'ptsl:connect' });
    notifyReportableError({ action: 'ptsl:connect' });
    return { error: (e as Error).message };
  }
});

ipcMain.handle('ptsl:disconnect', () => {
  ptsl.disconnect();
  return { ok: true };
});

ipcMain.handle('ptsl:sessionId', () => ptsl.getSessionId());

ipcMain.handle('ptsl:getSessionName', async () => {
  const res = await ptsl.sendRequest({ command: CommandId.GetSessionName, body: {} });
  if (!res.success) return { error: res.errorJson };
  try {
    const body = res.bodyJson ? JSON.parse(res.bodyJson) : null;
    return { data: body as { session_name?: string } | null };
  } catch {
    return { error: 'Invalid GetSessionName response' };
  }
});

// --- IPC: Send raw command (for flexibility) ---
ipcMain.handle('ptsl:send', async (_, command: number, body: Record<string, unknown> | null) => {
  const result = await ptsl.sendRequest({ command, body });
  return {
    success: result.success,
    status: result.status,
    body: result.bodyJson ? JSON.parse(result.bodyJson) : null,
    error: result.errorJson ? (() => { try { return JSON.parse(result.errorJson); } catch { return result.errorJson; } })() : null,
  };
});

// --- IPC: High-level commands ---
ipcMain.handle('ptsl:getTrackList', async (_, body?: GetTrackListBody) => {
  const res = await ptsl.sendRequest({ command: CommandId.GetTrackList, body: (body ?? {}) as Record<string, unknown> });
  if (!res.success) return { error: res.errorJson };
  try {
    return { data: res.bodyJson ? JSON.parse(res.bodyJson) : null };
  } catch {
    return { error: 'Invalid response' };
  }
});

ipcMain.handle('ptsl:getTimelineSelection', async (_, body?: GetTimelineSelectionBody) => {
  // PTSL expects TimelineLocationType as a string value, e.g. \"TLType_Samples\"
  const requestBody: Record<string, unknown> = {
    location_type: 'TLType_Samples',
    ...(body ?? {}),
  };
  const res = await ptsl.sendRequest({
    command: CommandId.GetTimelineSelection,
    body: requestBody,
  });
  if (!res.success) return { error: res.errorJson };
  try {
    return { data: res.bodyJson ? JSON.parse(res.bodyJson) : null };
  } catch {
    return { error: 'Invalid response' };
  }
});

ipcMain.handle('ptsl:getMemoryLocations', async (_, body?: GetMemoryLocationsBody) => {
  const res = await ptsl.sendRequest({ command: CommandId.GetMemoryLocations, body: (body ?? {}) as Record<string, unknown> });
  if (!res.success) return { error: res.errorJson };
  try {
    return { data: res.bodyJson ? JSON.parse(res.bodyJson) : null };
  } catch {
    return { error: 'Invalid response' };
  }
});

ipcMain.handle('ptsl:selectMemoryLocation', async (_, body: SelectMemoryLocationBody) => {
  const res = await ptsl.sendRequest({ command: CommandId.SelectMemoryLocation, body: body as unknown as Record<string, unknown> });
  return { success: res.success, error: res.errorJson };
});

ipcMain.handle('ptsl:setTrackSoloState', async (_, body: SetTrackSoloStateBody) => {
  const res = await ptsl.sendRequest({ command: CommandId.SetTrackSoloState, body: body as unknown as Record<string, unknown> });
  return { success: res.success, error: res.errorJson };
});

ipcMain.handle('ptsl:setTrackMuteState', async (_, body: SetTrackMuteStateBody) => {
  const res = await ptsl.sendRequest({ command: CommandId.SetTrackMuteState, body: body as unknown as Record<string, unknown> });
  return { success: res.success, error: res.errorJson };
});

ipcMain.handle('ptsl:exportMix', async (_, body: ExportMixBody) => {
  const res = await ptsl.sendRequest({ command: CommandId.ExportMix, body: body as unknown as Record<string, unknown> });
  return { success: res.success, error: res.errorJson, body: res.bodyJson ? JSON.parse(res.bodyJson) : null };
});

ipcMain.handle('ptsl:bounceTrack', async (_, body: BounceTrackBody) => {
  const res = await ptsl.sendRequest({ command: CommandId.BounceTrack, body: body as unknown as Record<string, unknown> });
  return { success: res.success, error: res.errorJson, body: res.bodyJson ? JSON.parse(res.bodyJson) : null };
});

ipcMain.handle('ptsl:getSessionSampleRate', async () => {
  const res = await ptsl.sendRequest({ command: CommandId.GetSessionSampleRate, body: {} });
  if (!res.success) return { error: res.errorJson };
  try {
    return { data: res.bodyJson ? JSON.parse(res.bodyJson) : null };
  } catch {
    return { error: 'Invalid GetSessionSampleRate response' };
  }
});

ipcMain.handle('ptsl:getSessionBitDepth', async () => {
  const res = await ptsl.sendRequest({ command: CommandId.GetSessionBitDepth, body: {} });
  if (!res.success) return { error: res.errorJson };
  try {
    return { data: res.bodyJson ? JSON.parse(res.bodyJson) : null };
  } catch {
    return { error: 'Invalid GetSessionBitDepth response' };
  }
});

ipcMain.handle('ptsl:getSessionPath', async () => {
  const res = await ptsl.sendRequest({ command: CommandId.GetSessionPath, body: {} });
  if (!res.success) return { error: res.errorJson };
  try {
    const body = res.bodyJson ? JSON.parse(res.bodyJson) : null;
    // Response: { session_path: { path: "/path/to/Session.ptx", ... } }
    const sessionFilePath: string = body?.session_path?.path ?? '';
    return { data: { sessionFilePath } };
  } catch {
    return { error: 'Invalid GetSessionPath response' };
  }
});

// Check which of the given file names already exist in the specified folder.
// Returns an array of the names that already exist (regardless of extension).
ipcMain.handle('ptsl:checkFilesExist', async (_event, folderPath: string, fileNames: string[]) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) return { existing: [] };
    const entries = fs.readdirSync(folderPath).map((e) => e.toLowerCase());
    const existing = fileNames.filter((name) => {
      const lower = name.toLowerCase();
      // Match stem against any file in the folder that starts with this name
      // (handles Pro Tools appending extensions like .wav, .aif, .aiff)
      return entries.some((e) => e === lower || e.startsWith(lower + '.'));
    });
    return { existing };
  } catch {
    return { existing: [] };
  }
});

ipcMain.handle('ptsl:getExportMixSourceList', async (_, sourceType: string) => {
  const res = await ptsl.sendRequest({
    command: CommandId.GetExportMixSourceList,
    body: { type: sourceType },
  });
  if (!res.success) return { error: res.errorJson };
  try {
    return { data: res.bodyJson ? JSON.parse(res.bodyJson) : null };
  } catch {
    return { error: 'Invalid GetExportMixSourceList response' };
  }
});

/** Convert a timeline location to samples (Pro Tools 2025.06+). Use when range is in Bars/Beats or Timecode. */
ipcMain.handle('ptsl:getTimeAsType', async (_event, location: { location: string; time_type: string }, desiredType: string) => {
  const res = await ptsl.sendRequest({
    command: CommandId.GetTimeAsType,
    body: { location, time_type: desiredType },
  });
  if (!res.success) return { error: res.errorJson };
  try {
    const body = res.bodyJson ? JSON.parse(res.bodyJson) : null;
    const converted = body?.converted_location;
    return { data: converted ?? null };
  } catch {
    return { error: 'Invalid GetTimeAsType response' };
  }
});

// ── Session open / close ──────────────────────────────────────────────────────

ipcMain.handle('ptsl:openSession', async (_event, sessionPath: string, options?: { suppressDialogs?: boolean }) => {
  const suppressDialogs = options?.suppressDialogs ?? true; // default true for backwards compatibility
  const body: OpenSessionBody = {
    session_path: sessionPath,
    ...(suppressDialogs ? { behavior_options: {} } : {}), // suppresses dialogs when true (Pro Tools 2025.06+)
  };
  const res = await ptsl.sendRequest({
    command: CommandId.OpenSession,
    body: body as unknown as Record<string, unknown>,
  });
  return { success: res.success, error: res.errorJson ?? null };
});

ipcMain.handle('ptsl:closeSession', async (_, saveOnClose: boolean) => {
  const body: CloseSessionBody = { save_on_close: saveOnClose };
  const res = await ptsl.sendRequest({
    command: CommandId.CloseSession,
    body: body as unknown as Record<string, unknown>,
  });
  return { success: res.success, error: res.errorJson ?? null };
});

ipcMain.handle('ptsl:saveSessionAs', async (_event, sessionName: string, sessionLocation: string) => {
  const body: SaveSessionAsBody = { session_name: sessionName, session_location: sessionLocation };
  const res = await ptsl.sendRequest({
    command: CommandId.SaveSessionAs,
    body: body as unknown as Record<string, unknown>,
  });
  return { success: res.success, error: res.errorJson ?? null };
});

ipcMain.handle('ptsl:openSessionDialog', async () => {
  const win = BrowserWindow.getAllWindows()[0] ?? null;
  const result = await dialog.showOpenDialog(win ?? undefined, {
    title: 'Open Pro Tools Session',
    filters: [{ name: 'Pro Tools Session', extensions: ['ptx'] }],
    properties: ['openFile'],
  });
  return { canceled: result.canceled, filePath: result.filePaths[0] ?? null };
});

ipcMain.handle('sessionBatch:pickSessions', async () => {
  const win = BrowserWindow.getAllWindows()[0] ?? null;
  const result = await dialog.showOpenDialog(win ?? undefined, {
    title: 'Add Pro Tools Sessions',
    filters: [{ name: 'Pro Tools Session', extensions: ['ptx'] }],
    properties: ['openFile', 'multiSelections'],
  });
  return { canceled: result.canceled, filePaths: result.filePaths };
});

ipcMain.handle('app:pickFolder', async (_event, defaultPath?: string) => {
  const win = BrowserWindow.getAllWindows()[0] ?? null;
  const result = await dialog.showOpenDialog(win ?? undefined, {
    title: 'Choose Bounce Folder',
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory'],
  });
  return { canceled: result.canceled, folderPath: result.filePaths[0] ?? null };
});

ipcMain.handle('app:showItemInFolder', async (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath.trim()) return;
  try {
    shell.showItemInFolder(path.resolve(filePath));
  } catch (e) {
    supportLogger.logError(e, { action: 'showItemInFolder' });
    notifyReportableError({ action: 'showItemInFolder' });
  }
});

// ── Support Log (for troubleshooting) ─────────────────────────────────────────

ipcMain.handle('appLog:log', (_event, level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) => {
  supportLogger.log(level, message, context, 'renderer');
});

ipcMain.handle('appLog:logError', (_event, message: string, stack?: string, context?: Record<string, unknown>) => {
  const err = new Error(message);
  if (stack) err.stack = stack;
  supportLogger.logError(err, context, 'renderer');
  notifyReportableError(context);
});

ipcMain.handle('appLog:export', async () => {
  return supportLogger.exportToFile(mainWindow);
});

ipcMain.handle('appLog:submitReport', async (_event, description: string) => {
  const apiUrl = (process.env.LICENSE_API_URL ?? '').replace(/\/$/, '');
  if (!apiUrl) {
    return { ok: false, error: 'Bug report server not configured. Use "Export support log" and email it to support.' };
  }
  try {
    const payload = supportLogger.exportPayload();
    const res = await fetch(`${apiUrl}/api/bug-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: typeof description === 'string' ? description.trim().slice(0, 2000) : '',
        log: payload,
      }),
    });
    const raw = await res.text();
    let data: { ok?: boolean; error?: string };
    try {
      data = JSON.parse(raw) as { ok?: boolean; error?: string };
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Server returned invalid response.'
          : `Bug report API not available (${res.status}). Use "Export support log" and email it to support.`,
      };
    }
    if (!res.ok) {
      return { ok: false, error: data.error ?? `Server error (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    supportLogger.logError(e, { action: 'appLog:submitReport' });
    return { ok: false, error: (e as Error).message };
  }
});

// ── Window Bounds ──────────────────────────────────────────────────────────────

const WINDOW_BOUNDS_FILE = () => path.join(app.getPath('userData'), 'mix-bridge-window-bounds.json');

const DEFAULT_WIDTH = 1550;
const DEFAULT_HEIGHT = 820;
const MIN_WIDTH = 1040;
const MIN_HEIGHT = 660;

interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

function loadWindowBounds(): WindowBounds {
  try {
    const p = WINDOW_BOUNDS_FILE();
    if (!fs.existsSync(p)) return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as { x?: number; y?: number; width?: number; height?: number };
    const width = typeof data.width === 'number' ? Math.max(MIN_WIDTH, data.width) : DEFAULT_WIDTH;
    const height = typeof data.height === 'number' ? Math.max(MIN_HEIGHT, data.height) : DEFAULT_HEIGHT;
    const bounds: WindowBounds = { width, height };
    if (typeof data.x === 'number' && typeof data.y === 'number') {
      bounds.x = data.x;
      bounds.y = data.y;
    }
    return bounds;
  } catch {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
}

function saveWindowBounds(win: BrowserWindow): void {
  try {
    const bounds = win.getBounds();
    const data = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    fs.writeFileSync(WINDOW_BOUNDS_FILE(), JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    supportLogger.logError(e, { action: 'saveWindowBounds' });
  }
}

// ── Session Batch ─────────────────────────────────────────────────────────────

const SESSION_BATCH_FILE = () => path.join(app.getPath('userData'), 'stem-bounce-session-batch.json');

ipcMain.handle('sessionBatch:load', () => {
  try {
    const p = SESSION_BATCH_FILE();
    if (!fs.existsSync(p)) return { entries: [] };
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as { entries: unknown[] };
    return { entries: data.entries ?? [] };
  } catch {
    return { entries: [] };
  }
});

ipcMain.handle('sessionBatch:save', (_event, entries: unknown[]) => {
  try {
    fs.writeFileSync(SESSION_BATCH_FILE(), JSON.stringify({ version: 1, entries }, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    supportLogger.logError(e, { action: 'sessionBatch:save' });
    notifyReportableError({ action: 'sessionBatch:save' });
    return { error: (e as Error).message };
  }
});

// ── App State (selected session, layout) ─────────────────────────────────────

const APP_STATE_FILE = () => path.join(app.getPath('userData'), 'stem-bounce-app-state.json');

interface AppStateData {
  version: number;
  selectedSessionId: string | null;
  sidebarWidth: number;
  rightWidth: number;
}

ipcMain.handle('appState:load', () => {
  try {
    const p = APP_STATE_FILE();
    if (!fs.existsSync(p)) return { selectedSessionId: null, sidebarWidth: 176, rightWidth: 400 };
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as Partial<AppStateData>;
    return {
      selectedSessionId: data.selectedSessionId ?? null,
      sidebarWidth: typeof data.sidebarWidth === 'number' ? Math.max(140, Math.min(300, data.sidebarWidth)) : 176,
      rightWidth: typeof data.rightWidth === 'number' ? Math.max(280, Math.min(620, data.rightWidth)) : 400,
    };
  } catch {
    return { selectedSessionId: null, sidebarWidth: 176, rightWidth: 400 };
  }
});

ipcMain.handle('appState:save', (_event, state: { selectedSessionId: string | null; sidebarWidth: number; rightWidth: number }) => {
  try {
    const data: AppStateData = {
      version: 1,
      selectedSessionId: state.selectedSessionId ?? null,
      sidebarWidth: state.sidebarWidth,
      rightWidth: state.rightWidth,
    };
    fs.writeFileSync(APP_STATE_FILE(), JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    supportLogger.logError(e, { action: 'appState:save' });
    notifyReportableError({ action: 'appState:save' });
    return { error: (e as Error).message };
  }
});

// ── Session Scan Cache (per-session mix sources, tracks, memory locations) ────

const SESSION_SCAN_CACHE_FILE = () => path.join(app.getPath('userData'), 'stem-bounce-session-scan-cache.json');

ipcMain.handle('sessionScanCache:load', () => {
  try {
    const p = SESSION_SCAN_CACHE_FILE();
    if (!fs.existsSync(p)) return { cache: {} };
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as { cache?: Record<string, unknown> };
    return { cache: data.cache ?? {} };
  } catch (e) {
    supportLogger.logError(e, { action: 'sessionScanCache:load' });
    notifyReportableError({ action: 'sessionScanCache:load' });
    return { cache: {} };
  }
});

ipcMain.handle('sessionScanCache:save', (_event, cache: Record<string, unknown>) => {
  try {
    fs.writeFileSync(
      SESSION_SCAN_CACHE_FILE(),
      JSON.stringify({ version: 1, cache }, null, 2),
      'utf-8'
    );
    return { ok: true };
  } catch (e) {
    supportLogger.logError(e, { action: 'sessionScanCache:save' });
    notifyReportableError({ action: 'sessionScanCache:save' });
    return { error: (e as Error).message };
  }
});

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS_FILE = () => path.join(app.getPath('userData'), 'stem-bounce-presets.json');

interface PresetsFileData {
  version: number;
  lastActiveSlot: number | null;
  slots: (unknown | null)[];
}

ipcMain.handle('presets:load', () => {
  try {
    const p = PRESETS_FILE();
    if (!fs.existsSync(p)) return { slots: [null, null, null, null, null], lastActiveSlot: null };
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as PresetsFileData;
    return {
      slots: data.slots ?? [null, null, null, null, null],
      lastActiveSlot: data.lastActiveSlot ?? null,
    };
  } catch (e) {
    supportLogger.logError(e, { action: 'presets:load' });
    notifyReportableError({ action: 'presets:load' });
    return { slots: [null, null, null, null, null], lastActiveSlot: null };
  }
});

ipcMain.handle('presets:save', (_event, slots: unknown[], lastActiveSlot: number | null) => {
  try {
    const data: PresetsFileData = { version: 1, lastActiveSlot, slots };
    fs.writeFileSync(PRESETS_FILE(), JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    supportLogger.logError(e, { action: 'presets:save' });
    notifyReportableError({ action: 'presets:save' });
    return { error: (e as Error).message };
  }
});

ipcMain.handle('presets:export', async (_event, slots: unknown[]) => {
  const win = BrowserWindow.getAllWindows()[0] ?? null;
  const result = await dialog.showSaveDialog(win ?? undefined, {
    title: 'Export Mix Bridge Presets',
    defaultPath: 'mix-bridge-presets.json',
    filters: [{ name: 'Preset File', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  try {
    fs.writeFileSync(result.filePath, JSON.stringify({ version: 1, lastActiveSlot: null, slots }, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    supportLogger.logError(e, { action: 'presets:export' });
    notifyReportableError({ action: 'presets:export' });
    return { error: (e as Error).message };
  }
});

ipcMain.handle('presets:import', async () => {
  const win = BrowserWindow.getAllWindows()[0] ?? null;
  const result = await dialog.showOpenDialog(win ?? undefined, {
    title: 'Import Mix Bridge Presets',
    filters: [{ name: 'Preset File', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const data = JSON.parse(raw) as PresetsFileData;
    return { slots: data.slots ?? [null, null, null, null, null] };
  } catch (e) {
    supportLogger.logError(e, { action: 'presets:import' });
    notifyReportableError({ action: 'presets:import' });
    return { error: (e as Error).message };
  }
});

// ── License (Paddle subscription + free access allowlist) ─────────────────────

const LICENSE_FILE = () => path.join(app.getPath('userData'), 'mix-bridge-license.json');
const LICENSE_API_URL = process.env.LICENSE_API_URL ?? '';
const CACHE_VALID_MS = 60 * 60 * 1000; // 1 hour
const OFFLINE_GRACE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days — max time offline before re-validation required

interface LicenseState {
  subscriptionId: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'free' | 'expired' | null;
  tier: 'solo' | 'pro' | 'team' | null;
  deviceId: string | null;
  email: string | null;
  userName: string | null;
  lastValidatedAt: string | null;
  activationUsed: number | null;
  activationLimit: number | null;
}

function generateDeviceId(): string {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function loadLicenseState(): LicenseState {
  try {
    const p = LICENSE_FILE();
    if (!fs.existsSync(p)) {
      const deviceId = generateDeviceId();
      return { subscriptionId: null, status: null, tier: null, deviceId, email: null, userName: null, lastValidatedAt: null, activationUsed: null, activationLimit: null };
    }
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as Partial<LicenseState>;
    const deviceId = data.deviceId ?? generateDeviceId();
    return {
      subscriptionId: data.subscriptionId ?? null,
      status: data.status ?? null,
      tier: data.tier ?? null,
      deviceId,
      email: data.email ?? null,
      userName: data.userName ?? null,
      lastValidatedAt: data.lastValidatedAt ?? null,
      activationUsed: typeof data.activationUsed === 'number' ? data.activationUsed : null,
      activationLimit: typeof data.activationLimit === 'number' ? data.activationLimit : null,
    };
  } catch {
    const deviceId = generateDeviceId();
    return { subscriptionId: null, status: null, tier: null, deviceId, email: null, userName: null, lastValidatedAt: null, activationUsed: null, activationLimit: null };
  }
}

function saveLicenseState(state: LicenseState): void {
  try {
    fs.writeFileSync(LICENSE_FILE(), JSON.stringify(state, null, 2), 'utf-8');
  } catch (_) {}
}

function isLicensed(status: string | null): boolean {
  return status === 'trialing' || status === 'active' || status === 'past_due' || status === 'free';
}

ipcMain.handle('license:getState', () => {
  const state = loadLicenseState();
  return {
    subscriptionId: state.subscriptionId,
    status: state.status,
    tier: state.tier,
    deviceId: state.deviceId,
    userName: state.userName,
    hasAccess: isLicensed(state.status),
  };
});

ipcMain.handle('license:setUserName', async (_, name: string) => {
  const state = loadLicenseState();
  const trimmed = typeof name === 'string' ? name.trim() : '';
  saveLicenseState({ ...state, userName: trimmed || null });
  if (LICENSE_API_URL && (state.email || state.subscriptionId) && state.deviceId) {
    try {
      const body = state.status === 'free' && state.email
        ? { email: state.email, device_id: state.deviceId, display_name: trimmed || null }
        : { subscription_id: state.subscriptionId, device_id: state.deviceId, display_name: trimmed || null };
      const res = await fetch(`${LICENSE_API_URL.replace(/\/$/, '')}/api/set-display-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        let errMsg = 'Failed to save name to server';
        try {
          const data = text ? (JSON.parse(text) as { error?: string }) : {};
          errMsg = data.error ?? errMsg;
        } catch {
          errMsg = text || errMsg;
        }
        return { ok: false, error: errMsg };
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
  return { ok: true };
});

ipcMain.handle('license:getDeviceId', () => {
  const state = loadLicenseState();
  return {
    deviceId: state.deviceId ?? generateDeviceId(),
  };
});

ipcMain.handle('license:validate', async (_, force?: boolean) => {
  const state = loadLicenseState();

  // No subscription and no email (unlicensed)
  if (!state.subscriptionId && !state.email) {
    return { hasAccess: false, status: null, userName: state.userName, activationUsed: null, activationLimit: null };
  }

  // Free access (NFR): call validate with email to get activation info
  if (state.status === 'free' && state.email) {
    if (!LICENSE_API_URL) {
      return { hasAccess: true, status: 'free', userName: state.userName, activationUsed: state.activationUsed, activationLimit: 3 };
    }
    const cacheOk = !force && state.lastValidatedAt && (Date.now() - new Date(state.lastValidatedAt).getTime() < CACHE_VALID_MS);
    if (cacheOk && state.activationUsed != null && state.activationLimit != null) {
      return { hasAccess: true, status: 'free', userName: state.userName, activationUsed: state.activationUsed, activationLimit: state.activationLimit };
    }
    try {
      const res = await fetch(`${LICENSE_API_URL.replace(/\/$/, '')}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.email, device_id: state.deviceId ?? undefined }),
      });
      const text = await res.text();
      let data: { valid?: boolean; status?: string; activation_used?: number; activation_limit?: number; display_name?: string | null; default_display_name?: string | null };
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        // Non-JSON response (e.g. HTML error page): preserve access, don't log out
        return { hasAccess: true, status: 'free', userName: state.userName, activationUsed: state.activationUsed, activationLimit: state.activationLimit ?? 3 };
      }
      // Only treat as invalid when API explicitly returns valid: false (email not in allowlist)
      // On 5xx/4xx or malformed response, preserve access
      if (!res.ok) {
        return { hasAccess: true, status: 'free', userName: state.userName, activationUsed: state.activationUsed, activationLimit: state.activationLimit ?? 3 };
      }
      const hasAccess = data.valid !== false;
      const activationUsed = typeof data.activation_used === 'number' ? data.activation_used : state.activationUsed;
      const activationLimit = typeof data.activation_limit === 'number' && data.activation_limit > 0 ? data.activation_limit : (state.activationLimit ?? 3);
      const userName = data.display_name ?? data.default_display_name ?? state.userName;

      if (!hasAccess) {
        saveLicenseState({
          subscriptionId: null,
          status: null,
          tier: null,
          deviceId: state.deviceId,
          email: null,
          userName: null,
          lastValidatedAt: null,
          activationUsed: null,
          activationLimit: null,
        });
      } else {
        saveLicenseState({
          ...state,
          lastValidatedAt: new Date().toISOString(),
          activationUsed,
          activationLimit,
          userName: userName || null,
        });
      }
      return { hasAccess, status: 'free', userName, activationUsed, activationLimit };
    } catch (e) {
      // Offline: allow if last validated within 5 days
      const elapsed = state.lastValidatedAt ? Date.now() - new Date(state.lastValidatedAt).getTime() : Infinity;
      const withinGrace = elapsed < OFFLINE_GRACE_MS;
      return {
        hasAccess: withinGrace,
        status: 'free',
        userName: state.userName,
        activationUsed: state.activationUsed,
        activationLimit: state.activationLimit ?? 3,
      };
    }
  }

  // No subscription (unlicensed, not free)
  if (!state.subscriptionId) {
    return { hasAccess: false, status: null, userName: state.userName, activationUsed: null, activationLimit: null };
  }

  // Check cache for paid subscriptions (skip when force refresh)
  if (!force && state.lastValidatedAt) {
    const elapsed = Date.now() - new Date(state.lastValidatedAt).getTime();
    if (elapsed < CACHE_VALID_MS && isLicensed(state.status)) {
      return { hasAccess: true, status: state.status, userName: state.userName, activationUsed: state.activationUsed, activationLimit: state.activationLimit };
    }
  }

  // Validate with backend (paid subscription)
  if (!LICENSE_API_URL) {
    return { hasAccess: isLicensed(state.status), status: state.status, userName: state.userName, activationUsed: null, activationLimit: null };
  }

  try {
    const res = await fetch(`${LICENSE_API_URL.replace(/\/$/, '')}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: state.subscriptionId, device_id: state.deviceId ?? undefined }),
    });
    const data = (await res.json()) as { valid?: boolean; status?: string; tier?: string; activation_used?: number; activation_limit?: number; display_name?: string | null; default_display_name?: string | null };
    const valid = !!data.valid;
    const status = (data.status as LicenseState['status']) ?? null;
    const tier = data.tier ?? state.tier;
    const activationUsed = typeof data.activation_used === 'number' ? data.activation_used : null;
    const activationLimit = typeof data.activation_limit === 'number' ? data.activation_limit : null;
    const userName = data.display_name ?? data.default_display_name ?? state.userName;

    if (!valid) {
      saveLicenseState({
        subscriptionId: null,
        status: null,
        tier: null,
        deviceId: state.deviceId,
        email: null,
        userName: null,
        lastValidatedAt: null,
        activationUsed: null,
        activationLimit: null,
      });
    } else {
      saveLicenseState({
        ...state,
        status,
        tier: tier as LicenseState['tier'],
        lastValidatedAt: new Date().toISOString(),
        activationUsed,
        activationLimit,
        userName: userName || null,
      });
    }

    return { hasAccess: valid, status, tier, userName, activationUsed, activationLimit };
  } catch (e) {
    // Offline: allow if we had valid status and last validated within 5 days
    const elapsed = state.lastValidatedAt ? Date.now() - new Date(state.lastValidatedAt).getTime() : Infinity;
    const withinGrace = elapsed < OFFLINE_GRACE_MS;
    const hasAccess = withinGrace && isLicensed(state.status);
    return { hasAccess, status: state.status, userName: state.userName, activationUsed: state.activationUsed, activationLimit: state.activationLimit };
  }
});

ipcMain.handle('license:activateWithEmail', async (_, email: string) => {
  if (!LICENSE_API_URL) {
    return { error: 'License server not configured' };
  }
  const trimmed = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!trimmed) return { error: 'Email is required' };

  const state = loadLicenseState();
  const deviceId = state.deviceId ?? generateDeviceId();
  if (!state.deviceId) {
    saveLicenseState({ ...state, deviceId });
  }

  try {
    const res = await fetch(`${LICENSE_API_URL.replace(/\/$/, '')}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed, device_id: deviceId }),
    });
    const text = await res.text();
    let data: {
      status?: string;
      access?: boolean;
      subscription_id?: string;
      tier?: string;
      error?: string;
    };
    try {
      data = text ? (JSON.parse(text) as typeof data) : {};
    } catch {
      return {
        error: `Backend returned invalid response. Check that LICENSE_API_URL is your deployed API URL (e.g. https://mix-bridge-license-xxxxx.vercel.app), not the Vercel dashboard URL.`,
      };
    }

    if (res.ok) {
      if (data.status === 'free' && data.access) {
        const activationUsed = typeof (data as { activation_used?: number }).activation_used === 'number'
          ? (data as { activation_used: number }).activation_used
          : 1;
        const activationLimit = typeof (data as { activation_limit?: number }).activation_limit === 'number'
          ? (data as { activation_limit: number }).activation_limit
          : 3;
        saveLicenseState({
          subscriptionId: null,
          status: 'free',
          tier: null,
          deviceId,
          email: trimmed,
          userName: state.userName,
          lastValidatedAt: new Date().toISOString(),
          activationUsed,
          activationLimit,
        });
        return { ok: true, status: 'free' };
      }
      if (data.subscription_id) {
        const paidActivationUsed = typeof (data as { activation_used?: number }).activation_used === 'number'
          ? (data as { activation_used: number }).activation_used
          : 1;
        const paidActivationLimit = typeof (data as { activation_limit?: number }).activation_limit === 'number'
          ? (data as { activation_limit: number }).activation_limit
          : { solo: 1, pro: 3, team: 10 }[(data.tier as LicenseState['tier']) ?? 'solo'];
        saveLicenseState({
          subscriptionId: data.subscription_id,
          status: (data.status as LicenseState['status']) ?? 'active',
          tier: (data.tier as LicenseState['tier']) ?? 'solo',
          deviceId,
          email: trimmed,
          userName: state.userName,
          lastValidatedAt: new Date().toISOString(),
          activationUsed: paidActivationUsed,
          activationLimit: paidActivationLimit,
        });
        return { ok: true, status: data.status ?? 'active', tier: data.tier ?? 'solo' };
      }
    }

    return { error: data.error ?? 'Activation failed' };
  } catch (e) {
    return { error: (e as Error).message };
  }
});

ipcMain.handle('license:deactivate', async () => {
  if (!LICENSE_API_URL) return { error: 'License server not configured' };
  const state = loadLicenseState();
  if (!state.deviceId) return { error: 'No device ID' };
  if (!state.email) return { error: 'Email not stored. Use Sign out instead.' };
  const canDeactivate = state.subscriptionId || state.status === 'free';
  if (!canDeactivate) return { error: 'Nothing to deactivate' };

  try {
    const body = state.status === 'free' && state.email
      ? { email: state.email, device_id: state.deviceId }
      : { subscription_id: state.subscriptionId, device_id: state.deviceId };
    const res = await fetch(`${LICENSE_API_URL.replace(/\/$/, '')}/api/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) {
      saveLicenseState({
        subscriptionId: null,
        status: null,
        tier: null,
        deviceId: state.deviceId,
        email: null,
        userName: null,
        lastValidatedAt: null,
        activationUsed: null,
        activationLimit: null,
      });
      return { ok: true };
    }
    return { error: data.error ?? 'Deactivation failed' };
  } catch (e) {
    return { error: (e as Error).message };
  }
});

ipcMain.handle('license:listActivations', async () => {
  if (!LICENSE_API_URL) return { error: 'License server not configured', activations: [] };
  const state = loadLicenseState();
  if (!state.deviceId || (!state.email && !state.subscriptionId)) {
    return { error: 'Not activated', activations: [] };
  }
  try {
    const body = state.status === 'free' && state.email
      ? { email: state.email, device_id: state.deviceId }
      : { subscription_id: state.subscriptionId, device_id: state.deviceId };
    const res = await fetch(`${LICENSE_API_URL.replace(/\/$/, '')}/api/list-activations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { activations?: Array<{ device_id: string; display_name: string | null; activated_at: string; is_current: boolean }>; error?: string };
    if (res.ok && data.activations) {
      return { activations: data.activations };
    }
    return { error: data.error ?? 'Failed to list activations', activations: [] };
  } catch (e) {
    return { error: (e as Error).message, activations: [] };
  }
});

ipcMain.handle('license:deactivateDevice', async (_, deviceIdToDeactivate: string) => {
  if (!LICENSE_API_URL) return { error: 'License server not configured' };
  const state = loadLicenseState();
  if (!state.deviceId) return { error: 'No device ID' };
  if (!state.email && !state.subscriptionId) return { error: 'Not activated' };
  const trimmed = typeof deviceIdToDeactivate === 'string' ? deviceIdToDeactivate.trim() : '';
  if (!trimmed) return { error: 'Device ID is required' };
  if (trimmed === state.deviceId) {
    return { error: 'Use Deactivate this device to deactivate the current machine' };
  }
  try {
    const body = state.status === 'free' && state.email
      ? { email: state.email, device_id: state.deviceId, device_id_to_deactivate: trimmed }
      : { subscription_id: state.subscriptionId, device_id: state.deviceId, device_id_to_deactivate: trimmed };
    const res = await fetch(`${LICENSE_API_URL.replace(/\/$/, '')}/api/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) return { ok: true };
    return { error: data.error ?? 'Deactivation failed' };
  } catch (e) {
    return { error: (e as Error).message };
  }
});

ipcMain.handle('license:openCheckout', async () => {
  // Placeholder: opens Paddle checkout. Will be implemented when Paddle product/price IDs are ready.
  return { error: 'Checkout not yet configured. Set up Paddle and add checkout URL.' };
});

ipcMain.handle('license:clear', () => {
  const state = loadLicenseState();
  saveLicenseState({
    subscriptionId: null,
    status: null,
    tier: null,
    deviceId: state.deviceId,
    email: null,
    userName: null,
    lastValidatedAt: null,
    activationUsed: null,
    activationLimit: null,
  });
  return { ok: true };
});

// Select audio files for import (opens native file dialog)
ipcMain.handle('ptsl:selectFilesToImport', async () => {
  const win = BrowserWindow.getAllWindows()[0] ?? null;
  const result = await dialog.showOpenDialog(win ?? undefined, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio', extensions: ['wav', 'aif', 'aiff', 'mp3', 'flac', 'm4a', 'ogg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return { canceled: result.canceled, filePaths: result.filePaths };
});

type ImportDestType = 'clip_list' | 'below_track' | 'into_folder';

// One entry per input file: all clip IDs (multichannel = multiple IDs)
interface ClipGroup {
  clipIds: string[];   // all clip_id_list entries for this file (L+R for stereo)
  channelCount: number; // 1 = mono, 2 = stereo, etc.
}

// ── Shared helper: import files into the clip list ────────────────────────────
async function importToClipList(
  filePaths: string[],
  sessionFolder: string
): Promise<{ clipGroups: ClipGroup[]; error?: string }> {
  const importRes = await ptsl.sendRequest({
    command: CommandId.ImportAudioToClipList,
    body: {
      file_list: filePaths,
      // Omit destination_path so Pro Tools uses session's Audio Files folder (not session root)
      audio_operations: 'AOperations_CopyAudio',
    } as Record<string, unknown>,
  });
  if (!importRes.success || !importRes.bodyJson) {
    return { clipGroups: [], error: importRes.errorJson ?? 'Failed to import audio to clip list' };
  }
  type DestFile = { clip_id_list?: string[] };
  type FileEntry = { original_input_path?: string; destination_file_list?: DestFile[] };
  type ImportBody = { failure_list?: Array<{ file_path?: string; failure_message?: string }>; file_list?: FileEntry[] };
  let importBody: ImportBody;
  try {
    importBody = JSON.parse(importRes.bodyJson) as ImportBody;
  } catch {
    return { clipGroups: [], error: 'Invalid ImportAudioToClipList response' };
  }
  if (importBody?.failure_list?.length) {
    const first = importBody.failure_list[0];
    return { clipGroups: [], error: `Import failed: ${first?.failure_message ?? first?.file_path ?? 'unknown'}` };
  }

  const clipGroups: ClipGroup[] = [];
  for (const f of importBody?.file_list ?? []) {
    // For a stereo interleaved file, destination_file_list has 1 entry and
    // clip_id_list has multiple entries (one per channel).
    // All clip IDs must be passed together in src_clips to SpotClipsByID.
    const allClipIds: string[] = [];
    for (const destFile of f.destination_file_list ?? []) {
      for (const id of destFile.clip_id_list ?? []) {
        allClipIds.push(id);
      }
    }
    if (allClipIds.length > 0) {
      clipGroups.push({ clipIds: allClipIds, channelCount: allClipIds.length });
    }
  }
  return { clipGroups };
}

// ── Shared helper: create a folder or anchor track (for "create new" import dest) ─
async function createTrackOrFolder(
  name: string,
  isFolder: boolean
): Promise<{ error?: string }> {
  const body: Record<string, unknown> = {
    number_of_tracks: 1,
    track_name: name,
    insertion_point_position: 'TIPoint_Last',
  };
  if (isFolder) {
    body.track_type = 'TT_BasicFolder';
  } else {
    body.track_type = 'TT_Audio';
    body.track_format = 'TFormat_Stereo';
    body.track_timebase = 'TTB_Samples';
  }
  const res = await ptsl.sendRequest({ command: CommandId.CreateNewTracks, body });
  if (!res.success) return { error: res.errorJson ?? 'Failed to create track/folder' };
  return {};
}

// ── Shared helper: create one audio track per ClipGroup ──────────────────────
// Track format is derived from channelCount so it always matches the clip.
async function createAudioTracks(
  clipGroups: ClipGroup[],
  filePaths: string[],
  insertionPoint: string,
  insertionTrackName?: string
): Promise<{ trackIds: string[]; error?: string }> {
  const trackIds: string[] = [];
  for (let i = 0; i < clipGroups.length; i++) {
    const group = clipGroups[i];
    const trackName = path.basename(filePaths[i] ?? 'Audio', path.extname(filePaths[i] ?? ''));
    // 1 clip ID = mono, 2+ = stereo (interleaved stereo returns 2 channel IDs)
    const trackFormat = group.channelCount >= 2 ? 'TFormat_Stereo' : 'TFormat_Mono';

    const body: Record<string, unknown> = {
      number_of_tracks: 1,
      track_type: 'TT_Audio',
      track_format: trackFormat,
      track_timebase: 'TTB_Samples',
      track_name: trackName,
      insertion_point_position: insertionPoint,
    };
    if (insertionTrackName) body.insertion_point_track_name = insertionTrackName;

    const res = await ptsl.sendRequest({ command: CommandId.CreateNewTracks, body });
    if (!res.success || !res.bodyJson) {
      return { trackIds: [], error: res.errorJson ?? `Failed to create track ${i + 1}` };
    }
    type CreateBody = { created_track_ids?: string[] };
    let createBody: CreateBody;
    try { createBody = JSON.parse(res.bodyJson) as CreateBody; }
    catch { return { trackIds: [], error: 'Invalid CreateNewTracks response' }; }
    const id = createBody?.created_track_ids?.[0];
    if (!id) return { trackIds: [], error: `No track ID returned for track ${i + 1}` };
    trackIds.push(id);
  }
  return { trackIds };
}

// ── Shared helper: spot each ClipGroup onto its track ────────────────────────
// All clip IDs in the group are passed together — required for multichannel.
async function spotClips(
  clipGroups: ClipGroup[],
  trackIds: string[],
  locationValue: string,
  locationTimeType: string = 'TLType_Samples'
): Promise<{ error?: string }> {
  for (let i = 0; i < Math.min(clipGroups.length, trackIds.length); i++) {
    const spotRes = await ptsl.sendRequest({
      command: CommandId.SpotClipsByID,
      body: {
        src_clips: clipGroups[i].clipIds,   // ALL channel IDs together
        dst_track_id: trackIds[i],
        dst_location_data: {
          location_type: 'SLType_Start',
          location: { time_type: locationTimeType, location: locationValue },
        },
      } as Record<string, unknown>,
    });
    if (!spotRes.success) {
      return { error: `Failed to spot clip ${i + 1}: ${spotRes.errorJson ?? 'unknown'}` };
    }
  }
  return {};
}

// ── IPC: Import audio back into the session ───────────────────────────────────
ipcMain.handle(
  'ptsl:importAudioBack',
  async (
    _,
    filePaths: string[],
    destination: {
      type: ImportDestType;
      trackOrFolderName?: string;
      placement?: 'current_selection' | 'top_of_session';
      locationSamples?: string;
      locationTimeType?: string;
    }
  ) => {
    if (!filePaths.length) return { error: 'No files selected' };

    // Get session path so we know where to copy audio files
    const sessionPathRes = await ptsl.sendRequest({ command: CommandId.GetSessionPath, body: {} });
    if (!sessionPathRes.success || !sessionPathRes.bodyJson) {
      return { error: sessionPathRes.errorJson ?? 'Could not get session path' };
    }
    let sessionFolder: string;
    try {
      const body = JSON.parse(sessionPathRes.bodyJson) as { session_path?: { path?: string } };
      sessionFolder = path.dirname(body?.session_path?.path ?? '');
    } catch {
      return { error: 'Invalid session path response' };
    }

    // ── Clip List: just import, don't place on any track ─────────────────────
    if (destination.type === 'clip_list') {
      const { clipGroups, error } = await importToClipList(filePaths, sessionFolder);
      if (error) return { error };
      return { success: true, trackCount: 0, clipCount: clipGroups.length };
    }

    // ── Below Track / Folder: import first (to know channel count), then create tracks + spot ──
    const { clipGroups, error: importErr } = await importToClipList(filePaths, sessionFolder);
    if (importErr) return { error: importErr };
    if (clipGroups.length < filePaths.length) {
      return { error: `Imported ${clipGroups.length} clip group(s) but expected ${filePaths.length}` };
    }

    // If createNew: create the folder or anchor track first
    const createNew = (destination as { createNew?: boolean }).createNew === true;
    if (createNew && destination.trackOrFolderName) {
      const isFolder = destination.type === 'into_folder';
      const createErr = await createTrackOrFolder(destination.trackOrFolderName, isFolder);
      if (createErr.error) return { error: createErr.error };
    }

    const insertionPoint = destination.type === 'below_track' ? 'TIPoint_After' : 'TIPoint_Last';
    const insertionName = destination.trackOrFolderName;

    const { trackIds, error: createErr } = await createAudioTracks(clipGroups, filePaths, insertionPoint, insertionName);
    if (createErr) return { error: createErr };
    if (trackIds.length < filePaths.length) {
      return { error: `Created ${trackIds.length} track(s) but needed ${filePaths.length}` };
    }

    // Use caller-supplied location and time type, or fall back to session start
    const locationValue = destination.locationSamples ?? '0';
    const locationTimeType = destination.locationTimeType ?? 'TLType_Samples';

    const spotErr = await spotClips(clipGroups, trackIds, locationValue, locationTimeType);
    if (spotErr.error) return { error: spotErr.error };

    return { success: true, trackCount: trackIds.length };
  }
);

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('app', {
  pickFolder: (defaultPath?: string) => ipcRenderer.invoke('app:pickFolder', defaultPath),
  ensureFolder: (folderPath: string) => ipcRenderer.invoke('app:ensureFolder', folderPath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('app:showItemInFolder', filePath),
  sendBounceCompleteNotification: (payload: { sessionName: string; phoneNumber: string }) =>
    ipcRenderer.invoke('app:sendBounceCompleteNotification', payload),
  proToolsSoloButtonModeSupported: () => ipcRenderer.invoke('app:proToolsSoloButtonModeSupported') as Promise<boolean>,
  getProToolsSoloButtonMode: () =>
    ipcRenderer.invoke('app:getProToolsSoloButtonMode') as Promise<'Latch' | 'XOR' | 'Momentary' | null>,
  setProToolsSoloButtonMode: (mode: 'Latch' | 'XOR' | 'Momentary') =>
    ipcRenderer.invoke('app:setProToolsSoloButtonMode', mode) as Promise<boolean>,
  openAccessibilitySettings: () => ipcRenderer.invoke('app:openAccessibilitySettings') as Promise<void>,
  getAppVersion: () => ipcRenderer.invoke('app:getAppVersion') as Promise<string>,
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', flag) as Promise<void>,
  isAccessibilityTrusted: () => ipcRenderer.invoke('app:isAccessibilityTrusted') as Promise<boolean>,
});

contextBridge.exposeInMainWorld('notifications', {
  load: () => ipcRenderer.invoke('notifications:load'),
  save: (config: { iMessageEnabled: boolean; phoneNumber: string }) =>
    ipcRenderer.invoke('notifications:save', config),
});

contextBridge.exposeInMainWorld('stemTemplates', {
  load: () => ipcRenderer.invoke('stemTemplates:load'),
  save: (data: { templates: unknown[]; autoApplyOnSessionLoad: boolean }) =>
    ipcRenderer.invoke('stemTemplates:save', data),
});

contextBridge.exposeInMainWorld('appLog', {
  log: (level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) =>
    ipcRenderer.invoke('appLog:log', level, message, context),
  logError: (message: string, stack?: string, context?: Record<string, unknown>) =>
    ipcRenderer.invoke('appLog:logError', message, stack, context),
  export: () => ipcRenderer.invoke('appLog:export'),
  submitReport: (description: string) => ipcRenderer.invoke('appLog:submitReport', description),
  onErrorOccurred: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('appLog:errorOccurred', handler);
    return () => ipcRenderer.removeListener('appLog:errorOccurred', handler);
  },
});

contextBridge.exposeInMainWorld('appState', {
  load: () => ipcRenderer.invoke('appState:load'),
  save: (state: { selectedSessionId: string | null; sidebarWidth: number; rightWidth: number }) =>
    ipcRenderer.invoke('appState:save', state),
});

contextBridge.exposeInMainWorld('ptslPresets', {
  load: () => ipcRenderer.invoke('presets:load'),
  save: (slots: unknown[], lastActiveSlot: number | null) =>
    ipcRenderer.invoke('presets:save', slots, lastActiveSlot),
  export: (slots: unknown[]) => ipcRenderer.invoke('presets:export', slots),
  import: () => ipcRenderer.invoke('presets:import'),
});

contextBridge.exposeInMainWorld('ptslSessionBatch', {
  load: () => ipcRenderer.invoke('sessionBatch:load'),
  save: (entries: unknown[]) => ipcRenderer.invoke('sessionBatch:save', entries),
  pickSessions: () => ipcRenderer.invoke('sessionBatch:pickSessions'),
  hasBackup: () => ipcRenderer.invoke('sessionBatch:hasBackup') as Promise<boolean>,
  loadBackup: () => ipcRenderer.invoke('sessionBatch:loadBackup'),
});

contextBridge.exposeInMainWorld('ptslSessionScanCache', {
  load: () => ipcRenderer.invoke('sessionScanCache:load'),
  save: (cache: Record<string, unknown>) => ipcRenderer.invoke('sessionScanCache:save', cache),
});

contextBridge.exposeInMainWorld('license', {
  getState: () => ipcRenderer.invoke('license:getState'),
  validate: (force?: boolean) => ipcRenderer.invoke('license:validate', force),
  activateWithEmail: (email: string) => ipcRenderer.invoke('license:activateWithEmail', email),
  openCheckout: () => ipcRenderer.invoke('license:openCheckout'),
  deactivate: () => ipcRenderer.invoke('license:deactivate'),
  deactivateDevice: (deviceId: string) => ipcRenderer.invoke('license:deactivateDevice', deviceId),
  listActivations: () => ipcRenderer.invoke('license:listActivations'),
  setUserName: (name: string) => ipcRenderer.invoke('license:setUserName', name) as Promise<{ ok: boolean; error?: string }>,
  clear: () => ipcRenderer.invoke('license:clear'),
});

contextBridge.exposeInMainWorld('updater', {
  checkForUpdates: (isManual: boolean) => ipcRenderer.invoke('updater:checkForUpdates', isManual),
  startDownload: () => ipcRenderer.invoke('updater:startDownload'),
  skipUpdate: (version: string) => ipcRenderer.invoke('updater:skipUpdate', version),
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
  onUpdateAvailable: (callback: (payload: { version: string; releaseNotes?: string }) => void) => {
    const handler = (_: unknown, payload: { version: string; releaseNotes?: string }) => callback(payload);
    ipcRenderer.on('updater:updateAvailable', handler);
    return () => ipcRenderer.removeListener('updater:updateAvailable', handler);
  },
  onUpdateNotAvailable: (callback: (payload: { manual: boolean }) => void) => {
    const handler = (_: unknown, payload: { manual: boolean }) => callback(payload ?? { manual: false });
    ipcRenderer.on('updater:updateNotAvailable', handler);
    return () => ipcRenderer.removeListener('updater:updateNotAvailable', handler);
  },
  onUpdateDownloaded: (callback: (payload: { version: string }) => void) => {
    const handler = (_: unknown, payload: { version: string }) => callback(payload);
    ipcRenderer.on('updater:updateDownloaded', handler);
    return () => ipcRenderer.removeListener('updater:updateDownloaded', handler);
  },
  onError: (callback: (payload: { message: string; manual: boolean }) => void) => {
    const handler = (_: unknown, payload: { message: string; manual: boolean }) =>
      callback(payload ?? { message: 'Unknown error', manual: false });
    ipcRenderer.on('updater:error', handler);
    return () => ipcRenderer.removeListener('updater:error', handler);
  },
  onDownloadProgress: (callback: (payload: { percent: number; transferred: number; total: number }) => void) => {
    const handler = (_: unknown, payload: { percent: number; transferred: number; total: number }) => callback(payload);
    ipcRenderer.on('updater:downloadProgress', handler);
    return () => ipcRenderer.removeListener('updater:downloadProgress', handler);
  },
});

contextBridge.exposeInMainWorld('ptsl', {
  connect: (company: string, appName: string) => ipcRenderer.invoke('ptsl:connect', company, appName),
  disconnect: () => ipcRenderer.invoke('ptsl:disconnect'),
  sessionId: () => ipcRenderer.invoke('ptsl:sessionId'),
  getSessionName: () => ipcRenderer.invoke('ptsl:getSessionName'),
  getSessionPath: () => ipcRenderer.invoke('ptsl:getSessionPath'),
  getSessionSampleRate: () => ipcRenderer.invoke('ptsl:getSessionSampleRate'),
  getSessionBitDepth: () => ipcRenderer.invoke('ptsl:getSessionBitDepth'),
      getExportMixSourceList: (sourceType: string) => ipcRenderer.invoke('ptsl:getExportMixSourceList', sourceType),
      getTimeAsType: (location: { location: string; time_type: string }, desiredType: string) =>
        ipcRenderer.invoke('ptsl:getTimeAsType', location, desiredType),
  checkFilesExist: (folderPath: string, fileNames: string[]) => ipcRenderer.invoke('ptsl:checkFilesExist', folderPath, fileNames),
  send: (command: number, body: Record<string, unknown> | null) => ipcRenderer.invoke('ptsl:send', command, body),
  getTrackList: (body?: Record<string, unknown>) => ipcRenderer.invoke('ptsl:getTrackList', body),
  getTimelineSelection: (body?: Record<string, unknown>) => ipcRenderer.invoke('ptsl:getTimelineSelection', body),
  getMemoryLocations: (body?: Record<string, unknown>) => ipcRenderer.invoke('ptsl:getMemoryLocations', body),
  selectMemoryLocation: (body: { number: number }) => ipcRenderer.invoke('ptsl:selectMemoryLocation', body),
  setTrackSoloState: (body: { track_names: string[]; enabled: boolean }) => ipcRenderer.invoke('ptsl:setTrackSoloState', body),
  setTrackMuteState: (body: { track_names: string[]; enabled: boolean }) => ipcRenderer.invoke('ptsl:setTrackMuteState', body),
  exportMix: (body: Record<string, unknown>) => ipcRenderer.invoke('ptsl:exportMix', body),
  bounceTrack: (body: Record<string, unknown>) => ipcRenderer.invoke('ptsl:bounceTrack', body),
  selectFilesToImport: () => ipcRenderer.invoke('ptsl:selectFilesToImport'),
  importAudioBack: (
    filePaths: string[],
    destination: { type: 'clip_list' | 'below_track' | 'into_folder'; trackOrFolderName?: string; createNew?: boolean; placement?: 'current_selection' | 'top_of_session'; locationSamples?: string; locationTimeType?: string }
  ) => ipcRenderer.invoke('ptsl:importAudioBack', filePaths, destination),
  openSessionDialog: () => ipcRenderer.invoke('ptsl:openSessionDialog'),
      openSession: (sessionPath: string, options?: { suppressDialogs?: boolean }) =>
        ipcRenderer.invoke('ptsl:openSession', sessionPath, options),
  closeSession: (saveOnClose: boolean) => ipcRenderer.invoke('ptsl:closeSession', saveOnClose),
  saveSessionAs: (sessionName: string, sessionLocation: string) =>
    ipcRenderer.invoke('ptsl:saveSessionAs', sessionName, sessionLocation),
});

declare global {
  interface Window {
    appLog?: {
      log: (level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) => Promise<void>;
      logError: (message: string, stack?: string, context?: Record<string, unknown>) => Promise<void>;
      export: () => Promise<{ filePath?: string; content: string; error?: string }>;
      submitReport: (description: string) => Promise<{ ok: boolean; error?: string }>;
      onErrorOccurred: (callback: () => void) => () => void;
    };
    app: {
      pickFolder: (defaultPath?: string) => Promise<{ canceled: boolean; folderPath: string | null }>;
      ensureFolder: (folderPath: string) => Promise<{ ok: boolean; error?: string }>;
      showItemInFolder: (filePath: string) => Promise<void>;
      sendBounceCompleteNotification: (payload: { sessionName: string; phoneNumber: string }) =>
        Promise<{ ok: boolean; error?: string }>;
      proToolsSoloButtonModeSupported: () => Promise<boolean>;
      getProToolsSoloButtonMode: () => Promise<'Latch' | 'XOR' | 'Momentary' | null>;
      setProToolsSoloButtonMode: (mode: 'Latch' | 'XOR' | 'Momentary') => Promise<boolean>;
      openAccessibilitySettings: () => Promise<void>;
      getAppVersion: () => Promise<string>;
      setAlwaysOnTop: (flag: boolean) => Promise<void>;
      isAccessibilityTrusted: () => Promise<boolean>;
    };
    notifications: {
      load: () => Promise<{ iMessageEnabled: boolean; phoneNumber: string }>;
      save: (config: { iMessageEnabled: boolean; phoneNumber: string }) => Promise<{ ok?: boolean; error?: string }>;
    };
    stemTemplates: {
      load: () => Promise<{ templates: unknown[]; autoApplyOnSessionLoad: boolean }>;
      save: (data: { templates: unknown[]; autoApplyOnSessionLoad: boolean }) => Promise<{ ok?: boolean; error?: string }>;
    };
    appState: {
      load: () => Promise<{ selectedSessionId: string | null; sidebarWidth: number; rightWidth: number }>;
      save: (state: { selectedSessionId: string | null; sidebarWidth: number; rightWidth: number }) => Promise<{ ok?: boolean; error?: string }>;
    };
    license: {
      getState: () => Promise<{ subscriptionId: string | null; status: string | null; tier: string | null; userName: string | null; hasAccess: boolean }>;
      validate: (force?: boolean) => Promise<{ hasAccess: boolean; status: string | null; tier?: string | null; userName?: string | null; activationUsed?: number | null; activationLimit?: number | null }>;
      activateWithEmail: (email: string) => Promise<{ ok?: boolean; status?: string; tier?: string; error?: string }>;
      openCheckout: () => Promise<{ error?: string }>;
      deactivate: () => Promise<{ ok?: boolean; error?: string }>;
      deactivateDevice: (deviceId: string) => Promise<{ ok?: boolean; error?: string }>;
      listActivations: () => Promise<{ activations: Array<{ device_id: string; display_name: string | null; activated_at: string; is_current: boolean }>; error?: string }>;
      setUserName: (name: string) => Promise<{ ok: boolean; error?: string }>;
      clear: () => Promise<{ ok: boolean }>;
    };
    ptslPresets: {
      load: () => Promise<{ slots: (unknown | null)[]; lastActiveSlot: number | null }>;
      save: (slots: unknown[], lastActiveSlot: number | null) => Promise<{ ok?: boolean; error?: string }>;
      export: (slots: unknown[]) => Promise<{ ok?: boolean; canceled?: boolean; error?: string }>;
      import: () => Promise<{ slots?: (unknown | null)[]; canceled?: boolean; error?: string }>;
    };
    ptslSessionBatch: {
      load: () => Promise<{ entries: unknown[] }>;
      save: (entries: unknown[]) => Promise<{ ok?: boolean; error?: string }>;
      pickSessions: () => Promise<{ canceled: boolean; filePaths: string[] }>;
    };
    ptslSessionScanCache: {
      load: () => Promise<{ cache: Record<string, unknown> }>;
      save: (cache: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string }>;
    };
    updater?: {
      checkForUpdates: (isManual: boolean) => Promise<void>;
      startDownload: () => Promise<void>;
      skipUpdate: (version: string) => Promise<void>;
      quitAndInstall: () => Promise<void>;
      onUpdateAvailable: (callback: (payload: { version: string; releaseNotes?: string }) => void) => () => void;
      onUpdateNotAvailable: (callback: (payload: { manual: boolean }) => void) => () => void;
      onUpdateDownloaded: (callback: (payload: { version: string }) => void) => () => void;
      onError: (callback: (payload: { message: string; manual: boolean }) => void) => () => void;
      onDownloadProgress: (callback: (payload: { percent: number; transferred: number; total: number }) => void) => () => void;
    };
    ptsl: {
      connect: (company: string, appName: string) => Promise<{ sessionId?: string; error?: string }>;
      disconnect: () => Promise<{ ok: boolean }>;
      sessionId: () => Promise<string | null>;
      getSessionName: () => Promise<{ data?: { session_name?: string } | null; error?: string }>;
      getSessionPath: () => Promise<{ data?: { sessionFilePath: string } | null; error?: string }>;
      getSessionSampleRate: () => Promise<{ data?: { sample_rate?: string } | null; error?: string }>;
      getSessionBitDepth: () => Promise<{ data?: { bit_depth?: string } | null; error?: string }>;
      getExportMixSourceList: (sourceType: string) => Promise<{ data?: { source_list?: string[] } | null; error?: string }>;
      getTimeAsType: (location: { location: string; time_type: string }, desiredType: string) =>
        Promise<{ data?: { location?: string; time_type?: string } | null; error?: string }>;
      checkFilesExist: (folderPath: string, fileNames: string[]) => Promise<{ existing: string[] }>;
      send: (command: number, body: Record<string, unknown> | null) => Promise<{ success: boolean; body: unknown; error: unknown }>;
      getTrackList: (body?: Record<string, unknown>) => Promise<{ data?: unknown; error?: string }>;
      getTimelineSelection: (body?: Record<string, unknown>) => Promise<{ data?: unknown; error?: string }>;
      getMemoryLocations: (body?: Record<string, unknown>) => Promise<{ data?: unknown; error?: string }>;
      selectMemoryLocation: (body: { number: number }) => Promise<{ success: boolean; error?: string }>;
      setTrackSoloState: (body: { track_names: string[]; enabled: boolean }) => Promise<{ success: boolean; error?: string }>;
      setTrackMuteState: (body: { track_names: string[]; enabled: boolean }) => Promise<{ success: boolean; error?: string }>;
      exportMix: (body: Record<string, unknown>) => Promise<{ success: boolean; error?: string; body?: unknown }>;
      bounceTrack: (body: Record<string, unknown>) => Promise<{ success: boolean; error?: string; body?: unknown }>;
      selectFilesToImport: () => Promise<{ canceled: boolean; filePaths: string[] }>;
      importAudioBack: (
        filePaths: string[],
        destination: { type: 'clip_list' | 'below_track' | 'into_folder'; trackOrFolderName?: string; createNew?: boolean; placement?: 'current_selection' | 'top_of_session'; locationSamples?: string; locationTimeType?: string }
      ) => Promise<{ success?: boolean; error?: string; trackCount?: number; clipCount?: number }>;
      openSessionDialog: () => Promise<{ canceled: boolean; filePath: string | null }>;
      openSession: (sessionPath: string, options?: { suppressDialogs?: boolean }) => Promise<{ success: boolean; error?: string | null }>;
      closeSession: (saveOnClose: boolean) => Promise<{ success: boolean; error?: string | null }>;
      saveSessionAs: (sessionName: string, sessionLocation: string) => Promise<{ success: boolean; error?: string | null }>;
    };
  }
}

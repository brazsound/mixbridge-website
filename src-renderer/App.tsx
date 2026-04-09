import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ConnectionBar } from './components/ConnectionBar';
import { SettingsModal } from './components/SettingsModal';
import { StemList } from './components/StemList';
import { TechnicalPanel, type TechnicalPanelRef } from './components/TechnicalPanel';
import { LeftPanel, type LeftPanelTab } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { RunQueueRunner } from './components/RunQueueRunner';
import { useSessionBatchRunner } from './components/SessionBatchRunner';
import type { RunStatus, RunStatuses } from './components/RunQueueRunner';
import { TutorialProvider } from './contexts/TutorialContext';
import { TutorialOverlay } from './components/TutorialOverlay';
import { useConnection } from './hooks/useConnection';
import { useSettings, applyNamingFromConfig } from './hooks/useSettings';
import { useGeneralSettings } from './hooks/useGeneralSettings';
import { useShortcuts, matchesShortcut, formatShortcutForDisplay, DEFAULT_SHORTCUTS } from './hooks/useShortcuts';
import { useQueue } from './hooks/useQueue';
import type { QueueItem } from './hooks/useQueue';
import { useBounceSettings, DEFAULT_SETTINGS as DEFAULT_BOUNCE_SETTINGS } from './hooks/useBounceSettings';
import { useProToolsData, isFolderTrack } from './hooks/useProToolsData';
import { useSessionInfo, type SessionInfo } from './hooks/useSessionInfo';
import { useSessionScanCache } from './hooks/useSessionScanCache';
import { usePresets, extractPresetableSettings } from './hooks/usePresets';
import { useSessionBatch } from './hooks/useSessionBatch';
import type { SessionEntry } from './hooks/useSessionBatch';
import { useAppState } from './hooks/useAppState';
import { useProToolsPreferences } from './hooks/useProToolsPreferences';
import { useStemTemplates, matchTracksToTemplate } from './hooks/useStemTemplates';
import { useToast } from './contexts/ToastContext';
import { buildExportPayload, executeBounceItem } from './utils/bounceExecutor';
import { prepareSoloLatchForBounceRun } from './utils/soloLatchAutomation';
import { captureTrackSoloSnapshot, restoreTrackSoloSnapshot } from './utils/soloTrackSnapshot';
import { deserializeToQueueItems, type SerializedQueueItem } from './utils/templateQueue';
import type { NamingSessionAudio } from './utils/naming';
import {
  DEMO_PTX_PATH,
  DEMO_QUEUE,
  DEMO_SETTINGS,
  DEMO_SESSION_INFO,
  DEMO_TRACKS,
} from './utils/demoData';
import { LicenseGate } from './components/LicenseGate';
import { ErrorReportPrompt } from './components/ErrorReportPrompt';
import { PromptModal } from './components/PromptModal';
import { TemplateEditView, type TemplateEditActions } from './components/TemplateEditView';
import { UpdateAvailableDialog } from './components/UpdateAvailableDialog';
import {
  AccessibilitySetupModal,
  hasDismissedAccessibilityOnboarding,
} from './components/AccessibilitySetupModal';
import type { SettingsTab } from './components/SettingsModal';
import { useTutorial } from './contexts/TutorialContext';
import { usePreBounceAccessibilityGate } from './hooks/usePreBounceAccessibilityGate';
import { ptxPathsEqual, normalizePtxPath } from './utils/pathUtils';

/** Match batch entry to the session open in Pro Tools (path may differ by casing/slashes; name as fallback). */
function entryMatchesOpenSession(
  e: SessionEntry,
  openPath: string | null,
  openName: string | null | undefined
): boolean {
  if (openPath && ptxPathsEqual(e.ptxPath, openPath)) return true;
  if (openName && e.sessionName.toLowerCase() === openName.toLowerCase()) return true;
  return false;
}

interface AppContentProps {
  renderMainContent: (
    displayConnected: boolean,
    displaySessionName: string | null,
    simulateMode: boolean,
    onRestartTutorial: () => void,
    tutorialStepId: string | undefined
  ) => React.ReactNode;
  setShowSettings: (v: boolean | ((prev: boolean) => boolean)) => void;
}

function AppContent({ renderMainContent, setShowSettings }: AppContentProps) {
  const { displayConnected, displaySessionName, simulateMode, startTutorial, step } = useTutorial();
  const onRestartTutorial = useCallback(() => {
    startTutorial();
    setShowSettings(false);
  }, [startTutorial, setShowSettings]);
  return <>{renderMainContent(displayConnected, displaySessionName, simulateMode, onRestartTutorial, step?.id)}</>;
}

export default function App() {
  const { showToast } = useToast();
  const { connected, sessionName, loading: connLoading, error: connError, connect } =
    useConnection();
  const { defaultNaming, setDefaultNaming } = useSettings();
  const { generalSettings, setAutoAddSessionToBatch, setTheme, setAlwaysOnTop } = useGeneralSettings();
  const { requestGate: requestBounceAccessibilityGate, gateModal: bounceOneAccessibilityGateModal } =
    usePreBounceAccessibilityGate();

  useEffect(() => {
    const resolved: 'dark' | 'light' =
      generalSettings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : generalSettings.theme;
    if (resolved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    if (generalSettings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      const r = mq.matches ? 'dark' : 'light';
      if (r === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    };
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [generalSettings.theme]);

  useEffect(() => {
    void window.app?.setAlwaysOnTop?.(generalSettings.alwaysOnTop);
  }, [generalSettings.alwaysOnTop]);
  const { shortcuts, setShortcut, resetToDefaults: resetShortcuts } = useShortcuts();
  const {
    queue, canUndo, canRedo, undo, redo,
    addBounceNormal, addBatchStems, addBounceSoloed, addBounceMuted,
    updateItemName, updateItemFolder, clearItemFolder, batchUpdateFolder, batchRename, removeItem, reorderItems, clearQueue,
    loadQueue,
    loadQueueFromBatchStems,
  } = useQueue();
  const {
    settings,
    updateSettings,
    loadSettings,
    captureRangeFromTimeline,
    captureRangeFromMarkers,
    clearRange,
  } = useBounceSettings();

  const {
    slots: presetSlots,
    activeSlot: activePresetSlot,
    loadSlot: loadPresetSlot,
    saveToSlot: savePresetToSlot,
    renameSlot: renamePresetSlot,
    deleteSlot: deletePresetSlot,
    exportPresets,
    importPresets,
  } = usePresets(updateSettings, {
    onLoadError: (err) => showToast(`Could not load presets: ${err.message}`, 'error'),
  });

  const { getCached, mergeCached, setCached } = useSessionScanCache();
  const [currentProToolsPath, setCurrentProToolsPath] = useState<string | null>(null);

  const onSessionInfoScanned = useCallback(
    (ptxPath: string, data: SessionInfo) => {
      setCurrentProToolsPath(ptxPath);
      mergeCached(ptxPath, { sessionInfo: data });
    },
    [mergeCached]
  );

  const onProToolsDataScanned = useCallback(
    (ptxPath: string, data: { tracks: import('./hooks/useProToolsData').TrackInfo[]; memoryLocations: import('./hooks/useProToolsData').MemoryLocationInfo[] }) => {
      setCurrentProToolsPath(ptxPath);
      mergeCached(ptxPath, { tracks: data.tracks, memoryLocations: data.memoryLocations });
    },
    [mergeCached]
  );

  const {
    tracks,
    folderTracks,
    selectedTracks,
    soloedTracks,
    mutedTracks,
    memoryLocations,
    loading: ptLoading,
    error: ptError,
    refreshAll,
  } = useProToolsData(connected, onProToolsDataScanned);

  const { sessionInfo, reloadSessionInfo } = useSessionInfo(connected, onSessionInfoScanned);

  // ── Session Batch ──────────────────────────────────────────────────────────
  const {
    entries: batchEntries,
    addEntry: addBatchEntry,
    removeEntry: removeBatchEntry,
    reorderEntries: reorderBatchEntries,
    updateEntryStatus,
    updateEntry: updateBatchEntry,
    resetStatuses: resetBatchStatuses,
    clearEntries: clearBatchEntries,
  } = useSessionBatch({
    onLoadError: (err) => showToast(`Could not load batch sessions: ${err.message}`, 'error'),
  });

  const [hasSessionBackup, setHasSessionBackup] = useState(false);
  const [backupDismissed, setBackupDismissed] = useState(false);

  useEffect(() => {
    if (!window.ptslSessionBatch?.hasBackup) return;
    window.ptslSessionBatch.hasBackup().then((has) => setHasSessionBackup(has)).catch(() => {});
  }, []);

  const handleRestoreBackup = useCallback(async () => {
    if (!window.ptslSessionBatch?.loadBackup) return;
    try {
      const result = await window.ptslSessionBatch.loadBackup();
      if (result.notFound) { showToast('No backup file found', 'warning'); return; }
      if (result.error) { showToast(`Backup restore failed: ${result.error}`, 'error'); return; }
      const loaded = (result.entries ?? []) as import('./hooks/useSessionBatch').SessionEntry[];
      for (const e of loaded) {
        addBatchEntry(e.ptxPath, e.queue ?? [], e.settings ?? {});
      }
      setHasSessionBackup(false);
      setBackupDismissed(true);
      showToast(`Restored ${loaded.length} session${loaded.length !== 1 ? 's' : ''} from backup`);
    } catch (err) {
      showToast('Failed to restore backup', 'error');
      console.error('handleRestoreBackup', err);
    }
  }, [addBatchEntry, showToast]);

  const {
    selectedSessionId,
    sidebarWidth,
    rightWidth,
    loaded: appStateLoaded,
    setSelectedSessionId,
    setSidebarWidth,
    setRightWidth,
  } = useAppState();
  const { suppressDialogs, ...proToolsPrefs } = useProToolsPreferences();
  const [templatesRefreshTrigger, setTemplatesRefreshTrigger] = useState(0);
  const {
    autoApplyOnSessionLoad,
    activeTemplate,
    loaded: stemTemplatesLoaded,
    saveTemplateFromQueue,
    setAutoApplyOnSessionLoad,
    setDefaultTemplate,
    clearDefaultTemplate,
    removeTemplate,
    templates,
  } = useStemTemplates(templatesRefreshTrigger);
  const lastAutoAppliedPathRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const technicalPanelRef = useRef<TechnicalPanelRef>(null);
  selectedIdRef.current = selectedSessionId;

  const {
    running: batchRunning,
    finished: batchFinished,
    runError: batchRunError,
    paused: batchPaused,
    runAll: runBatch,
    rerun: rerunBatch,
    handleCancel: batchCancel,
    handlePause: batchPause,
    handleResume: batchResume,
    sessionBatchGateModal,
  } = useSessionBatchRunner({
    entries: batchEntries,
    onUpdateStatus: updateEntryStatus,
    onResetStatuses: resetBatchStatuses,
    onCacheSessionScan: (ptxPath, data) => setCached(ptxPath, data),
    suppressDialogs,
    sessionRenamePrefs: proToolsPrefs,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('shortcuts');
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('sessions');
  const [runStatuses, setRunStatuses] = useState<RunStatuses>({});
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [showAccessibilityOnboarding, setShowAccessibilityOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (hasDismissedAccessibilityOnboarding()) return;
      try {
        const supported = await window.app?.proToolsSoloButtonModeSupported?.();
        if (cancelled || !supported) return;
        setShowAccessibilityOnboarding(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Updater (check on mount, subscribe to events) ───────────────────────────
  useEffect(() => {
    if (!window.updater) return;
    window.updater.checkForUpdates(false);
  }, []);

  useEffect(() => {
    if (!window.updater) return;
    const unsubAvailable = window.updater.onUpdateAvailable((payload) => {
      setUpdateInfo({ version: payload.version, releaseNotes: payload.releaseNotes });
      setUpdateDownloading(false);
      setUpdateProgress(0);
      setUpdateDownloaded(false);
    });
    const unsubNotAvailable = window.updater.onUpdateNotAvailable((payload) => {
      if (payload.manual) showToast("You're up to date");
    });
    const unsubDownloaded = window.updater.onUpdateDownloaded(() => {
      setUpdateDownloaded(true);
      setUpdateDownloading(false);
    });
    const unsubError = window.updater.onError((payload) => {
      const isConnectionError =
        /ERR_CONNECTION_REFUSED|ERR_NAME_NOT_RESOLVED|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(
          payload.message
        );
      const is404 = /404|HttpError|not found/i.test(payload.message);
      if (isConnectionError || is404) {
        if (payload.manual) {
          showToast('Unable to check for updates. No update server configured.');
        }
        // For auto-check on startup: fail silently
      } else {
        const shortMsg = payload.message.slice(0, 80);
        showToast(`Update error: ${shortMsg}${payload.message.length > 80 ? '…' : ''}`, 'error');
      }
      setUpdateInfo(null);
      setUpdateDownloading(false);
    });
    const unsubProgress = window.updater.onDownloadProgress((payload) => {
      setUpdateProgress(payload.percent);
    });
    return () => {
      unsubAvailable();
      unsubNotAvailable();
      unsubDownloaded();
      unsubError();
      unsubProgress();
    };
  }, [showToast]);

  const handleUpdateStartDownload = useCallback(() => {
    setUpdateDownloading(true);
    window.updater?.startDownload();
  }, []);

  const handleUpdateSkip = useCallback(() => {
    if (updateInfo) {
      window.updater?.skipUpdate(updateInfo.version);
    }
    setUpdateInfo(null);
  }, [updateInfo]);

  const handleUpdateRestart = useCallback(() => {
    window.updater?.quitAndInstall();
  }, []);

  const handleUpdateClose = useCallback(() => {
    if (!updateDownloading && !updateDownloaded) setUpdateInfo(null);
  }, [updateDownloading, updateDownloaded]);

  const saveTemplateWithName = useCallback(
    async (name: string) => {
      try {
        await saveTemplateFromQueue(name.trim() || 'Untitled', queue, extractPresetableSettings(settings));
        showToast('Template saved');
      } catch (e) {
        showToast(`Failed to save template: ${(e as Error).message}`, 'error');
      }
    },
    [queue, settings, saveTemplateFromQueue, showToast]
  );

  const [showTemplateNamePrompt, setShowTemplateNamePrompt] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{
    id: string;
    name: string;
    queueItems: SerializedQueueItem[];
    settings?: import('./hooks/usePresets').PresetableSettings;
  } | null>(null);
  const templateEditActionsRef = useRef<TemplateEditActions | null>(null);
  const handleSaveAsTemplateClick = useCallback(() => setShowTemplateNamePrompt(true), []);
  const handleTemplateNameConfirm = useCallback(
    (name: string) => {
      setShowTemplateNamePrompt(false);
      if (name.trim()) {
        saveTemplateWithName(name.trim());
        setLeftPanelTab('template');
      }
    },
    [saveTemplateWithName]
  );

  const handleSaveTemplate = useCallback(
    async (
      templateId: string,
      queueItems: SerializedQueueItem[],
      templateSettings?: import('./hooks/usePresets').PresetableSettings
    ) => {
      if (!window.stemTemplates) return;
      try {
        const data = (await window.stemTemplates.load()) as {
          templates: { id: string; queueItems?: unknown[]; settings?: unknown }[];
          autoApplyOnSessionLoad: boolean;
        };
        const updated = data.templates.map((t) =>
          t.id === templateId ? { ...t, queueItems, settings: templateSettings } : t
        );
        await window.stemTemplates.save({
          templates: updated,
          autoApplyOnSessionLoad: data.autoApplyOnSessionLoad,
        });
        setTemplatesRefreshTrigger((t) => t + 1);
        showToast('Template saved');
      } catch (err) {
        console.error('handleSaveTemplate failed', err);
        showToast('Failed to save template', 'error');
      }
    },
    [showToast]
  );

  // ── Resizable columns (persisted via useAppState) ────────────────────────────
  const draggingRef = useRef<'left' | 'right' | null>(null);
  const dragStartRef = useRef({ x: 0, width: 0 });

  const onDividerMouseDown = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = side;
    dragStartRef.current = {
      x: e.clientX,
      width: side === 'left' ? sidebarWidth : rightWidth,
    };
  }, [sidebarWidth, rightWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      if (draggingRef.current === 'left') {
        setSidebarWidth(Math.max(140, Math.min(300, dragStartRef.current.width + dx)));
      } else {
        setRightWidth(Math.max(280, Math.min(620, dragStartRef.current.width - dx)));
      }
    };
    const onMouseUp = () => { draggingRef.current = null; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleStatusChange = useCallback((id: string, status: RunStatus) => {
    setRunStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  const handleRunStart = useCallback(() => {
    setRunStatuses({});
  }, []);

  const tutorialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tutorialTimeoutRef.current) clearTimeout(tutorialTimeoutRef.current);
    };
  }, []);

  const handleBuildStemsStepReached = useCallback(() => {
    const demoEntry = batchEntries.find((e) => e.ptxPath === DEMO_PTX_PATH);
    if (!demoEntry || selectedSessionId !== demoEntry.id) return;
    let index = 0;
    const addNext = () => {
      if (index >= DEMO_QUEUE.length) return;
      const items = DEMO_QUEUE.slice(0, index + 1);
      loadQueue(items);
      updateBatchEntry(demoEntry.id, items, demoEntry.settings);
      index += 1;
      if (index < DEMO_QUEUE.length) {
        tutorialTimeoutRef.current = setTimeout(addNext, 350);
      }
    };
    addNext();
  }, [batchEntries, selectedSessionId, loadQueue, updateBatchEntry]);

  const handleSimulateMode = useCallback((options?: { forTutorial?: boolean }) => {
    setCached(DEMO_PTX_PATH, {
      sessionInfo: DEMO_SESSION_INFO,
      tracks: DEMO_TRACKS,
      memoryLocations: [],
    });
    const existing = batchEntries.find((e) => e.ptxPath === DEMO_PTX_PATH);
    const initialQueue = options?.forTutorial ? [] : DEMO_QUEUE;
    if (existing) {
      setSelectedSessionId(existing.id);
      loadQueue(options?.forTutorial ? [] : existing.queue);
      loadSettings(existing.settings);
      if (options?.forTutorial) {
        updateBatchEntry(existing.id, [], existing.settings);
      }
    } else {
      addBatchEntry(DEMO_PTX_PATH, initialQueue, DEMO_SETTINGS, {
        skipPersist: true,
        onAdded: (entry) => {
          setSelectedSessionId(entry.id);
          loadQueue(initialQueue);
          loadSettings(entry.settings);
          setRunStatuses({});
        },
      });
    }
  }, [
    batchEntries,
    addBatchEntry,
    updateBatchEntry,
    loadQueue,
    loadSettings,
    setSelectedSessionId,
    setCached,
  ]);

  const handleBounceOne = useCallback(
    async (item: QueueItem) => {
      if (!window.ptsl || !settings.capturedRange || settings.mixSources.length === 0) {
        showToast('Capture a range and select mix sources first.', 'warning');
        return;
      }
      const gate = await requestBounceAccessibilityGate([item]);
      if (gate === 'abort') return;
      const legacyBatchStem = gate === 'legacy';

      handleStatusChange(item.id, { state: 'running' });
      let restoreSoloMode: () => Promise<void> = async () => {};
      try {
        const r = await prepareSoloLatchForBounceRun([item]);
        restoreSoloMode = r.restore;
      } catch {
        /* prepare is best-effort */
      }
      let batchSoloSnapshot: Map<string, boolean> | null = null;
      if (item.type === 'batch_stems' && !legacyBatchStem) {
        batchSoloSnapshot = await captureTrackSoloSnapshot();
      }
      try {
        const trackListRes = await window.ptsl.getTrackList({});
        const allTrackNames = (
          (trackListRes.data as { track_list?: { name: string }[] })?.track_list ?? []
        ).map((t) => t.name);
        const payload = buildExportPayload(settings);
        await executeBounceItem(item, payload, settings.capturedRange, settings, allTrackNames, true, {
          legacyBatchStemIsolation: legacyBatchStem,
        });
        handleStatusChange(item.id, { state: 'done' });
      } catch (e) {
        const msg = (e as Error).message;
        handleStatusChange(item.id, { state: 'error', error: msg });
        showToast(`Bounce failed: ${msg}`, 'error');
      } finally {
        await restoreTrackSoloSnapshot(batchSoloSnapshot);
        await restoreSoloMode();
      }
    },
    [settings, handleStatusChange, showToast, requestBounceAccessibilityGate]
  );

  // ── Session selection ──────────────────────────────────────────────────────
  // Save current edits back to the previously selected entry before switching
  const saveCurrentToEntry = useCallback(() => {
    const id = selectedIdRef.current;
    if (id) {
      updateBatchEntry(id, queue, settings);
    }
  }, [queue, settings, updateBatchEntry]);

  const handleSelectSession = useCallback((id: string) => {
    // Save edits to previous session first
    saveCurrentToEntry();
    // Load the new session
    const entry = batchEntries.find((e) => e.id === id);
    if (!entry) return;
    loadQueue(entry.queue);
    loadSettings(entry.settings);
    setSelectedSessionId(id);
    setRunStatuses({});
  }, [batchEntries, saveCurrentToEntry, loadQueue, loadSettings]);

  // When the batch list becomes empty, clear the center section (queue + setup).
  // Also when the selected entry disappears (covers removal while selected).
  const prevBatchCountRef = useRef<number | null>(null);
  useEffect(() => {
    const count = batchEntries.length;
    const prev = prevBatchCountRef.current;

    if (prev !== null && count === 0 && prev > 0) {
      setSelectedSessionId(null);
      loadQueue([]);
      loadSettings(DEFAULT_BOUNCE_SETTINGS);
      setRunStatuses({});
    }
    prevBatchCountRef.current = count;

    if (selectedSessionId && !batchEntries.find((e) => e.id === selectedSessionId)) {
      setSelectedSessionId(null);
      loadQueue([]);
      loadSettings(DEFAULT_BOUNCE_SETTINGS);
      setRunStatuses({});
    }
  }, [batchEntries, selectedSessionId, setSelectedSessionId, loadQueue, loadSettings]);

  // Auto-select the session only when Pro Tools opens/switches to a different session
  // (not when the user manually selects another session in the list)
  const lastAutoSelectedPtSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!connected || batchEntries.length === 0) return;
    const ptSessionKey = currentProToolsPath ?? sessionName ?? '';
    if (!ptSessionKey) return;
    // Only auto-select when Pro Tools session actually changed
    if (lastAutoSelectedPtSessionRef.current === ptSessionKey) return;

    const entry = batchEntries.find((e) =>
      entryMatchesOpenSession(e, currentProToolsPath, sessionName)
    );
    if (!entry || entry.id === selectedSessionId) return;
    lastAutoSelectedPtSessionRef.current = ptSessionKey;
    saveCurrentToEntry();
    loadQueue(entry.queue);
    loadSettings(entry.settings);
    setSelectedSessionId(entry.id);
    setRunStatuses({});
  }, [
    connected,
    sessionName,
    currentProToolsPath,
    batchEntries,
    selectedSessionId,
    saveCurrentToEntry,
    loadQueue,
    loadSettings,
    setSelectedSessionId,
  ]);

  // ── Restore selected session on load ────────────────────────────────────────
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!appStateLoaded || batchEntries.length === 0 || !selectedSessionId || restoredRef.current) return;
    const entry = batchEntries.find((e) => e.id === selectedSessionId);
    if (!entry) return;
    restoredRef.current = true;
    loadQueue(entry.queue);
    loadSettings(entry.settings);
  }, [appStateLoaded, batchEntries, selectedSessionId, loadQueue, loadSettings]);

  // ── Persist current session edits after each change ─────────────────────────
  // Use refs so that the debounce flush always writes the *current* values,
  // even if it fires after the closure was created (session switch race).
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistSessionIdRef = useRef(selectedSessionId);
  const persistQueueRef = useRef(queue);
  const persistSettingsRef = useRef(settings);
  persistSessionIdRef.current = selectedSessionId;
  persistQueueRef.current = queue;
  persistSettingsRef.current = settings;

  useEffect(() => {
    if (!selectedSessionId) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      updateBatchEntry(persistSessionIdRef.current!, persistQueueRef.current, persistSettingsRef.current);
    }, 200);
    return () => {
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = null;
        updateBatchEntry(persistSessionIdRef.current!, persistQueueRef.current, persistSettingsRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, queue, settings, updateBatchEntry]);

  // Clear current Pro Tools path and auto-select ref when disconnected
  useEffect(() => {
    if (!connected) {
      setCurrentProToolsPath(null);
      lastAutoSelectedPtSessionRef.current = null;
    }
  }, [connected]);

  // Session context for naming tokens ({sampleRate}, {bitDepth}) — must run before keyboard shortcuts
  const selectedEntry = batchEntries.find((e) => e.id === selectedSessionId) ?? null;

  const activeInProToolsSessionId =
    connected && (currentProToolsPath || sessionName)
      ? batchEntries.find((e) => entryMatchesOpenSession(e, currentProToolsPath, sessionName))?.id ?? null
      : null;

  const isSelectedSessionOpen =
    Boolean(
      selectedEntry && currentProToolsPath && ptxPathsEqual(selectedEntry.ptxPath, currentProToolsPath)
    );

  const rawCurrentSessionNotInList = useMemo(
    () =>
      !!currentProToolsPath &&
      !batchEntries.some((e) => entryMatchesOpenSession(e, currentProToolsPath, sessionName)),
    [batchEntries, currentProToolsPath, sessionName]
  );

  const [currentSessionNotInList, setCurrentSessionNotInList] = useState(false);
  useEffect(() => {
    if (!rawCurrentSessionNotInList) {
      setCurrentSessionNotInList(false);
      return;
    }
    if (!generalSettings.autoAddSessionToBatch) {
      setCurrentSessionNotInList(true);
      return;
    }
    const t = window.setTimeout(() => setCurrentSessionNotInList(true), 450);
    return () => window.clearTimeout(t);
  }, [rawCurrentSessionNotInList, generalSettings.autoAddSessionToBatch]);

  const cachedForSelected = selectedEntry ? getCached(selectedEntry.ptxPath) : null;
  const panelSessionInfo =
    selectedEntry?.ptxPath === DEMO_PTX_PATH
      ? DEMO_SESSION_INFO
      : selectedEntry && !isSelectedSessionOpen && cachedForSelected?.sessionInfo
        ? cachedForSelected.sessionInfo
        : sessionInfo;

  const namingSessionAudio = useMemo((): NamingSessionAudio => {
    const sr = panelSessionInfo.sampleRate;
    let bd = panelSessionInfo.bitDepth;
    // When PTSL bit depth is unknown/unmapped, use bounce format from Technical Panel (session default = 0)
    if (bd <= 0 && settings.bitDepth > 0) {
      bd = settings.bitDepth;
    }
    return {
      sampleRateHz: sr > 0 ? sr : undefined,
      bitDepth: bd > 0 ? bd : undefined,
    };
  }, [panelSessionInfo.sampleRate, panelSessionInfo.bitDepth, settings.bitDepth]);

  const namingTemplateCtx = useMemo(
    () => ({ sessionName: sessionName ?? undefined, ...namingSessionAudio }),
    [sessionName, namingSessionAudio]
  );

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (matchesShortcut(e, shortcuts.settings)) {
        e.preventDefault();
        setShowSettings((s) => !s);
        return;
      }
      if (showSettings) return;

      if (matchesShortcut(e, shortcuts.undo)) {
        e.preventDefault();
        if (editingTemplate && templateEditActionsRef.current?.canUndo) {
          templateEditActionsRef.current.undo();
        } else if (!editingTemplate) {
          undo();
        }
        return;
      }
      if (matchesShortcut(e, shortcuts.redo)) {
        e.preventDefault();
        if (editingTemplate && templateEditActionsRef.current?.canRedo) {
          templateEditActionsRef.current.redo();
        } else if (!editingTemplate) {
          redo();
        }
        return;
      }
      if (editingTemplate && templateEditActionsRef.current?.hasSelection) {
        if (matchesShortcut(e, shortcuts.templateRename)) {
          e.preventDefault();
          templateEditActionsRef.current.openRename();
          return;
        }
        if (matchesShortcut(e, shortcuts.templateOutputFolder)) {
          e.preventDefault();
          void templateEditActionsRef.current.openOutputFolder();
          return;
        }
      }
      if (matchesShortcut(e, shortcuts.mix)) {
        e.preventDefault();
        if (connected && !ptLoading) {
          addBounceNormal(
            applyNamingFromConfig(defaultNaming, { name: 'Mix', ...namingTemplateCtx }, 'mix')
          );
        }
        return;
      }
      if (matchesShortcut(e, shortcuts.batch)) {
        e.preventDefault();
        if (!connected || ptLoading) return;
        if (selectedTracks.length > 0) {
          addBatchStems(
            selectedTracks.map((t) => t.id),
            selectedTracks.map((t) => t.name),
            defaultNaming,
            { sessionName: sessionName ?? undefined, ...namingSessionAudio }
          );
        } else {
          showToast('No tracks selected — select tracks in Pro Tools first', 'warning');
        }
        return;
      }
      if (matchesShortcut(e, shortcuts.solo)) {
        e.preventDefault();
        if (!connected || ptLoading) return;
        if (soloedTracks.length > 0) {
          addBounceSoloed(soloedTracks.map((t) => t.name), defaultNaming, namingTemplateCtx);
        } else {
          showToast('No soloed tracks — solo tracks in Pro Tools first', 'warning');
        }
        return;
      }
      if (matchesShortcut(e, shortcuts.mute)) {
        e.preventDefault();
        if (!connected || ptLoading) return;
        if (mutedTracks.length > 0) {
          addBounceMuted(mutedTracks.map((t) => t.name), defaultNaming, namingTemplateCtx);
        } else {
          showToast('No muted tracks — mute tracks in Pro Tools first', 'warning');
        }
        return;
      }
      if (matchesShortcut(e, shortcuts.refresh)) {
        e.preventDefault();
        if (connected) void refreshAll();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    connected,
    ptLoading,
    selectedTracks,
    soloedTracks,
    mutedTracks,
    sessionName,
    defaultNaming,
    shortcuts,
    addBounceNormal,
    addBatchStems,
    addBounceSoloed,
    addBounceMuted,
    refreshAll,
    namingSessionAudio,
    namingTemplateCtx,
    undo,
    redo,
    editingTemplate,
    showSettings,
    showToast,
  ]);

  // ── Auto-add open session to batch ────────────────────────────────────────
  // When Pro Tools has a session open that isn't in the batch, add it automatically.
  const prevSessionNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!generalSettings.autoAddSessionToBatch || !connected || !sessionName) return;
    const prev = prevSessionNameRef.current;
    prevSessionNameRef.current = sessionName;
    // Skip if same session as last time (no change)
    if (prev === sessionName) return;

    const alreadyAdded = batchEntries.some(
      (e) => e.sessionName.toLowerCase() === sessionName.toLowerCase()
    );
    if (alreadyAdded) return;

    const addOpenSession = async () => {
      try {
        saveCurrentToEntry();
        const pathRes = await window.ptsl.getSessionPath();
        const ptxPath = pathRes.data?.sessionFilePath ?? '';
        if (!ptxPath) return;
        if (batchEntries.some((e) => ptxPathsEqual(e.ptxPath, ptxPath))) return;
        addBatchEntry(ptxPath, [], { ...settings });
      } catch (err) {
        console.error('addOpenSession failed', err);
      }
    };
    void addOpenSession();
  }, [generalSettings.autoAddSessionToBatch, sessionName, connected, batchEntries, settings, saveCurrentToEntry, addBatchEntry]);

  // ── Add the currently open Pro Tools session to the batch ─────────────────
  const handleAddCurrentSession = useCallback(async () => {
    try {
      saveCurrentToEntry();
      const pathRes = await window.ptsl.getSessionPath();
      const ptxPath = pathRes.data?.sessionFilePath ?? '';
      if (!ptxPath) return;
      if (batchEntries.some((e) => ptxPathsEqual(e.ptxPath, ptxPath))) return;
      addBatchEntry(ptxPath, [], { ...settings });
    } catch (err) {
      console.error('handleAddCurrentSession failed', err);
    }
  }, [settings, saveCurrentToEntry, addBatchEntry, batchEntries]);

  const handleAddSessionsViaFilePicker = useCallback(async () => {
    try {
      saveCurrentToEntry();
      const result = await window.ptslSessionBatch.pickSessions();
      if (result.canceled || !result.filePaths?.length) return;
      const existing = new Set(batchEntries.map((e) => normalizePtxPath(e.ptxPath).toLowerCase()));
      const added = new Set<string>();
      for (const ptxPath of result.filePaths) {
        const key = normalizePtxPath(ptxPath).toLowerCase();
        if (existing.has(key) || added.has(key)) continue;
        added.add(key);
        addBatchEntry(ptxPath, [], { ...settings });
      }
    } catch (err) {
      console.error('handleAddSessionsViaFilePicker failed', err);
    }
  }, [settings, saveCurrentToEntry, addBatchEntry, batchEntries]);

  // ── Add to Batch (from the center banner) — keeps the current queue ───────
  const handleAddToBatch = useCallback(async () => {
    try {
      saveCurrentToEntry();
      const pathRes = await window.ptsl.getSessionPath();
      const ptxPath = pathRes.data?.sessionFilePath ?? '';
      if (!ptxPath) return;
      if (batchEntries.some((e) => ptxPathsEqual(e.ptxPath, ptxPath))) return;
      addBatchEntry(ptxPath, [...queue], { ...settings });
    } catch (err) {
      console.error('handleAddToBatch failed', err);
    }
  }, [queue, settings, saveCurrentToEntry, addBatchEntry, batchEntries]);

  // ── Edit button in session rows — same as clicking the row ────────────────
  const handleEditEntry = useCallback((entry: SessionEntry) => {
    handleSelectSession(entry.id);
  }, [handleSelectSession]);

  const panelTracks =
    selectedEntry?.ptxPath === DEMO_PTX_PATH
      ? DEMO_TRACKS
      : selectedEntry && !isSelectedSessionOpen && cachedForSelected?.tracks
        ? cachedForSelected.tracks
        : tracks;
  const panelFolderTracks = panelTracks.filter((t) => isFolderTrack(t));

  // ── Apply template to a specific batch session ─────────────────────────────
  const handleApplyTemplateToSession = useCallback(
    (sessionId: string, templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      const targetEntry = batchEntries.find((e) => e.id === sessionId);
      if (!template || !targetEntry) return;

      const isActive = targetEntry.id === selectedSessionId;
      const tracksForMatch = isActive
        ? panelTracks.filter((t) => !isFolderTrack(t)).map((t) => ({ id: t.id, name: t.name }))
        : [];
      const ctx = isActive
        ? { sessionName: sessionName ?? undefined, ...namingSessionAudio }
        : { sessionName: targetEntry.sessionName };

      const newQueue = deserializeToQueueItems(
        (template.queueItems ?? []) as SerializedQueueItem[],
        tracksForMatch,
        defaultNaming,
        ctx
      );
      const newSettings: import('./hooks/useBounceSettings').BounceSettings = template.settings
        ? { ...targetEntry.settings, ...template.settings }
        : targetEntry.settings;

      if (newQueue.length === 0 && (template.queueItems ?? []).length > 0) {
        showToast(`No matching tracks found — "${template.name}" unchanged`, 'warning');
        return;
      }

      updateBatchEntry(sessionId, newQueue, newSettings);

      if (isActive) {
        loadQueue(newQueue);
        if (template.settings) loadSettings(newSettings);
      }

      const countLabel = newQueue.length > 0 ? ` (${newQueue.length} item${newQueue.length !== 1 ? 's' : ''})` : '';
      showToast(`Applied "${template.name}" to ${targetEntry.sessionName}${countLabel}`);
    },
    [
      templates, batchEntries, selectedSessionId, panelTracks, sessionName,
      namingSessionAudio, defaultNaming, updateBatchEntry, loadQueue, loadSettings,
      showToast, isFolderTrack,
    ]
  );

  // Auto-apply default template when session loads (if enabled)
  const effectiveSessionPath =
    selectedEntry && !connected
      ? selectedEntry.ptxPath
      : connected
        ? currentProToolsPath
        : null;

  // Clear "last applied" when no active session, or when that session is removed from the batch
  useEffect(() => {
    if (!effectiveSessionPath) {
      lastAutoAppliedPathRef.current = null;
      return;
    }
    const path = lastAutoAppliedPathRef.current;
    if (path && !batchEntries.some((e) => ptxPathsEqual(e.ptxPath, path))) {
      lastAutoAppliedPathRef.current = null;
    }
  }, [effectiveSessionPath, batchEntries]);

  useEffect(() => {
    if (!stemTemplatesLoaded || !autoApplyOnSessionLoad || !activeTemplate || !effectiveSessionPath) return;
    if (lastAutoAppliedPathRef.current === effectiveSessionPath) return;

    const tracksForMatch = panelTracks.filter((t) => !isFolderTrack(t)).map((t) => ({ id: t.id, name: t.name }));
    const ctx = { sessionName: sessionName ?? undefined, ...namingSessionAudio };

    if (activeTemplate.queueItems && activeTemplate.queueItems.length > 0) {
      const items = deserializeToQueueItems(
        activeTemplate.queueItems as SerializedQueueItem[],
        tracksForMatch,
        defaultNaming,
        ctx
      );
      if (items.length > 0) {
        lastAutoAppliedPathRef.current = effectiveSessionPath;
        loadQueue(items);
        if (activeTemplate.settings) loadSettings({ ...settings, ...activeTemplate.settings });
        showToast(`Template "${activeTemplate.name}" applied`);
      }
    } else if (activeTemplate.trackPatterns && activeTemplate.trackPatterns.length > 0) {
      const matched = matchTracksToTemplate(tracksForMatch, activeTemplate.trackPatterns);
      if (matched.length > 0) {
        lastAutoAppliedPathRef.current = effectiveSessionPath;
        loadQueueFromBatchStems(
          matched.map((t) => t.id),
          matched.map((t) => t.name),
          defaultNaming,
          ctx
        );
        if (activeTemplate.settings) loadSettings({ ...settings, ...activeTemplate.settings });
        showToast(`Template "${activeTemplate.name}" applied`);
      }
    }
  }, [
    stemTemplatesLoaded,
    autoApplyOnSessionLoad,
    activeTemplate,
    effectiveSessionPath,
    panelTracks,
    defaultNaming,
    sessionName,
    namingSessionAudio,
    settings,
    loadQueue,
    loadQueueFromBatchStems,
    loadSettings,
    showToast,
  ]);

  const panelMemoryLocations =
    selectedEntry && !isSelectedSessionOpen && cachedForSelected?.memoryLocations
      ? cachedForSelected.memoryLocations
      : memoryLocations;

  const renderMainContent = (
    displayConnected: boolean,
    displaySessionName: string | null,
    simulateMode: boolean,
    onRestartTutorial: () => void,
    tutorialStepId: string | undefined
  ) => (
    <div className="flex flex-col" style={{ height: '100vh', background: 'var(--bg)' }}>
      <ConnectionBar
        connected={displayConnected}
        sessionName={displaySessionName}
        loading={connLoading}
        error={connError}
        onRetry={connect}
        onSettingsClick={() => setShowSettings((s) => !s)}
        showingSettings={showSettings}
        settingsShortcut={formatShortcutForDisplay(shortcuts.settings)}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        activeTab={settingsTab}
        onTabChange={setSettingsTab}
        defaultNaming={defaultNaming}
        onSaveNaming={(n) => {
          setDefaultNaming(n);
          showToast('Saved');
        }}
        shortcuts={shortcuts}
        onSetShortcut={setShortcut}
        onResetShortcut={(action) => setShortcut(action, DEFAULT_SHORTCUTS[action])}
        onResetShortcuts={() => {
          resetShortcuts();
          showToast('Reset to defaults');
        }}
        proToolsPrefs={proToolsPrefs}
        onSetIgnoreMissingFiles={(v) => proToolsPrefs.setIgnoreMissingFiles(v)}
        onSetIgnoreMissingPlugins={(v) => proToolsPrefs.setIgnoreMissingPlugins(v)}
        onSetIgnoreIOChange={(v) => proToolsPrefs.setIgnoreIOChange(v)}
        onSetRenameSessionAfterBatch={(v) => proToolsPrefs.setRenameSessionAfterBatch(v)}
        onSetRenameSettings={(s) => proToolsPrefs.setRenameSettings(s)}
        onRestartTutorial={onRestartTutorial}
        autoAddSessionToBatch={generalSettings.autoAddSessionToBatch}
        onSetAutoAddSessionToBatch={setAutoAddSessionToBatch}
        theme={generalSettings.theme}
        onSetTheme={setTheme}
        alwaysOnTop={generalSettings.alwaysOnTop}
        onSetAlwaysOnTop={setAlwaysOnTop}
      />

      {/* ── Main 3-column layout ── */}
      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div
          className="flex"
          style={{ flex: '1 1 0', minHeight: 0, padding: '10px', gap: '0', overflow: 'hidden' }}
        >
          {/* ── Col 1: Left panel (Sessions + Session Template tabs) ── */}
          {hasSessionBackup && !backupDismissed && batchEntries.length === 0 && (
            <div
              className="absolute z-30 mx-2 mt-2 px-3 py-2 rounded-xl flex items-center gap-2 text-[11px]"
              style={{
                background: 'var(--warning-soft)',
                border: '1px solid rgba(255,159,10,0.3)',
                color: 'var(--text-secondary)',
                left: 0,
                right: 0,
                top: 0,
                maxWidth: sidebarWidth - 20,
              }}
            >
              <span className="flex-1 leading-snug">A previous session list backup was found.</span>
              <button
                type="button"
                onClick={() => void handleRestoreBackup()}
                className="font-semibold shrink-0 text-[10px] underline underline-offset-2 hover:opacity-80"
                style={{ color: 'var(--warning)' }}
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => { setHasSessionBackup(false); setBackupDismissed(true); }}
                className="shrink-0 hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Dismiss backup restore prompt"
              >
                ×
              </button>
            </div>
          )}
          <LeftPanel
            activeTab={leftPanelTab}
            onTabChange={setLeftPanelTab}
            width={sidebarWidth}
            entries={batchEntries}
            selectedId={selectedSessionId}
            running={batchRunning}
            finished={batchFinished}
            runError={batchRunError}
            paused={batchPaused}
            connected={displayConnected}
            onSelectSession={handleSelectSession}
            onAddSessions={() => void handleAddSessionsViaFilePicker()}
            onAddCurrentSession={displayConnected && !simulateMode ? () => void handleAddCurrentSession() : undefined}
            currentSessionNotInList={currentSessionNotInList}
            activeInProToolsId={activeInProToolsSessionId}
            onRemoveEntry={removeBatchEntry}
            onReorderEntries={reorderBatchEntries}
            onRun={() => { saveCurrentToEntry(); void runBatch(); }}
            onRerun={rerunBatch}
            onCancel={batchCancel}
            onPause={batchPause}
            onResume={batchResume}
            queue={queue}
            tracks={panelTracks.filter((t) => !isFolderTrack(t))}
            defaultNaming={defaultNaming}
            namingSessionAudio={namingSessionAudio}
            sessionName={sessionName}
            onLoadQueueFromTemplate={loadQueue}
            onLoadSettingsFromTemplate={(templateSettings) =>
              loadSettings({ ...settings, ...templateSettings } as import('./hooks/useBounceSettings').BounceSettings)
            }
            onSaveAsTemplate={saveTemplateWithName}
            onEnterEditMode={(tpl) => {
              setLeftPanelTab('template');
              setEditingTemplate({
                id: tpl.id,
                name: tpl.name,
                queueItems: (tpl.queueItems ?? []) as SerializedQueueItem[],
                settings: tpl.settings,
              });
            }}
            templates={templates}
            templatesLoaded={stemTemplatesLoaded}
            autoApplyOnSessionLoad={autoApplyOnSessionLoad}
            defaultTemplateId={activeTemplate?.id ?? null}
            onSetAutoApplyOnSessionLoad={setAutoApplyOnSessionLoad}
            onSetDefaultTemplate={setDefaultTemplate}
            onClearDefaultTemplate={clearDefaultTemplate}
            onRemoveTemplate={removeTemplate}
            onTemplateApplied={(name, count) => {
                if (count === 0) {
                  showToast(`No matching tracks found — "${name}" unchanged`, 'warning');
                } else {
                  showToast(`Template "${name}" applied (${count} item${count !== 1 ? 's' : ''})`);
                }
              }}
            onApplyTemplateToSession={handleApplyTemplateToSession}
          />

          {/* ── Resize handle: sidebar / stems ── */}
          <div
            onMouseDown={(e) => onDividerMouseDown('left', e)}
            title="Drag to resize"
            className="flex items-center justify-center flex-shrink-0 z-10"
            style={{ width: '10px', cursor: 'col-resize' }}
          >
            <div
              className="transition-all duration-200"
              style={{ width: '2px', height: '40px', borderRadius: '2px', background: 'rgba(255,255,255,0.12)' }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.background = 'rgba(255,255,255,0.35)';
                el.style.width = '3px';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.background = 'rgba(255,255,255,0.12)';
                el.style.width = '2px';
              }}
            />
          </div>

          {/* ── Col 2: Stems or Template Edit ── */}
          <div
            className="flex flex-col"
            style={{ flex: '1 1 0', minWidth: 0, borderRadius: '16px', overflow: 'hidden' }}
          >
            {editingTemplate ? (
              <TemplateEditView
                template={editingTemplate}
                onSave={(queueItems) => handleSaveTemplate(editingTemplate.id, queueItems, editingTemplate.settings)}
                onSaveAndExit={async (queueItems) => {
                  await handleSaveTemplate(editingTemplate.id, queueItems, editingTemplate.settings);
                  templateEditActionsRef.current = null;
                  setEditingTemplate(null);
                }}
                onCancel={() => {
                  templateEditActionsRef.current = null;
                  setEditingTemplate(null);
                }}
                onRegisterActions={(actions) => {
                  templateEditActionsRef.current = actions;
                }}
                shortcuts={shortcuts}
              />
            ) : (
              <>
          <div
            className="glass-card flex flex-col h-full"
            style={{ flex: '1 1 0', minWidth: 0, borderRadius: '16px', overflow: 'hidden' }}
          >
            {/* Accent session context stripe */}
            <div
              style={{
                height: '3px',
                background: selectedEntry ? 'var(--accent)' : 'transparent',
                transition: 'background var(--transition-normal)',
                flexShrink: 0,
              }}
            />
            {/* Session context banner */}
            <div
              className="shrink-0 flex items-center justify-between gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="min-w-0">
                  {selectedEntry ? (
                    <>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="shrink-0 w-[7px] h-[7px] rounded-full"
                          style={{ background: 'var(--accent)' }}
                        />
                        <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--text)' }}>
                          {selectedEntry.sessionName}
                        </p>
                      </div>
                      <p className="text-[10px] leading-tight mt-0.5 truncate pl-[15px]" style={{ color: 'var(--text-muted)' }}>
                        {selectedEntry.ptxPath}
                      </p>
                    </>
                  ) : displayConnected && displaySessionName ? (
                    <>
                      <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                        {displaySessionName}
                      </p>
                      <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {simulateMode ? 'Simulated · connect to Pro Tools for real bounces' : 'Connected · changes not saved to any session'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>
                      {displayConnected ? 'No session selected' : 'Not connected to Pro Tools'}
                    </p>
                  )}
                </div>
              </div>

              {/* Add to Batch button */}
              {displayConnected && !simulateMode && queue.length > 0 && settings.capturedRange && !selectedEntry && (
                <button
                  type="button"
                  onClick={() => void handleAddToBatch()}
                  className="btn-glass text-xs shrink-0"
                  style={{ borderColor: 'var(--accent-border-strong)' }}
                  title="Save current queue + settings as a batch session entry"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add to Batch
                </button>
              )}
            </div>

            {/* Stems list */}
            <div style={{ flex: '1 1 0', overflow: 'auto', padding: '16px' }}>
              <StemList
                shortcuts={shortcuts}
                sessionName={displaySessionName}
                connected={displayConnected}
                queue={queue}
                defaultOutputFolderDisplay={
                  settings.destination === 'custom' && settings.customPath
                    ? (settings.customPath.split('/').pop() || settings.customPath)
                    : 'Bounced Files'
                }
                defaultNaming={defaultNaming}
                namingSessionAudio={namingSessionAudio}
                selectedTracks={selectedTracks}
                soloedTracks={soloedTracks}
                mutedTracks={mutedTracks}
                ptDataLoading={ptLoading}
                ptDataError={ptError}
                runStatuses={runStatuses}
                onRefresh={refreshAll}
                onAddBounceNormal={addBounceNormal}
                onAddBatchStems={addBatchStems}
                onAddBounceSoloed={addBounceSoloed}
                onAddBounceMuted={addBounceMuted}
                onUpdateItemName={updateItemName}
                onUpdateItemFolder={updateItemFolder}
                onClearItemFolder={clearItemFolder}
                onBatchUpdateFolder={batchUpdateFolder}
                onBatchRename={batchRename}
                onRemoveItem={removeItem}
                onReorderItems={reorderItems}
                onClearQueue={clearQueue}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onSaveAsTemplate={handleSaveAsTemplateClick}
                onBounceOne={handleBounceOne}
                canBounceOne={displayConnected && !!settings.capturedRange && settings.mixSources.length > 0 && !simulateMode}
                queueRunning={Object.values(runStatuses).some((s) => s.state === 'running')}
              />
            </div>

            {/* Run current session — prominent primary action at bottom */}
            {displayConnected && queue.length > 0 && (
              <div className="shrink-0 p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <RunQueueRunner
                  queue={queue}
                  connected={displayConnected}
                  settings={settings}
                  simulateMode={simulateMode}
                  onStatusChange={handleStatusChange}
                  onRunStart={handleRunStart}
                />
              </div>
            )}
          </div>
              </>
            )}
          </div>

          {/* ── Resize handle: stems / settings ── */}
          <div
            onMouseDown={(e) => onDividerMouseDown('right', e)}
            title="Drag to resize"
            className="flex items-center justify-center flex-shrink-0 z-10"
            style={{ width: '10px', cursor: 'col-resize' }}
          >
            <div
              className="transition-all duration-150"
              style={{ width: '2px', height: '40px', borderRadius: '2px', background: 'rgba(255,255,255,0.12)' }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.background = 'rgba(255,255,255,0.35)';
                el.style.width = '3px';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.background = 'rgba(255,255,255,0.12)';
                el.style.width = '2px';
              }}
            />
          </div>

          {/* ── Col 3: Right panel (Setup only — always visible, including when editing templates) ── */}
          <RightPanel
            width={rightWidth}
            isEditingTemplate={!!editingTemplate}
            technicalPanelRef={technicalPanelRef}
            settings={
              editingTemplate
                ? { ...settings, ...editingTemplate.settings }
                : settings
            }
            onUpdateSettings={
              editingTemplate
                ? (partial) =>
                    setEditingTemplate((prev) =>
                      prev
                        ? {
                            ...prev,
                            settings: extractPresetableSettings({
                              ...settings,
                              ...prev.settings,
                              ...partial,
                            }),
                          }
                        : prev
                    )
                : updateSettings
            }
            panelSessionInfo={panelSessionInfo}
            displayConnected={displayConnected}
            panelTracks={panelTracks}
            panelFolderTracks={panelFolderTracks}
            presetSlots={presetSlots}
            activePresetSlot={activePresetSlot}
            onLoadPreset={loadPresetSlot}
            onSavePreset={async (i, name) => {
              try {
                await savePresetToSlot(i, name, extractPresetableSettings(settings));
                showToast('Preset saved');
              } catch (e) {
                showToast(`Failed to save preset: ${(e as Error).message}`, 'error');
              }
            }}
            onRenamePreset={async (i, name) => {
              try {
                await renamePresetSlot(i, name);
                showToast('Preset renamed');
              } catch (e) {
                showToast(`Failed to rename: ${(e as Error).message}`, 'error');
              }
            }}
            onDeletePreset={async (i) => {
              try {
                await deletePresetSlot(i);
                showToast('Preset deleted');
              } catch (e) {
                showToast(`Failed to delete: ${(e as Error).message}`, 'error');
              }
            }}
            onExportPresets={async () => {
              try {
                await exportPresets();
                showToast('Presets exported');
              } catch (e) {
                showToast(`Failed to export: ${(e as Error).message}`, 'error');
              }
            }}
            onImportPresets={async () => {
              try {
                await importPresets();
                showToast('Presets imported');
              } catch (e) {
                showToast(`Failed to import: ${(e as Error).message}`, 'error');
              }
            }}
            panelMemoryLocations={panelMemoryLocations}
            isSelectedSessionOpen={!!isSelectedSessionOpen || !selectedEntry}
            selectedEntry={selectedEntry}
            showRangeCaptureForTutorial={tutorialStepId === 'set-range'}
            onRefreshMixSources={() => void reloadSessionInfo()}
            onCaptureTimeline={captureRangeFromTimeline}
            onCaptureFromMarkers={captureRangeFromMarkers}
            onClearRange={clearRange}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {bounceOneAccessibilityGateModal}
      {sessionBatchGateModal}
      <LicenseGate
        defaultNaming={defaultNaming}
        shortcuts={shortcuts}
        settingsTab={settingsTab}
        onSettingsTabChange={setSettingsTab}
        onSaveNaming={(n) => {
          setDefaultNaming(n);
          showToast('Saved');
        }}
        onSetShortcut={setShortcut}
        onResetShortcut={(action) => setShortcut(action, DEFAULT_SHORTCUTS[action])}
        onResetShortcuts={() => {
          resetShortcuts();
          showToast('Reset to defaults');
        }}
        formatShortcutForDisplay={formatShortcutForDisplay}
        proToolsPrefs={proToolsPrefs}
        onSetIgnoreMissingFiles={(v) => proToolsPrefs.setIgnoreMissingFiles(v)}
        onSetIgnoreMissingPlugins={(v) => proToolsPrefs.setIgnoreMissingPlugins(v)}
        onSetIgnoreIOChange={(v) => proToolsPrefs.setIgnoreIOChange(v)}
        onSetRenameSessionAfterBatch={(v) => proToolsPrefs.setRenameSessionAfterBatch(v)}
        onSetRenameSettings={(s) => proToolsPrefs.setRenameSettings(s)}
        autoAddSessionToBatch={generalSettings.autoAddSessionToBatch}
        onSetAutoAddSessionToBatch={setAutoAddSessionToBatch}
        theme={generalSettings.theme}
        onSetTheme={setTheme}
        alwaysOnTop={generalSettings.alwaysOnTop}
        onSetAlwaysOnTop={setAlwaysOnTop}
      >
        <AccessibilitySetupModal
          open={showAccessibilityOnboarding}
          onDismiss={() => setShowAccessibilityOnboarding(false)}
        />
        <TutorialProvider
          autoStart
          connected={connected}
          sessionName={sessionName}
          onSimulateMode={handleSimulateMode}
          onBuildStemsStepReached={handleBuildStemsStepReached}
        >
          <AppContent renderMainContent={renderMainContent} setShowSettings={setShowSettings} />
          <TutorialOverlay />
        </TutorialProvider>
      </LicenseGate>
      <ErrorReportPrompt
        onSend={async () => (await window.appLog?.submitReport('')) ?? { ok: false, error: 'Not available' }}
        onSuccess={() => showToast('Report sent. Thanks for helping us improve!')}
        onError={(msg) => showToast(msg, 'error')}
      />
      <PromptModal
        open={showTemplateNamePrompt}
        title="Name this template"
        placeholder="e.g. Full Mix Stems"
        defaultValue="Untitled"
        onConfirm={handleTemplateNameConfirm}
        onCancel={() => setShowTemplateNamePrompt(false)}
      />
      {updateInfo && (
        <UpdateAvailableDialog
          version={updateInfo.version}
          releaseNotes={updateInfo.releaseNotes}
          downloading={updateDownloading}
          progress={updateProgress}
          downloaded={updateDownloaded}
          onUpdate={handleUpdateStartDownload}
          onSkip={handleUpdateSkip}
          onRestart={handleUpdateRestart}
          onClose={handleUpdateClose}
        />
      )}
    </>
  );
}

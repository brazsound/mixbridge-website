import { useState, useCallback, useRef, useEffect } from 'react';
import { ConnectionBar } from './components/ConnectionBar';
import { SettingsModal } from './components/SettingsModal';
import { StemList } from './components/StemList';
import { TechnicalPanel, type TechnicalPanelRef } from './components/TechnicalPanel';
import { RunQueueRunner } from './components/RunQueueRunner';
import { SessionsSidebar } from './components/SessionsSidebar';
import { useSessionBatchRunner } from './components/SessionBatchRunner';
import type { RunStatus, RunStatuses } from './components/RunQueueRunner';
import { TutorialProvider } from './contexts/TutorialContext';
import { TutorialOverlay } from './components/TutorialOverlay';
import { useConnection } from './hooks/useConnection';
import { useSettings, applyNamingFromConfig } from './hooks/useSettings';
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
import { useToast } from './contexts/ToastContext';
import { buildExportPayload, executeBounceItem } from './utils/bounceExecutor';
import {
  DEMO_PTX_PATH,
  DEMO_QUEUE,
  DEMO_SETTINGS,
  DEMO_SESSION_INFO,
  DEMO_TRACKS,
} from './utils/demoData';
import { LicenseGate } from './components/LicenseGate';
import { ErrorReportPrompt } from './components/ErrorReportPrompt';
import { UpdateAvailableDialog } from './components/UpdateAvailableDialog';
import type { SettingsTab } from './components/SettingsModal';
import { useTutorial } from './contexts/TutorialContext';

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
  const { shortcuts, setShortcut, resetToDefaults: resetShortcuts } = useShortcuts();
  const {
    queue, canUndo, canRedo, undo, redo,
    addBounceNormal, addBatchStems, addBounceSoloed, addBounceMuted,
    updateItemName, removeItem, reorderItems, clearQueue,
    loadQueue,
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
  const [runStatuses, setRunStatuses] = useState<RunStatuses>({});
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

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
      if (isConnectionError) {
        if (payload.manual) {
          showToast('Unable to check for updates. No update server configured.');
        }
      } else {
        showToast(`Update error: ${payload.message}`, 'error');
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
        setTimeout(addNext, 350);
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
      handleStatusChange(item.id, { state: 'running' });
      try {
        const trackListRes = await window.ptsl.getTrackList({});
        const allTrackNames = (
          (trackListRes.data as { track_list?: { name: string }[] })?.track_list ?? []
        ).map((t) => t.name);
        const payload = buildExportPayload(settings);
        await executeBounceItem(item, payload, settings.capturedRange, settings, allTrackNames);
        handleStatusChange(item.id, { state: 'done' });
      } catch (e) {
        const msg = (e as Error).message;
        handleStatusChange(item.id, { state: 'error', error: msg });
        showToast(`Bounce failed: ${msg}`, 'error');
      }
    },
    [settings, handleStatusChange, showToast]
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

  // If the selected entry is removed, deselect and clear queue + settings
  useEffect(() => {
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

    const entry = batchEntries.find(
      (e) =>
        (currentProToolsPath && e.ptxPath === currentProToolsPath) ||
        (sessionName && e.sessionName.toLowerCase() === sessionName.toLowerCase())
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
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedSessionId) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      updateBatchEntry(selectedSessionId, queue, settings);
    }, 200);
    return () => {
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = null;
        updateBatchEntry(selectedSessionId, queue, settings);
      }
    };
  }, [selectedSessionId, queue, settings, updateBatchEntry]);

  // Clear current Pro Tools path and auto-select ref when disconnected
  useEffect(() => {
    if (!connected) {
      setCurrentProToolsPath(null);
      lastAutoSelectedPtSessionRef.current = null;
    }
  }, [connected]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
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
        undo();
        return;
      }
      if (matchesShortcut(e, shortcuts.redo)) {
        e.preventDefault();
        redo();
        return;
      }
      if (matchesShortcut(e, shortcuts.mix)) {
        e.preventDefault();
        if (connected && !ptLoading) addBounceNormal(applyNamingFromConfig(defaultNaming, { name: 'Mix' }));
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
            sessionName ? { sessionName } : undefined
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
          addBounceSoloed(soloedTracks.map((t) => t.name), defaultNaming);
        } else {
          showToast('No soloed tracks — solo tracks in Pro Tools first', 'warning');
        }
        return;
      }
      if (matchesShortcut(e, shortcuts.mute)) {
        e.preventDefault();
        if (!connected || ptLoading) return;
        if (mutedTracks.length > 0) {
          addBounceMuted(mutedTracks.map((t) => t.name), defaultNaming);
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
    undo,
    redo,
    showSettings,
    showToast,
  ]);

  // ── Auto-add open session to batch ────────────────────────────────────────
  // When Pro Tools has a session open that isn't in the batch, add it automatically.
  const prevSessionNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || !sessionName) return;
    const prev = prevSessionNameRef.current;
    prevSessionNameRef.current = sessionName;
    // Skip if same session as last time (no change)
    if (prev === sessionName) return;

    const alreadyAdded = batchEntries.some(
      (e) => e.sessionName.toLowerCase() === sessionName.toLowerCase()
    );
    if (alreadyAdded) return;

    const addOpenSession = async () => {
      saveCurrentToEntry();
      const pathRes = await window.ptsl.getSessionPath();
      const ptxPath = pathRes.data?.sessionFilePath ?? '';
      if (!ptxPath) return;
      if (batchEntries.some((e) => e.ptxPath === ptxPath)) return;
      addBatchEntry(ptxPath, [], { ...settings });
    };
    void addOpenSession();
  }, [sessionName, connected, batchEntries, settings, saveCurrentToEntry, addBatchEntry]);

  // ── Add the currently open Pro Tools session to the batch ─────────────────
  const handleAddCurrentSession = useCallback(async () => {
    saveCurrentToEntry();
    const pathRes = await window.ptsl.getSessionPath();
    const ptxPath = pathRes.data?.sessionFilePath ?? '';
    if (!ptxPath) return;
    if (batchEntries.some((e) => e.ptxPath === ptxPath)) return;
    addBatchEntry(ptxPath, [], { ...settings });
  }, [settings, saveCurrentToEntry, addBatchEntry, batchEntries]);

  const handleAddSessionsViaFilePicker = useCallback(async () => {
    saveCurrentToEntry();
    const result = await window.ptslSessionBatch.pickSessions();
    if (result.canceled || !result.filePaths?.length) return;
    const existing = new Set(batchEntries.map((e) => e.ptxPath));
    const added = new Set<string>();
    for (const ptxPath of result.filePaths) {
      if (existing.has(ptxPath) || added.has(ptxPath)) continue;
      added.add(ptxPath);
      addBatchEntry(ptxPath, [], { ...settings });
    }
  }, [settings, saveCurrentToEntry, addBatchEntry, batchEntries]);

  // ── Add to Batch (from the center banner) — keeps the current queue ───────
  const handleAddToBatch = useCallback(async () => {
    saveCurrentToEntry();
    const pathRes = await window.ptsl.getSessionPath();
    const ptxPath = pathRes.data?.sessionFilePath ?? '';
    if (!ptxPath) return;
    if (batchEntries.some((e) => e.ptxPath === ptxPath)) return;
    addBatchEntry(ptxPath, [...queue], { ...settings });
  }, [queue, settings, saveCurrentToEntry, addBatchEntry, batchEntries]);

  // ── Edit button in session rows — same as clicking the row ────────────────
  const handleEditEntry = useCallback((entry: SessionEntry) => {
    handleSelectSession(entry.id);
  }, [handleSelectSession]);

  // The header strip above the queue shows which session we're editing (if any)
  const selectedEntry = batchEntries.find((e) => e.id === selectedSessionId) ?? null;

  const activeInProToolsSessionId =
    connected && (currentProToolsPath || sessionName)
      ? batchEntries.find(
          (e) =>
            (currentProToolsPath && e.ptxPath === currentProToolsPath) ||
            (sessionName && e.sessionName.toLowerCase() === sessionName.toLowerCase())
        )?.id ?? null
      : null;

  // Per-session panel data: use cached when selected session isn't open in Pro Tools
  const isSelectedSessionOpen =
    selectedEntry && currentProToolsPath && selectedEntry.ptxPath === currentProToolsPath;
  const cachedForSelected = selectedEntry ? getCached(selectedEntry.ptxPath) : null;
  const panelSessionInfo =
    selectedEntry?.ptxPath === DEMO_PTX_PATH
      ? DEMO_SESSION_INFO
      : selectedEntry && !isSelectedSessionOpen && cachedForSelected?.sessionInfo
        ? cachedForSelected.sessionInfo
        : sessionInfo;
  const panelTracks =
    selectedEntry?.ptxPath === DEMO_PTX_PATH
      ? DEMO_TRACKS
      : selectedEntry && !isSelectedSessionOpen && cachedForSelected?.tracks
        ? cachedForSelected.tracks
        : tracks;
  const panelFolderTracks = panelTracks.filter((t) => isFolderTrack(t));
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
      />

      {/* ── Main 3-column layout ── */}
      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div
          className="flex"
          style={{ flex: '1 1 0', minHeight: 0, padding: '10px', gap: '0', overflow: 'hidden' }}
        >
          {/* ── Col 1: Sessions Sidebar ── */}
          <aside
            className="glass-card shrink-0 flex flex-col"
            style={{ width: `${sidebarWidth}px`, borderRadius: '16px', padding: '14px 10px', overflow: 'hidden' }}
          >
            <div style={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <SessionsSidebar
                entries={batchEntries}
                selectedId={selectedSessionId}
                running={batchRunning}
                finished={batchFinished}
                runError={batchRunError}
                paused={batchPaused}
                connected={displayConnected}
                onSelect={handleSelectSession}
                onAddSessions={() => void handleAddSessionsViaFilePicker()}
                onAddCurrentSession={displayConnected && !simulateMode ? () => void handleAddCurrentSession() : undefined}
                currentSessionNotInList={
                  !!currentProToolsPath && !batchEntries.some((e) => e.ptxPath === currentProToolsPath)
                }
                activeInProToolsId={activeInProToolsSessionId}
                onRemoveEntry={removeBatchEntry}
                onReorderEntries={reorderBatchEntries}
                onRun={() => { saveCurrentToEntry(); void runBatch(); }}
                onRerun={rerunBatch}
                onCancel={batchCancel}
                onPause={batchPause}
                onResume={batchResume}
              />
            </div>
          </aside>

          {/* ── Resize handle: sidebar / stems ── */}
          <div
            onMouseDown={(e) => onDividerMouseDown('left', e)}
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

          {/* ── Col 2: Stems ── */}
          <div
            className="glass-card flex flex-col"
            style={{ flex: '1 1 0', minWidth: 0, borderRadius: '16px', overflow: 'hidden' }}
          >
            {/* Session context banner */}
            <div
              className="shrink-0 flex items-center justify-between gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="min-w-0">
                  {selectedEntry ? (
                    <>
                      <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--text)' }}>
                        {selectedEntry.sessionName}
                      </p>
                      <p className="text-[10px] leading-tight mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
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
                  style={{ borderColor: 'rgba(59,130,246,0.45)' }}
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
                defaultNaming={defaultNaming}
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
                onRemoveItem={removeItem}
                onReorderItems={reorderItems}
                onClearQueue={clearQueue}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
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

          {/* ── Col 3: Bounce Setup (unified) ── */}
          <div
            className="glass-card shrink-0 flex flex-col"
            style={{ width: `${rightWidth}px`, borderRadius: '16px', overflow: 'hidden' }}
          >
            <div style={{ flex: '1 1 0', overflow: 'auto', padding: '18px' }}>
                <TechnicalPanel
                ref={technicalPanelRef}
                settings={settings}
                sessionInfo={panelSessionInfo}
                connected={displayConnected}
                mixSources={panelSessionInfo.mixSources}
                tracks={panelTracks}
                folderTracks={panelFolderTracks}
                onUpdateSettings={updateSettings}
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
                memoryLocations={panelMemoryLocations}
                isSessionOpen={!!isSelectedSessionOpen || !selectedEntry}
                showRangeCaptureForTutorial={tutorialStepId === 'set-range'}
                onRefreshMixSources={() => void reloadSessionInfo()}
                onCaptureTimeline={captureRangeFromTimeline}
                onCaptureFromMarkers={captureRangeFromMarkers}
                onClearRange={clearRange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
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
      >
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

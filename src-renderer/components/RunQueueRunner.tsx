import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { QueueItem } from '../hooks/useQueue';
import { useToast } from '../contexts/ToastContext';
import type { BounceSettings } from '../hooks/useBounceSettings';
import { buildExportPayload, executeBounceItem, fileExtension } from '../utils/bounceExecutor';
import { prepareSoloLatchForBounceRun, queueHasBatchStems } from '../utils/soloLatchAutomation';
import { usePreBounceAccessibilityGate } from '../hooks/usePreBounceAccessibilityGate';
import { captureTrackSoloSnapshot, restoreTrackSoloSnapshot } from '../utils/soloTrackSnapshot';

interface RunQueueRunnerProps {
  queue: QueueItem[];
  connected: boolean;
  settings: BounceSettings;
  onStatusChange: (id: string, status: RunStatus) => void;
  onRunStart: () => void;
  /** When true, Run button shows enabled but actual bounce is blocked (tutorial simulate mode) */
  simulateMode?: boolean;
  /** Called when user clicks Run in simulate mode */
  onSimulateBlocked?: (msg: string, type?: 'warning' | 'error') => void;
  /** Render a compact inline button instead of the full-width panel button */
  compact?: boolean;
  /** Ref to scroll to a specific queue item row by id */
  onScrollToItem?: (id: string) => void;
}

export interface RunStatus {
  state: 'idle' | 'running' | 'done' | 'error';
  error?: string;
}

export type RunStatuses = Record<string, RunStatus>;

// ─────────────────────────────────────────────────────────────────────────────

export function RunQueueRunner({ queue, connected, settings, onStatusChange, onRunStart, simulateMode = false, onSimulateBlocked, compact, onScrollToItem }: RunQueueRunnerProps) {
  const { showToast } = useToast();
  const { requestGate, gateModal } = usePreBounceAccessibilityGate();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runErrorItemId, setRunErrorItemId] = useState<string | null>(null);
  const [runErrorDetail, setRunErrorDetail] = useState<string | null>(null);
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [finished, setFinished] = useState(false);

  // Track whether files were already found to exist before the last run.
  // Using separate state for "awaiting confirmation" and the list of conflicting names.
  const [conflictingFiles, setConflictingFiles] = useState<string[]>([]);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  // Use a ref to track live running state so the queue-change effect
  // doesn't reset flags mid-run or immediately after a run completes.
  const runningRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const pauseRequestedRef = useRef(false);
  /** Restore Options → Solo Mode after non–solo-bounce runs (macOS UI scripting). */
  const soloLatchRestoreRef = useRef<(() => Promise<void>) | null>(null);
  /** Restore per-track solo flags after batch stem runs (user may have had a multi-solo combo). */
  const batchSoloSnapshotRef = useRef<Map<string, boolean> | null>(null);
  /** When user bounces without Accessibility: isolate one stem per item; no snapshot restore. */
  const legacyBatchStemRunRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [resumeFromIndex, setResumeFromIndex] = useState(0);

  const { capturedRange } = settings;

  // Reset warning state whenever the queue changes (rename / add / remove).
  // We intentionally exclude `running` — it caused hasCompletedRun to be
  // cleared right after every successful run.
  const runSoloLatchRestore = useCallback(async () => {
    const fn = soloLatchRestoreRef.current;
    soloLatchRestoreRef.current = null;
    if (fn) await fn();
  }, []);

  const runBatchSoloRestore = useCallback(async () => {
    const snap = batchSoloSnapshotRef.current;
    batchSoloSnapshotRef.current = null;
    if (snap) await restoreTrackSoloSnapshot(snap);
  }, []);

  useEffect(() => {
    if (!runningRef.current) {
      if (!paused) {
        void runBatchSoloRestore();
        void runSoloLatchRestore();
      }
      setConflictingFiles([]);
      setAwaitingConfirm(false);
      setFinished(false);
      setRunError(null);
      setRunErrorItemId(null);
      setRunErrorDetail(null);
      setErrorExpanded(false);
      setPaused(false);
      setResumeFromIndex(0);
    }
  }, [queue, paused, runSoloLatchRestore, runBatchSoloRestore]);

  let disabledReason = '';
  if (!connected) disabledReason = 'Connect to Pro Tools first';
  else if (queue.length === 0) disabledReason = 'Add bounces to queue (Step 2)';
  else if (!capturedRange) disabledReason = 'Capture a range first (Step 3)';
  else if (settings.mixSources.length === 0) disabledReason = 'Select at least one mix source';

  const canRun =
    (connected && queue.length > 0 && !!capturedRange && settings.mixSources.length > 0 && !running && !paused) ||
    (simulateMode && queue.length > 0 && !running && !paused);
  const canResume = paused && connected && queue.length > 0 && !!capturedRange && settings.mixSources.length > 0;

  const executeRun = useCallback(async (startIndex = 0) => {
    if (!window.ptsl || !capturedRange || queue.length === 0) return;

    if (startIndex === 0) {
      const gate = await requestGate(queue);
      if (gate === 'abort') return;
      legacyBatchStemRunRef.current = gate === 'legacy';
    }

    const payload = buildExportPayload(settings);

    runningRef.current = true;
    cancelRequestedRef.current = false;
    pauseRequestedRef.current = false;
    setRunning(true);
    setFinished(false);
    setRunError(null);
    setPaused(false);
    setAwaitingConfirm(false);
    onRunStart();

    if (startIndex === 0) {
      soloLatchRestoreRef.current = null;
      batchSoloSnapshotRef.current = null;
      const { restore } = await prepareSoloLatchForBounceRun(queue);
      soloLatchRestoreRef.current = restore;
      if (queueHasBatchStems(queue) && !legacyBatchStemRunRef.current) {
        batchSoloSnapshotRef.current = await captureTrackSoloSnapshot();
      }
    }

    const trackListRes = await window.ptsl.getTrackList({});
    const allTrackNames = (
      (trackListRes.data as { track_list?: { name: string }[] })?.track_list ?? []
    ).map((t) => t.name);

    const finishRunSideEffects = async () => {
      await runBatchSoloRestore();
      await runSoloLatchRestore();
    };

    for (let i = startIndex; i < queue.length; i++) {
      if (cancelRequestedRef.current) {
        await finishRunSideEffects();
        runningRef.current = false;
        setRunning(false);
        return;
      }

      const item = queue[i];
      onStatusChange(item.id, { state: 'running' });

      if (i > startIndex) {
        await new Promise<void>((resolve) => setTimeout(resolve, 400));
      }

      try {
        await executeBounceItem(item, payload, capturedRange, settings, allTrackNames, i === 0, {
          legacyBatchStemIsolation: legacyBatchStemRunRef.current,
        });
        onStatusChange(item.id, { state: 'done' });

        if (pauseRequestedRef.current) {
          setPaused(true);
          setResumeFromIndex(i + 1);
          runningRef.current = false;
          setRunning(false);
          return;
        }
      } catch (e) {
        const msg = (e as Error).message;
        onStatusChange(item.id, { state: 'error', error: msg });
        setRunError(`"${item.outputName}" failed to bounce.`);
        setRunErrorItemId(item.id);
        setRunErrorDetail(msg);
        setErrorExpanded(false);
        await finishRunSideEffects();
        runningRef.current = false;
        setRunning(false);
        return;
      }
    }

    await finishRunSideEffects();
    runningRef.current = false;
    setRunning(false);
    const completed = !cancelRequestedRef.current;
    setFinished(completed);

    if (completed && window.notifications && window.app?.sendBounceCompleteNotification) {
      const config = await window.notifications.load();
      if (config.iMessageEnabled && config.phoneNumber?.trim()) {
        const sessionRes = await window.ptsl?.getSessionName();
        const sessionName = (sessionRes?.data as { session_name?: string })?.session_name ?? 'Session';
        const result = await window.app.sendBounceCompleteNotification({
          sessionName,
          phoneNumber: config.phoneNumber.trim(),
        });
        if (!result.ok) {
          showToast('Notification failed — check your iMessage settings.', 'error');
        }
      }
    }
  }, [
    queue,
    settings,
    capturedRange,
    onStatusChange,
    onRunStart,
    showToast,
    runSoloLatchRestore,
    runBatchSoloRestore,
    requestGate,
  ]);

  const handleCancel = useCallback(() => {
    if (runningRef.current) {
      cancelRequestedRef.current = true;
    } else if (paused) {
      setPaused(false);
      setResumeFromIndex(0);
    }
  }, [paused]);

  const handlePause = useCallback(() => {
    if (runningRef.current) pauseRequestedRef.current = true;
  }, []);

  const handleResume = useCallback(() => {
    if (!canResume) return;
    void executeRun(resumeFromIndex);
  }, [canResume, resumeFromIndex, executeRun]);

  const executeMockRun = useCallback(async () => {
    if (queue.length === 0) return;
    setRunning(true);
    setFinished(false);
    setRunError(null);
    onRunStart();
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      onStatusChange(item.id, { state: 'running' });
      if (i > 0) await new Promise<void>((r) => setTimeout(r, 400));
      onStatusChange(item.id, { state: 'done' });
    }
    setRunning(false);
    setFinished(true);
  }, [queue, onStatusChange, onRunStart]);

  // Resolve folders per item and check for conflicts.
  const checkAndRun = useCallback(async () => {
    if (!canRun) return;
    if (simulateMode) {
      void executeMockRun();
      return;
    }
    if (!window.ptsl) return;
    setConflictingFiles([]);

    const pathRes = await window.ptsl.getSessionPath();
    const sessionFilePath = pathRes.data?.sessionFilePath ?? '';
    const sessionFolder = sessionFilePath.replace(/\/[^/]+$/, '');
    const defaultBounceFolder =
      settings.destination === 'custom' && settings.customPath
        ? settings.customPath
        : sessionFilePath
          ? `${sessionFolder}/Bounced Files`
          : '';

    const ext = fileExtension(settings.fileType);
    const folderToFiles = new Map<string, string[]>();

    for (const item of queue) {
      const folder = item.customFolderPath ?? defaultBounceFolder;
      if (!folder) continue;
      const safe = item.outputName.replace(/[/\\:*?"<>|]/g, '_');
      const names: string[] = [];
      if (settings.mixSources.length <= 1) {
        names.push(`${safe}${ext}`);
      } else {
        for (const s of settings.mixSources) {
          names.push(`${safe} (${s.name})${ext}`);
        }
      }
      if (settings.addMP3 && settings.fileType !== 3) {
        const base = safe.replace(/\.[^.]+$/, '') || safe;
        if (settings.mixSources.length <= 1) {
          names.push(`${base}.mp3`);
        } else {
          for (const s of settings.mixSources) {
            names.push(`${base} (${s.name}).mp3`);
          }
        }
      }
      const existing = folderToFiles.get(folder) ?? [];
      folderToFiles.set(folder, [...existing, ...names]);
    }

    for (const [folder, fileNames] of folderToFiles) {
      if (fileNames.length === 0) continue;
      const { existing } = await window.ptsl.checkFilesExist(folder, fileNames);
      if (existing.length > 0) {
        setConflictingFiles(existing);
        setAwaitingConfirm(true);
        return;
      }
    }

    void executeRun();
  }, [canRun, simulateMode, executeMockRun, settings, queue, executeRun]);

  const buttonLabel = running
    ? 'Bouncing…'
    : paused
    ? `Paused — ${queue.length - resumeFromIndex} bounce${queue.length - resumeFromIndex !== 1 ? 's' : ''} left`
    : disabledReason || `Run ${queue.length} bounce${queue.length !== 1 ? 's' : ''}`;

  const btnBase = compact ? 'px-3 py-1.5 text-xs' : 'py-2.5 text-sm';
  const btnRadius = compact ? '8px' : '12px';

  return (
    <>
      {gateModal}
    <div className="space-y-2">
      {runError && (
        <div
          className="px-3 py-2 rounded-lg space-y-1.5"
          style={{
            color: 'var(--danger)',
            background: 'var(--danger-soft)',
            border: '1px solid rgba(255,69,58,0.25)',
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] leading-snug break-words flex-1">
              {runError}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {runErrorItemId && onScrollToItem && (
                <button
                  type="button"
                  onClick={() => onScrollToItem(runErrorItemId)}
                  className="text-[10px] font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--danger)' }}
                >
                  Jump to item
                </button>
              )}
              {runErrorDetail && (
                <button
                  type="button"
                  onClick={() => setErrorExpanded((v) => !v)}
                  className="text-[10px] font-medium hover:opacity-80 transition-opacity flex items-center gap-0.5"
                  style={{ color: 'var(--danger)' }}
                  aria-expanded={errorExpanded}
                >
                  {errorExpanded ? '▾' : '▸'} Details
                </button>
              )}
            </div>
          </div>
          {errorExpanded && runErrorDetail && (
            <p
              className="text-[10px] font-mono break-all leading-snug px-2 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,69,58,0.1)', color: 'var(--danger)' }}
            >
              {runErrorDetail}
            </p>
          )}
        </div>
      )}
      {finished && !running && !runError && (
        <p
          className="text-[11px] px-3 py-2 rounded-lg text-center"
          style={{ color: 'var(--success)', background: 'var(--success-soft)' }}
        >
          All bounces complete!
        </p>
      )}
      {paused && !runError && (
        <p
          className="text-[11px] px-3 py-2 rounded-lg text-center"
          style={{ color: 'var(--warning)', background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.25)' }}
        >
          Paused — make adjustments in Pro Tools, then Resume to continue.
        </p>
      )}

      <div className={`flex gap-2 ${compact ? 'flex-wrap' : ''}`}>
        {running ? (
          <>
            <button
              type="button"
              disabled
              className={`btn-glass ${btnBase} font-semibold shrink-0 flex items-center justify-center gap-1.5`}
              style={{
                borderRadius: btnRadius,
                flex: compact ? undefined : 1,
                cursor: 'default',
              }}
            >
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Bouncing…
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className={`btn-glass ${btnBase} shrink-0`}
              style={{ borderRadius: btnRadius }}
              title="Stop after current bounce completes"
            >
              Stop
            </button>
            <button
              type="button"
              onClick={handlePause}
              className={`btn-glass ${btnBase} shrink-0`}
              style={{ borderRadius: btnRadius }}
              title="Pause after current bounce to make adjustments"
            >
              Pause
            </button>
          </>
        ) : paused ? (
          <>
            <button
              type="button"
              onClick={handleResume}
              className={`btn-accent ${btnBase} font-semibold shrink-0`}
              style={{
                borderRadius: btnRadius,
                flex: compact ? undefined : 1,
              }}
            >
              Resume
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className={`btn-glass ${btnBase} shrink-0`}
              style={{ borderRadius: btnRadius }}
              title="Cancel and clear pause"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            data-tutorial="run"
            onClick={() => void checkAndRun()}
            disabled={!canRun}
            title={disabledReason || undefined}
            className={`${compact ? '' : 'w-full'} ${canRun ? 'btn-accent' : 'btn-glass'} ${btnBase} font-semibold transition-all`}
            style={{
              borderRadius: btnRadius,
              flex: compact ? undefined : 1,
              opacity: canRun ? 1 : 0.55,
              whiteSpace: 'nowrap',
              cursor: canRun ? 'pointer' : 'not-allowed',
            }}
          >
            {buttonLabel}
          </button>
        )}
      </div>

      {/* Overwrite confirmation modal — rendered via portal to escape backdrop-filter stacking context */}
      {awaitingConfirm && !running && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onClick={() => { setAwaitingConfirm(false); setConflictingFiles([]); }}
          />

          <div
            className="modal-panel relative z-10 w-full max-w-md mx-4 rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,159,10,0.4)' }}
          >

            {/* Header */}
            <div className="px-5 py-4 flex items-start gap-3" style={{ borderBottom: '1px solid var(--divider)' }}>
              <div
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.3)' }}
              >
                <svg className="w-4 h-4" style={{ color: 'var(--warning)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  Files will be overwritten
                </h3>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {conflictingFiles.length} file{conflictingFiles.length !== 1 ? 's' : ''} already exist in the output folder.
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <div
                className="px-3 py-2.5 max-h-36 overflow-y-auto space-y-1 rounded-xl"
                style={{ background: 'var(--surface-pressed)', border: '1px solid var(--divider)' }}
              >
                {conflictingFiles.map((f) => (
                  <p key={f} className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                    {f}
                  </p>
                ))}
              </div>
              <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
                Cancel and rename the stems in your queue to keep the existing files.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--divider)' }}>
              <button
                type="button"
                onClick={() => { setAwaitingConfirm(false); setConflictingFiles([]); }}
                className="btn-glass flex-1 justify-center py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeRun()}
                className="flex-1 py-2 text-sm font-semibold rounded-xl transition-all"
                style={{
                  background: 'var(--warning)',
                  color: 'var(--bg)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                Overwrite &amp; Run
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
    </>
  );
}

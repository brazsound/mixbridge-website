import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { QueueItem } from '../hooks/useQueue';
import type { BounceSettings } from '../hooks/useBounceSettings';
import { buildExportPayload, executeBounceItem, fileExtension } from '../utils/bounceExecutor';

export interface RunStatus {
  state: 'idle' | 'running' | 'done' | 'error';
  error?: string;
}

export type RunStatuses = Record<string, RunStatus>;

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
}

// ─────────────────────────────────────────────────────────────────────────────

export function RunQueueRunner({ queue, connected, settings, onStatusChange, onRunStart, simulateMode = false, onSimulateBlocked, compact }: RunQueueRunnerProps) {
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
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

  const [paused, setPaused] = useState(false);
  const [resumeFromIndex, setResumeFromIndex] = useState(0);

  const { capturedRange } = settings;

  // Reset warning state whenever the queue changes (rename / add / remove).
  // We intentionally exclude `running` — it caused hasCompletedRun to be
  // cleared right after every successful run.
  useEffect(() => {
    if (!runningRef.current) {
      setConflictingFiles([]);
      setAwaitingConfirm(false);
      setFinished(false);
      setRunError(null);
      setPaused(false);
      setResumeFromIndex(0);
    }
  }, [queue]);

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

    const trackListRes = await window.ptsl.getTrackList({});
    const allTrackNames = (
      (trackListRes.data as { track_list?: { name: string }[] })?.track_list ?? []
    ).map((t) => t.name);

    for (let i = startIndex; i < queue.length; i++) {
      if (cancelRequestedRef.current) {
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
        await executeBounceItem(item, payload, capturedRange, settings, allTrackNames, i === 0);
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
        setRunError(`"${item.outputName}" failed — see above for details.`);
        runningRef.current = false;
        setRunning(false);
        return;
      }
    }

    runningRef.current = false;
    setRunning(false);
    setFinished(!cancelRequestedRef.current);
  }, [queue, settings, capturedRange, onStatusChange, onRunStart]);

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

  // Resolve the folder where bounces will land, then check for conflicts.
  const checkAndRun = useCallback(async () => {
    if (!canRun) return;
    if (simulateMode) {
      void executeMockRun();
      return;
    }
    if (!window.ptsl) return;
    setConflictingFiles([]);

    let bounceFolder = '';
    if (settings.destination === 'custom' && settings.customPath) {
      bounceFolder = settings.customPath;
    } else {
      // Ask Pro Tools for the session file path, then derive the bounce folder.
      const pathRes = await window.ptsl.getSessionPath();
      const sessionFilePath = pathRes.data?.sessionFilePath ?? '';
      if (sessionFilePath) {
        // Session file is e.g. /path/to/Session/Session.ptx
        // Bounced Files go in /path/to/Session/Bounced Files/
        const sessionFolder = sessionFilePath.replace(/\/[^/]+$/, '');
        bounceFolder = `${sessionFolder}/Bounced Files`;
      }
    }

    if (bounceFolder) {
      const ext = fileExtension(settings.fileType);
      const fileNames: string[] = [];
      for (const item of queue) {
        const safe = item.outputName.replace(/[/\\:*?"<>|]/g, '_');
        if (settings.mixSources.length <= 1) {
          fileNames.push(`${safe}${ext}`);
        } else {
          for (const s of settings.mixSources) {
            fileNames.push(`${safe} (${s.name})${ext}`);
          }
        }
      }
      if (settings.addMP3 && settings.fileType !== 3) {
        for (const item of queue) {
          const safe = item.outputName.replace(/[/\\:*?"<>|]/g, '_');
          const base = safe.replace(/\.[^.]+$/, '') || safe;
          if (settings.mixSources.length <= 1) {
            fileNames.push(`${base}.mp3`);
          } else {
            for (const s of settings.mixSources) {
              fileNames.push(`${base} (${s.name}).mp3`);
            }
          }
        }
      }
      const { existing } = await window.ptsl.checkFilesExist(bounceFolder, fileNames);
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
    <div className="space-y-2">
      {runError && (
        <p
          className="text-[11px] leading-snug break-words px-2 py-1.5 rounded-lg"
          style={{
            color: '#ff8a80',
            background: 'var(--danger-soft)',
            border: '1px solid rgba(255,69,58,0.2)',
          }}
        >
          {runError}
        </p>
      )}
      {finished && !running && !runError && (
        <p
          className="text-[11px] px-2 py-1 rounded-lg text-center"
          style={{ color: 'var(--success)', background: 'var(--success-soft)' }}
        >
          All bounces complete!
        </p>
      )}
      {paused && !runError && (
        <p
          className="text-[11px] px-2 py-1 rounded-lg text-center"
          style={{ color: '#ffd580', background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.25)' }}
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
              className={`${btnBase} font-semibold transition-all shrink-0`}
              style={{
                borderRadius: btnRadius,
                flex: compact ? undefined : 1,
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
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
              title="Stop after current bounce"
            >
              Cancel
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
              className={`${btnBase} font-semibold transition-all shrink-0`}
              style={{
                borderRadius: btnRadius,
                flex: compact ? undefined : 1,
                background: 'var(--accent)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 0 16px var(--accent-glow)',
                cursor: 'pointer',
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
            className={`${compact ? '' : 'w-full'} ${btnBase} font-semibold transition-all`}
            style={{
              borderRadius: btnRadius,
              flex: compact ? undefined : 1,
              background: canRun
                ? 'var(--accent)'
                : 'rgba(255,255,255,0.06)',
              color: canRun ? '#fff' : 'var(--text-muted)',
              border: canRun
                ? '1px solid rgba(255,255,255,0.15)'
                : '1px solid rgba(255,255,255,0.08)',
              boxShadow: canRun ? '0 0 16px var(--accent-glow)' : 'none',
              cursor: canRun ? 'pointer' : 'not-allowed',
              opacity: canRun ? 1 : 0.55,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
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
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onClick={() => { setAwaitingConfirm(false); setConflictingFiles([]); }}
          />

          <div
            className="relative z-10 w-full max-w-md mx-4 p-6 space-y-4"
            style={{
              borderRadius: '20px',
              background: 'rgba(28, 20, 0, 0.85)',
              border: '1px solid rgba(255,159,10,0.35)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,159,10,0.1) inset',
            }}
          >
            {/* Top gleam */}
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                borderRadius: '20px 20px 0 0',
                background: 'linear-gradient(90deg, transparent, rgba(255,159,10,0.4), transparent)',
              }}
            />

            <div className="flex items-start gap-3">
              <div
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.3)' }}
              >
                <svg className="w-5 h-5" style={{ color: 'var(--warning)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: '#ffd580' }}>
                  Files will be overwritten
                </h3>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: 'rgba(255,213,128,0.65)' }}>
                  {conflictingFiles.length} file{conflictingFiles.length !== 1 ? 's' : ''} with the same name already exist{conflictingFiles.length === 1 ? 's' : ''} in the output folder.
                </p>
              </div>
            </div>

            <div
              className="px-3 py-2.5 max-h-36 overflow-y-auto space-y-1 rounded-xl"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,159,10,0.15)',
              }}
            >
              {conflictingFiles.map((f) => (
                <p key={f} className="text-xs font-mono truncate" style={{ color: '#ffd580' }}>
                  {f}
                </p>
              ))}
            </div>

            <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
              To keep the existing files, cancel and rename the stems in your queue first.
            </p>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => { setAwaitingConfirm(false); setConflictingFiles([]); }}
                className="btn-glass flex-1 justify-center"
                style={{ borderRadius: '10px', padding: '9px 12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeRun()}
                className="flex-1 text-sm font-semibold transition-all"
                style={{
                  borderRadius: '10px',
                  padding: '9px 12px',
                  background: 'var(--warning)',
                  color: '#000',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 0 12px rgba(255,159,10,0.4)',
                }}
              >
                Overwrite &amp; Run
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

import { useState, useCallback, useRef } from 'react';
import type { SessionEntry, SessionEntryStatus } from '../hooks/useSessionBatch';
import type { CachedSessionScan } from '../hooks/useSessionScanCache';
import type { ProToolsPreferences } from '../hooks/useProToolsPreferences';
import { buildExportPayload, executeBounceItem } from '../utils/bounceExecutor';
import { prepareSoloLatchForBounceRun, queueHasBatchStems } from '../utils/soloLatchAutomation';
import { captureTrackSoloSnapshot, restoreTrackSoloSnapshot } from '../utils/soloTrackSnapshot';
import { usePreBounceAccessibilityGate } from '../hooks/usePreBounceAccessibilityGate';

interface SessionBatchRunnerProps {
  entries: SessionEntry[];
  onUpdateStatus: (id: string, status: SessionEntryStatus, error?: string) => void;
  onResetStatuses: () => void;
  /** Called when a session is opened during batch run — caches scan data for later editing. */
  onCacheSessionScan?: (ptxPath: string, data: CachedSessionScan) => void;
  /** When true, pass behavior_options to suppress missing files/plugins/IO dialogs (Pro Tools 2025.06+). */
  suppressDialogs?: boolean;
  /** When provided and renameSessionAfterBatch is true, save session with new name before closing. */
  sessionRenamePrefs?: Pick<
    ProToolsPreferences,
    'renameSessionAfterBatch' | 'renameMode' | 'renameCustomName' | 'renamePrefix' | 'renameSuffix'
  >;
}

/** Sanitize session name for Pro Tools (remove invalid path chars). */
function sanitizeSessionName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'Session';
}

/** Compute new session name from prefs and current session name. */
function computeNewSessionName(
  currentName: string,
  prefs: NonNullable<SessionBatchRunnerProps['sessionRenamePrefs']>
): string {
  if (prefs.renameMode === 'custom') {
    const custom = (prefs.renameCustomName ?? '').trim();
    return custom ? sanitizeSessionName(custom) : currentName;
  }
  if (prefs.renameMode === 'prefix') {
    const prefix = (prefs.renamePrefix ?? '').trim();
    return sanitizeSessionName(prefix + currentName);
  }
  // suffix
  const suffix = (prefs.renameSuffix ?? '').trim();
  return sanitizeSessionName(currentName + suffix);
}

/** Poll Pro Tools until GetSessionName returns a name that includes the expected basename, or timeout. */
async function waitForSessionOpen(expectedBasename: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const poll = 1_500;
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, poll));
    try {
      const res = await window.ptsl.getSessionName();
      const name = res.data?.session_name ?? '';
      if (name && (name.toLowerCase().includes(expectedBasename.toLowerCase()) || name !== '')) {
        return;
      }
    } catch {
      // keep polling
    }
  }
  throw new Error(
    `Timed out waiting for session "${expectedBasename}" to open. Make sure the session opened in Pro Tools, then try again.`
  );
}

export function useSessionBatchRunner({
  entries,
  onUpdateStatus,
  onResetStatuses,
  onCacheSessionScan,
  suppressDialogs = true,
  sessionRenamePrefs,
}: SessionBatchRunnerProps) {
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const cancelRequestedRef = useRef(false);
  const pauseRequestedRef = useRef(false);
  const legacyBatchStemRunRef = useRef(false);

  const { requestGate, gateModal: sessionBatchGateModal } = usePreBounceAccessibilityGate();

  const runAll = useCallback(async () => {
    if (running || entries.length === 0) return;

    const pendingEntries = entries.filter((e) => e.status !== 'done');
    if (pendingEntries.length === 0) {
      // All already done — offer re-run by resetting first
      onResetStatuses();
      return;
    }

    const combinedQueue = pendingEntries.flatMap((e) => e.queue);
    const gate = await requestGate(combinedQueue);
    if (gate === 'abort') return;
    legacyBatchStemRunRef.current = gate === 'legacy';

    setRunning(true);
    setFinished(false);
    setRunError(null);
    setPaused(false);
    cancelRequestedRef.current = false;
    pauseRequestedRef.current = false;

    for (const entry of pendingEntries) {
      if (cancelRequestedRef.current) break;
      onUpdateStatus(entry.id, 'running');

      try {
        if (!entry.settings.capturedRange) {
          throw new Error('No bounce range captured for this session. Edit the entry and capture a range first.');
        }

        // 1. Open the session (suppressDialogs = pass behavior_options to skip missing files/plugins/IO dialogs)
        const openRes = await window.ptsl.openSession(entry.ptxPath, { suppressDialogs });
        if (!openRes.success) {
          throw new Error(openRes.error ?? 'Failed to open session');
        }

        // 2. Wait for the session to be ready
        await waitForSessionOpen(entry.sessionName);

        // 2b. Cache session scan data for later editing (mix sources, tracks, markers)
        if (onCacheSessionScan) {
          try {
            const [srRes, bdRes, outRes, busRes, trackRes, memRes] = await Promise.all([
              window.ptsl.getSessionSampleRate(),
              window.ptsl.getSessionBitDepth(),
              window.ptsl.getExportMixSourceList('EMSType_Output'),
              window.ptsl.getExportMixSourceList('EMSType_Bus'),
              window.ptsl.getTrackList({}),
              window.ptsl.getMemoryLocations({}),
            ]);
            const srData = srRes?.data as { sample_rate?: string } | null;
            const bdData = bdRes?.data as { bit_depth?: string } | null;
            const outData = outRes?.data as { source_list?: string[] } | null;
            const busData = busRes?.data as { source_list?: string[] } | null;
            const trackData = trackRes?.data as { track_list?: unknown[] } | null;
            const memData = memRes?.data as { memory_locations?: unknown[] } | null;

            const parseSR = (r: string | undefined) => {
              const m: Record<string, { hz: number; label: string }> = {
                SR_44100: { hz: 44100, label: '44.1 kHz' }, SR_48000: { hz: 48000, label: '48 kHz' },
                SR_88200: { hz: 88200, label: '88.2 kHz' }, SR_96000: { hz: 96000, label: '96 kHz' },
                SRate_44100: { hz: 44100, label: '44.1 kHz' }, SRate_48000: { hz: 48000, label: '48 kHz' },
              };
              return m[r ?? ''] ?? { hz: 0, label: '' };
            };
            const parseBD = (b: string | undefined) => {
              const m: Record<string, { bits: number; label: string }> = {
                Bit16: { bits: 16, label: '16-bit' }, Bit24: { bits: 24, label: '24-bit' },
                Bit32Float: { bits: 32, label: '32-bit float' },
              };
              return m[b ?? ''] ?? { bits: 0, label: '' };
            };
            const { hz: sampleRate, label: sampleRateLabel } = parseSR(srData?.sample_rate);
            const { bits: bitDepth, label: bitDepthLabel } = parseBD(bdData?.bit_depth);
            const mixSources = [
              { sourceType: 4, sourceTypeName: 'EMSType_Renderer', name: 'Renderer', description: 'Atmos renderer / main monitoring path' },
              ...(outData?.source_list ?? []).map((n: string) => ({ sourceType: 3, sourceTypeName: 'EMSType_Output', name: n, description: 'Output bus' })),
              ...(busData?.source_list ?? []).map((n: string) => ({ sourceType: 2, sourceTypeName: 'EMSType_Bus', name: n, description: 'Internal bus' })),
            ];
            const tracks = (trackData?.track_list ?? []) as CachedSessionScan['tracks'];
            const memoryLocations = (memData?.memory_locations ?? []) as CachedSessionScan['memoryLocations'];
            onCacheSessionScan(entry.ptxPath, {
              sessionInfo: { sampleRate, sampleRateLabel, bitDepth, bitDepthLabel, mixSources },
              tracks,
              memoryLocations,
              scannedAt: new Date().toISOString(),
            } as CachedSessionScan);
          } catch {
            // Non-fatal: continue with bounce
          }
        }

        // 3. Get track list for solo/mute operations
        const trackListRes = await window.ptsl.getTrackList({});
        const allTrackNames = (
          (trackListRes.data as { track_list?: { name: string }[] })?.track_list ?? []
        ).map((t) => t.name);

        // 4. Run all bounce jobs in sequence
        if (entry.settings.mixSources.length === 0) {
          throw new Error('No mix sources selected — open this session and select outputs in Routing & Format.');
        }
        const payload = buildExportPayload(entry.settings);
        const { restore: restoreSoloMode } = await prepareSoloLatchForBounceRun(entry.queue);
        const batchSoloSnapshot =
          queueHasBatchStems(entry.queue) && !legacyBatchStemRunRef.current
            ? await captureTrackSoloSnapshot()
            : null;
        try {
          for (let i = 0; i < entry.queue.length; i++) {
            const item = entry.queue[i];
            if (i > 0) await new Promise<void>((r) => setTimeout(r, 400));
            await executeBounceItem(item, payload, entry.settings.capturedRange!, entry.settings, allTrackNames, i === 0, {
              legacyBatchStemIsolation: legacyBatchStemRunRef.current,
            });
          }
        } finally {
          await restoreTrackSoloSnapshot(batchSoloSnapshot);
          await restoreSoloMode();
        }

        // 5. Optionally rename (Save As) then save and close
        if (sessionRenamePrefs?.renameSessionAfterBatch) {
          const newName = computeNewSessionName(entry.sessionName, sessionRenamePrefs);
          if (newName && newName !== entry.sessionName) {
            const sessionLocation = entry.ptxPath.replace(/[/\\][^/\\]+$/, '');
            const saveAsRes = await window.ptsl.saveSessionAs(newName, sessionLocation);
            if (!saveAsRes.success) {
              console.warn(`[SessionBatch] Failed to rename session "${entry.sessionName}" to "${newName}":`, saveAsRes.error);
            }
          }
        }

        const closeRes = await window.ptsl.closeSession(true);
        if (!closeRes.success) {
          // Non-fatal: bounces are done; just warn
          console.warn(`[SessionBatch] Failed to close session "${entry.sessionName}":`, closeRes.error);
        }

        onUpdateStatus(entry.id, 'done');

        if (pauseRequestedRef.current) {
          setPaused(true);
          setRunning(false);
          return;
        }

        // Small gap between sessions
        await new Promise<void>((r) => setTimeout(r, 1_000));

      } catch (e) {
        const msg = (e as Error).message;
        onUpdateStatus(entry.id, 'error', msg);
        setRunError(`Session "${entry.sessionName}" failed — ${msg}`);
        setRunning(false);
        return;
      }
    }

    setRunning(false);
    setFinished(!cancelRequestedRef.current);
  }, [
    entries,
    running,
    onUpdateStatus,
    onResetStatuses,
    onCacheSessionScan,
    suppressDialogs,
    sessionRenamePrefs,
    requestGate,
  ]);

  const rerun = useCallback(() => {
    onResetStatuses();
    setFinished(false);
    setRunError(null);
  }, [onResetStatuses]);

  const handleCancel = useCallback(() => {
    if (running) {
      cancelRequestedRef.current = true;
    } else if (paused) {
      setPaused(false);
    }
  }, [running, paused]);

  const handlePause = useCallback(() => {
    if (running) pauseRequestedRef.current = true;
  }, [running]);

  const handleResume = useCallback(() => {
    if (paused) {
      setPaused(false);
      void runAll();
    }
  }, [paused, runAll]);

  return { running, finished, runError, paused, runAll, rerun, handleCancel, handlePause, handleResume, sessionBatchGateModal };
}

// ── UI component rendered inside the Batch view sidebar ──────────────────────

interface SessionBatchRunButtonProps {
  entries: SessionEntry[];
  running: boolean;
  finished: boolean;
  runError: string | null;
  paused: boolean;
  onRun: () => void;
  onRerun: () => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function SessionBatchRunButton({
  entries,
  running,
  finished,
  runError,
  paused,
  onRun,
  onRerun,
  onCancel,
  onPause,
  onResume,
}: SessionBatchRunButtonProps) {
  const pendingCount = entries.filter((e) => e.status !== 'done').length;
  const canRun = !running && !paused && entries.length > 0;
  const canResume = paused && entries.length > 0;

  let label = '';
  if (running) {
    label = 'Running…';
  } else if (paused) {
    label = `Paused — ${pendingCount} session${pendingCount !== 1 ? 's' : ''} left`;
  } else if (finished && !runError) {
    label = 'All done!';
  } else if (entries.length === 0) {
    label = 'No sessions queued';
  } else {
    label = `Run ${pendingCount} session${pendingCount !== 1 ? 's' : ''}`;
  }

  return (
    <div className="space-y-2">
      {runError && (
        <p
          className="text-[11px] leading-snug break-words px-2 py-1.5 rounded-lg"
          style={{ color: '#ff8a80', background: 'var(--danger-soft)', border: '1px solid rgba(255,69,58,0.2)' }}
        >
          {runError}
        </p>
      )}
      {finished && !running && !runError && (
        <p
          className="text-[11px] px-2 py-1 rounded-lg text-center"
          style={{ color: 'var(--success)', background: 'var(--success-soft)' }}
        >
          All sessions complete!
        </p>
      )}
      {paused && !runError && (
        <p
          className="text-[11px] px-2 py-1 rounded-lg text-center"
          style={{ color: '#ffd580', background: 'var(--warning-soft)', border: '1px solid rgba(255,159,10,0.25)' }}
        >
          Paused — make adjustments, then Resume to continue.
        </p>
      )}

      {finished && !runError && (
        <button type="button" onClick={onRerun} className="w-full btn-glass text-xs justify-center">
          Reset &amp; Run Again
        </button>
      )}

      <div className="flex gap-2 flex-wrap">
        {running ? (
          <>
            <button
              type="button"
              disabled
              className="py-2.5 text-sm font-semibold transition-all shrink-0 flex-1 flex items-center justify-center gap-2"
              style={{
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'default',
              }}
            >
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Running…
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="btn-glass py-2.5 text-sm shrink-0"
              style={{ borderRadius: '12px' }}
              title="Stop after current session"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onPause}
              className="btn-glass py-2.5 text-sm shrink-0"
              style={{ borderRadius: '12px' }}
              title="Pause after current session"
            >
              Pause
            </button>
          </>
        ) : paused ? (
          <>
            <button
              type="button"
              onClick={onResume}
              className="py-2.5 text-sm font-semibold transition-all shrink-0 flex-1"
              style={{
                borderRadius: '12px',
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
              onClick={onCancel}
              className="btn-glass py-2.5 text-sm shrink-0"
              style={{ borderRadius: '12px' }}
              title="Cancel and clear pause"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun || (finished && !runError)}
            className="w-full py-2.5 text-sm font-semibold transition-all"
            style={{
              borderRadius: '12px',
              background: canRun && !(finished && !runError)
                ? 'var(--accent)'
                : 'rgba(255,255,255,0.06)',
              color: canRun && !(finished && !runError) ? '#fff' : 'var(--text-muted)',
              border: canRun && !(finished && !runError)
                ? '1px solid rgba(255,255,255,0.15)'
                : '1px solid rgba(255,255,255,0.08)',
              boxShadow: canRun && !(finished && !runError) ? '0 0 16px var(--accent-glow)' : 'none',
              cursor: canRun && !(finished && !runError) ? 'pointer' : 'not-allowed',
              opacity: canRun && !(finished && !runError) ? 1 : 0.55,
              letterSpacing: '-0.01em',
            }}
          >
            {label}
          </button>
        )}
      </div>
    </div>
  );
}

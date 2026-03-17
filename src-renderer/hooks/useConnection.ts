import { useState, useCallback, useEffect, useRef } from 'react';

const DEFAULT_COMPANY = 'Braz Sound';
const DEFAULT_APP = 'Mix Bridge';

export function useConnection() {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref prevents the auto-connect effect from firing a second time during
  // React StrictMode's intentional unmount/remount cycle. Refs persist across
  // StrictMode remounts (unlike state), so this guard works reliably.
  const autoTriedRef = useRef(false);

  const connect = useCallback(async (company?: string, appName?: string) => {
    if (!window.ptsl) {
      setError('PTSL not available (not running in Electron?)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.ptsl.connect(company || DEFAULT_COMPANY, appName || DEFAULT_APP);
      if ('error' in result) {
        const raw = result.error || '';
        const lower = raw.toLowerCase();
        const isTransportError =
          lower.includes('not responding') ||
          lower.includes('not available') ||
          lower.includes('unavailable') ||
          lower.includes('econnrefused') ||
          lower.includes('connect failed') ||
          lower.includes('timed out') ||
          lower.includes('no connection established') ||
          lower.includes('failed to connect');
        const friendly = isTransportError
          ? 'Could not connect to Pro Tools. Make sure Pro Tools is open with a session loaded, then try again.'
          : raw;
        setError(friendly || 'Failed to connect to Pro Tools.');
        setConnected(false);
        setSessionId(null);
      } else {
        setSessionId(result.sessionId);
        setConnected(true);
        try {
          const nameRes = await window.ptsl.getSessionName();
          if (!nameRes.error && nameRes.data?.session_name) {
            setSessionName(nameRes.data.session_name);
          } else {
            setSessionName(null);
          }
        } catch {
          setSessionName(null);
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setConnected(false);
      setSessionId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (window.ptsl) await window.ptsl.disconnect();
    setConnected(false);
    setSessionId(null);
    setSessionName(null);
    setError(null);
  }, []);

  // Auto-connect once on mount. autoTriedRef persists through StrictMode
  // remounts so this never fires a second concurrent connect call.
  useEffect(() => {
    if (!autoTriedRef.current) {
      autoTriedRef.current = true;
      void connect();
    }
  }, [connect]);

  // Poll session name every 3 s while connected so we detect when the user
  // opens a different session in Pro Tools without disconnecting.
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(async () => {
      try {
        const res = await window.ptsl.getSessionName();
        if (!res.error && res.data?.session_name) {
          setSessionName((prev) => {
            const next = res.data!.session_name!;
            return next !== prev ? next : prev;
          });
        }
      } catch {
        // silently ignore transient errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [connected]);

  // Auto-retry when disconnected with an error (e.g. app opened before Pro Tools).
  // When the user opens Pro Tools later, we retry every 5 s until connected.
  // No retry after explicit Disconnect (error is cleared then).
  useEffect(() => {
    if (connected || loading || !error) return;
    const interval = setInterval(() => {
      void connect();
    }, 5000);
    return () => clearInterval(interval);
  }, [connected, loading, error, connect]);

  return { connected, sessionId, sessionName, connect, disconnect, loading, error };
}

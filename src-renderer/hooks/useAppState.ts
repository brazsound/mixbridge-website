import { useState, useCallback, useEffect, useRef } from 'react';

export interface AppState {
  selectedSessionId: string | null;
  sidebarWidth: number;
  rightWidth: number;
}

const DEFAULT: AppState = {
  selectedSessionId: null,
  sidebarWidth: 176,
  rightWidth: 400,
};

const LAYOUT_DEBOUNCE_MS = 300;

export function useAppState() {
  const [state, setState] = useState<AppState>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const layoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!window.appState) return;
    window.appState.load().then((loadedState) => {
      setState({
        selectedSessionId: loadedState.selectedSessionId ?? null,
        sidebarWidth: loadedState.sidebarWidth,
        rightWidth: loadedState.rightWidth,
      });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = useCallback((next: Partial<AppState>) => {
    if (!window.appState) return;
    setState((prev) => {
      const merged = { ...prev, ...next };
      void window.appState!.save(merged);
      return merged;
    });
  }, []);

  const setSelectedSessionId = useCallback((id: string | null) => {
    save({ selectedSessionId: id });
  }, [save]);

  const persistLayout = useCallback(() => {
    if (!window.appState) return;
    setState((prev) => {
      void window.appState!.save(prev);
      return prev;
    });
  }, []);

  const setSidebarWidth = useCallback((w: number) => {
    setState((prev) => ({ ...prev, sidebarWidth: w }));
    if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
    layoutDebounceRef.current = setTimeout(persistLayout, LAYOUT_DEBOUNCE_MS);
  }, [persistLayout]);

  const setRightWidth = useCallback((w: number) => {
    setState((prev) => ({ ...prev, rightWidth: w }));
    if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
    layoutDebounceRef.current = setTimeout(persistLayout, LAYOUT_DEBOUNCE_MS);
  }, [persistLayout]);

  useEffect(() => () => {
    if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
  }, []);

  return {
    ...state,
    loaded,
    setSelectedSessionId,
    setSidebarWidth,
    setRightWidth,
    save,
  };
}

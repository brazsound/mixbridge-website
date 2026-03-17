import { useState, useCallback, useEffect, useRef } from 'react';

export interface TrackInfo {
  id: string;
  name: string;
  type: number; // TrackType: TT_Audio=2, TT_BasicFolder=14, TT_RoutingFolder=15, etc.
  parent_folder_id?: string;
  parent_folder_name?: string;
  track_attributes?: {
    is_selected?: string | number | boolean;
    is_soloed?: boolean;
    is_muted?: boolean;
  };
}

/** TT_BasicFolder=14, TT_RoutingFolder=15 */
export const FOLDER_TRACK_TYPES = [14, 15] as const;

export function isFolderTrack(track: TrackInfo): boolean {
  // PTSL may return type as a number or a string ("14", "TT_BasicFolder", etc.)
  const n = Number(track.type);
  if (!isNaN(n)) return n === 14 || n === 15;
  const s = String(track.type);
  return s === 'TT_BasicFolder' || s === 'TT_RoutingFolder';
}

export interface TimelineSelection {
  in_time?: string;
  out_time?: string;
  play_start_marker_time?: string;
}

export interface MemoryLocationInfo {
  number: number;
  name: string;
  start_time?: string;
  end_time?: string;
}

/** is_selected is a TrackAttributeState enum: "SetExplicitly" / "SetExplicitlyAndImplicitly" = selected */
function isExplicitlySelected(val: string | number | boolean | undefined): boolean {
  if (val == null || val === false || val === 0) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 2 || val === 4;
  const s = String(val);
  return (
    s === 'SetExplicitly' ||
    s === 'TAState_SetExplicitly' ||
    s === 'SetExplicitlyAndImplicitly' ||
    s === 'TAState_SetExplicitlyAndImplicitly'
  );
}

export type ProToolsScanData = {
  tracks: TrackInfo[];
  memoryLocations: MemoryLocationInfo[];
};

export function useProToolsData(
  connected: boolean,
  onScanned?: (ptxPath: string, data: ProToolsScanData) => void
) {
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [timelineSelection, setTimelineSelection] = useState<TimelineSelection | null>(null);
  const [memoryLocations, setMemoryLocations] = useState<MemoryLocationInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTracks = useCallback(async () => {
    if (!connected || !window.ptsl) return;
    try {
      const res = await window.ptsl.getTrackList({});
      if (!res.error) {
        const list = (res.data as { track_list?: TrackInfo[] })?.track_list ?? [];
        setTracks(list);
      }
    } catch {
      // silent poll failure - don't set error on background polls
    }
  }, [connected]);

  const refreshTimelineSelection = useCallback(async () => {
    if (!connected || !window.ptsl) return;
    try {
      const res = await window.ptsl.getTimelineSelection({});
      if (!res.error) {
        setTimelineSelection((res.data as TimelineSelection) ?? null);
      }
    } catch {
      // silent
    }
  }, [connected]);

  const refreshMemoryLocations = useCallback(async () => {
    if (!connected || !window.ptsl) return;
    try {
      const res = await window.ptsl.getMemoryLocations({});
      if (!res.error) {
        const list =
          (res.data as { memory_locations?: MemoryLocationInfo[] })?.memory_locations ?? [];
        setMemoryLocations(list);
      }
    } catch {
      // silent
    }
  }, [connected]);

  const refreshAll = useCallback(async () => {
    if (!connected || !window.ptsl) return;
    setLoading(true);
    setError(null);
    try {
      const [trackRes, timelineRes, memRes] = await Promise.all([
        window.ptsl.getTrackList({}),
        window.ptsl.getTimelineSelection({}),
        window.ptsl.getMemoryLocations({}),
      ]);
      const trackList = (trackRes.data as { track_list?: TrackInfo[] })?.track_list ?? [];
      const memList =
        (memRes.data as { memory_locations?: MemoryLocationInfo[] })?.memory_locations ?? [];
      setTracks(trackList);
      setTimelineSelection((timelineRes.data as TimelineSelection) ?? null);
      setMemoryLocations(memList);

      if (onScanned) {
        const pathRes = await window.ptsl.getSessionPath();
        const ptxPath = pathRes.data?.sessionFilePath ?? '';
        if (ptxPath) onScanned(ptxPath, { tracks: trackList, memoryLocations: memList });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [connected, onScanned]);

  // Auto-poll track states every 2.5 s for live solo/mute/selected display
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!connected) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setTracks([]);
      setTimelineSelection(null);
      setMemoryLocations([]);
      return;
    }
    void refreshAll();
    pollRef.current = setInterval(() => {
      void refreshTracks();
    }, 2500);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [connected]);

  const selectedTracks = tracks.filter((t) => isExplicitlySelected(t.track_attributes?.is_selected));
  const soloedTracks = tracks.filter((t) => t.track_attributes?.is_soloed === true);
  const mutedTracks = tracks.filter((t) => t.track_attributes?.is_muted === true);
  const folderTracks = tracks.filter((t) => isFolderTrack(t));

  const hasTimelineSelection =
    timelineSelection?.in_time != null &&
    timelineSelection?.out_time != null &&
    timelineSelection.in_time !== timelineSelection.out_time;

  return {
    tracks,
    folderTracks,
    selectedTracks,
    soloedTracks,
    mutedTracks,
    timelineSelection,
    hasTimelineSelection,
    memoryLocations,
    loading,
    error,
    refreshTracks,
    refreshTimelineSelection,
    refreshMemoryLocations,
    refreshAll,
  };
}

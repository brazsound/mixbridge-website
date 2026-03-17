import { useState, useCallback, useRef } from 'react';

export type RangeFormat = 'TLType_BarsBeats' | 'TLType_Samples' | 'TLType_TimeCode';

export const RANGE_FORMATS: { value: RangeFormat; label: string; short: string }[] = [
  { value: 'TLType_BarsBeats', label: 'Bars & Beats', short: 'Bars/Beats' },
  { value: 'TLType_Samples', label: 'Samples', short: 'Samples' },
  { value: 'TLType_TimeCode', label: 'Timecode', short: 'Timecode' },
];

export interface CapturedRange {
  inLocation: string;
  outLocation: string;
  timeTypeName: RangeFormat;
  source: 'timeline' | 'marker';
  markerName?: string;
}

export type ImportDestType = 'clip_list' | 'below_track' | 'into_folder';
export type ImportPlacement = 'current_selection' | 'top_of_session';

export interface BounceSettings {
  fileType: number;
  sampleRate: number;
  bitDepth: number;
  interleaved: boolean;
  padToFrameBoundary: boolean;
  offlineBounce: boolean;
  importAfterBounce: boolean;
  /** Where bounced files are written on disk */
  destination: 'session' | 'custom';
  customPath: string;
  /** Where files are re-imported inside the session (when importAfterBounce=true) */
  importDestType: ImportDestType;
  importDestTrackName: string;
  importDestFolderName: string;
  /** When true, create a new track or folder with the given name instead of using an existing one */
  importDestCreateNew: boolean;
  /** Where in the timeline to place the clip (when importDestType is below_track or into_folder) */
  importPlacement: ImportPlacement;
  /** Selected mix sources (outputs/buses). Empty = none selected. */
  mixSources: Array<{ sourceType: number; name: string }>;
  rangeFormat: RangeFormat;
  capturedRange: CapturedRange | null;
  /** When true, also bounce an MP3 alongside the primary export type (Pro Tools "Add MP3"). */
  addMP3: boolean;
}

/** Pro Tools EM_FileType values. MOV (6) excluded — Pro Tools does not support MOV for audio bounce. */
export const FILE_TYPES = [
  { label: 'WAV (BWF)', value: 1 },
  { label: 'AIFF', value: 2 },
  { label: 'MP3', value: 3 },
  { label: 'M4A', value: 4 },
  { label: 'MXF (OP-Atom)', value: 5 },
  { label: 'WAV ADM (Dolby Atmos)', value: 7 },
] as const;

export const SAMPLE_RATES = [
  { label: 'Session default', value: 0 },
  { label: '44.1 kHz', value: 44100 },
  { label: '48 kHz', value: 48000 },
  { label: '88.2 kHz', value: 88200 },
  { label: '96 kHz', value: 96000 },
] as const;

export const BIT_DEPTHS = [
  { label: 'Session default', value: 0 },
  { label: '16-bit', value: 16 },
  { label: '24-bit', value: 24 },
  { label: '32-bit float', value: 32 },
] as const;

export const DEFAULT_SETTINGS: BounceSettings = {
  fileType: 1,
  sampleRate: 0,
  bitDepth: 0,
  interleaved: true,
  padToFrameBoundary: false,
  offlineBounce: true,
  importAfterBounce: false,
  destination: 'session',
  customPath: '',
  importDestType: 'clip_list',
  importDestTrackName: '',
  importDestFolderName: '',
  importDestCreateNew: false,
  importPlacement: 'current_selection',
  mixSources: [],
  rangeFormat: 'TLType_BarsBeats',
  capturedRange: null,
  addMP3: false,
};

// GetTimelineSelection response: { in_time: "998424", out_time: "1098424" }
// Both are plain sample-count strings, NOT nested objects.
type TimelineSelectionResponse = {
  in_time?: string;
  out_time?: string;
};

export function useBounceSettings() {
  const [settings, setSettings] = useState<BounceSettings>(DEFAULT_SETTINGS);
  // Mirror rangeFormat in a ref so async callbacks always see the latest value
  const rangeFormatRef = useRef<RangeFormat>(DEFAULT_SETTINGS.rangeFormat);

  const updateSettings = useCallback((partial: Partial<BounceSettings>) => {
    if (partial.rangeFormat != null) rangeFormatRef.current = partial.rangeFormat;
    if (partial.fileType === 3) partial = { ...partial, addMP3: false }; // MP3 primary and Add MP3 are mutually exclusive
    if (partial.fileType === 6) partial = { ...partial, fileType: 1 }; // MOV not supported for bounce; fallback to WAV
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const captureRangeFromTimeline = useCallback(async (): Promise<{ error?: string }> => {
    if (!window.ptsl) return { error: 'Not connected' };
    const fmt = rangeFormatRef.current;
    const res = await window.ptsl.getTimelineSelection({ location_type: fmt });
    if (res.error) return { error: String(res.error) };
    const data = res.data as TimelineSelectionResponse | null;
    const inLoc = data?.in_time;
    const outLoc = data?.out_time;
    if (!inLoc || !outLoc || inLoc === outLoc) {
      return { error: 'No valid In/Out selection in Pro Tools. Set In/Out points first.' };
    }
    setSettings((prev) => ({
      ...prev,
      capturedRange: { inLocation: inLoc, outLocation: outLoc, timeTypeName: fmt, source: 'timeline' },
    }));
    return {};
  }, []);

  /** Capture range from two memory locations using their stored start_time */
  const captureRangeFromMarkers = useCallback(
    (
      inMarker: { name: string; start_time?: string },
      outMarker: { name: string; start_time?: string }
    ): { error?: string } => {
      const inLoc = inMarker.start_time;
      const outLoc = outMarker.start_time;
      if (!inLoc || !outLoc) {
        return { error: 'Selected markers have no time information.' };
      }
      if (inLoc === outLoc) {
        return { error: 'In and Out markers are at the same position. Pick different markers.' };
      }
      setSettings((prev) => ({
        ...prev,
        capturedRange: {
          inLocation: inLoc,
          outLocation: outLoc,
          timeTypeName: 'TLType_Samples',
          source: 'marker',
          markerName: `${inMarker.name} → ${outMarker.name}`,
        },
      }));
      return {};
    },
    []
  );

  /** Legacy single-marker approach (kept for compatibility) */
  const captureRangeFromMarker = useCallback(
    async (markerNumber: number, markerName: string): Promise<{ error?: string }> => {
      if (!window.ptsl) return { error: 'Not connected' };
      await window.ptsl.selectMemoryLocation({ number: markerNumber });
      const res = await window.ptsl.getTimelineSelection({});
      if (res.error) return { error: String(res.error) };
      const data = res.data as TimelineSelectionResponse | null;
      const inLoc = data?.in_time;
      const outLoc = data?.out_time;
      if (!inLoc || !outLoc || inLoc === outLoc) {
        return { error: `Marker "${markerName}" has no usable range. Try timeline selection instead.` };
      }
      setSettings((prev) => ({
        ...prev,
        capturedRange: { inLocation: inLoc, outLocation: outLoc, timeTypeName: 'TLType_Samples', source: 'marker', markerName },
      }));
      return {};
    },
    []
  );

  const clearRange = useCallback(() => {
    setSettings((prev) => ({ ...prev, capturedRange: null }));
  }, []);

  /** Replace all settings at once. Used when switching sessions. */
  const loadSettings = useCallback((incoming: BounceSettings) => {
    if (incoming.rangeFormat != null) rangeFormatRef.current = incoming.rangeFormat;
    setSettings(incoming);
  }, []);

  return {
    settings,
    updateSettings,
    loadSettings,
    captureRangeFromTimeline,
    captureRangeFromMarkers,
    captureRangeFromMarker,
    clearRange,
  };
}

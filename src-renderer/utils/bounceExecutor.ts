/**
 * Shared bounce execution logic used by both RunQueueRunner (single session)
 * and SessionBatchRunner (multi-session automated batch).
 */
import type { QueueItem, BatchStemsItem, BounceSoloedItem } from '../hooks/useQueue';
import type { BounceSettings, CapturedRange } from '../hooks/useBounceSettings';

// ── PTSL enum string helpers ──────────────────────────────────────────────────

const FILE_TYPE_MAP: Record<number, string> = {
  1: 'EMFType_WAV',
  2: 'EMFType_AIFF',
  3: 'EMFType_MP3',
  4: 'EMFType_M4A',
  5: 'EMFType_MXFOPAtom',
  7: 'EMFType_WAVADM',
  // 6 (MOV) not supported for audio bounce in Pro Tools
};

export function fileTypeStr(n: number): string {
  return FILE_TYPE_MAP[n] ?? 'EMFType_WAV';
}

export function fileExtension(n: number): string {
  const ext: Record<number, string> = {
    1: '.wav',
    2: '.aif',
    3: '.mp3',
    4: '.m4a',
    5: '.mxf',
    7: '.wav',
  };
  return ext[n] ?? '.wav';
}

export function sampleRateStr(n: number): string | null {
  const m: Record<number, string> = {
    44100: 'SRate_44100',
    48000: 'SRate_48000',
    88200: 'SRate_88200',
    96000: 'SRate_96000',
    176400: 'SRate_176400',
    192000: 'SRate_192000',
  };
  return m[n] ?? null;
}

export function bitDepthStr(n: number): string | null {
  const m: Record<number, string> = {
    16: 'BDepth_16',
    24: 'BDepth_24',
    32: 'BDepth_32Float',
  };
  return m[n] ?? null;
}

export function mixSourceTypeStr(n: number): string {
  const m: Record<number, string> = {
    1: 'EMSType_PhysicalOut',
    2: 'EMSType_Bus',
    3: 'EMSType_Output',
    4: 'EMSType_Renderer',
  };
  return m[n] ?? 'EMSType_Renderer';
}

// ── Error classification ──────────────────────────────────────────────────────

export function classifyBounceError(raw: unknown): string {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
  const lower = text.toLowerCase();
  if (
    lower.includes('nohardware') ||
    lower.includes('no_hardware') ||
    lower.includes('no dsp') ||
    lower.includes('hardware insert') ||
    lower.includes('hw insert') ||
    (lower.includes('offline') && (lower.includes('insert') || lower.includes('plug') || lower.includes('hardware')))
  ) {
    return 'Offline bounce cannot be used with hardware inserts. Uncheck "Offline" in Routing & Format and try again.';
  }
  if (lower.includes('cmn_cancelexception')) {
    return 'Bounce was cancelled in Pro Tools.';
  }
  return text;
}

// ── Build shared export-mix payload ──────────────────────────────────────────

export interface ExportPayload {
  fileType: string;
  offlineBounce: string;
  audioInfoExport: Record<string, unknown>;
  locationInfo: Record<string, unknown>;
  mixSourceList: Record<string, unknown>[];
  wantsCustomImportDest: boolean;
}

export function buildExportPayload(settings: BounceSettings): ExportPayload {
  const fileType = fileTypeStr(settings.fileType);
  const offlineBounce = settings.offlineBounce ? 'TB_True' : 'TB_Default';

  const wantsCustomImportDest =
    settings.importAfterBounce && (
      settings.importDestType === 'clip_list' ||
      (settings.importDestType === 'below_track' && !!settings.importDestTrackName) ||
      (settings.importDestType === 'into_folder' && !!settings.importDestFolderName)
    );

  const locationInfo: Record<string, unknown> =
    settings.destination === 'custom' && settings.customPath
      ? { file_destination: 'EM_FD_Directory', directory: settings.customPath, import_after_bounce: 'TB_False' }
      : {
          file_destination: 'EM_FD_SessionFolder',
          directory: 'Bounced Files', // subfolder relative to session directory
          import_after_bounce:
            settings.importAfterBounce && !wantsCustomImportDest ? 'TB_True' : 'TB_False',
        };

  const audioInfoExport: Record<string, unknown> = {
    export_format: settings.interleaved ? 'EF_Interleaved' : 'EF_MultipleMonoTracks',
    delivery_format: 'EM_DF_FilePerMixSource',
    pad_to_frame_boundary: settings.padToFrameBoundary ? 'TB_True' : 'TB_False',
  };
  const sr = sampleRateStr(settings.sampleRate);
  const bd = bitDepthStr(settings.bitDepth);
  if (sr) audioInfoExport.sample_rate = sr;
  if (bd) audioInfoExport.bit_depth = bd;

  const mixSourceList: Record<string, unknown>[] = settings.mixSources.map((s) => {
    const entry: Record<string, unknown> = { source_type: mixSourceTypeStr(s.sourceType) };
    if (s.name && s.sourceType !== 4) entry.name = s.name;
    return entry;
  });

  return { fileType, offlineBounce, audioInfoExport, locationInfo, mixSourceList, wantsCustomImportDest };
}

// ── Execute a single bounce item ──────────────────────────────────────────────

/** Convert range to samples if needed. Bars/Beats and Timecode can fail when opening a different session. */
async function ensureSamplesRange(capturedRange: CapturedRange): Promise<{ inLocation: string; outLocation: string }> {
  if (capturedRange.timeTypeName === 'TLType_Samples') {
    return { inLocation: capturedRange.inLocation, outLocation: capturedRange.outLocation };
  }
  if (!window.ptsl?.getTimeAsType) {
    return { inLocation: capturedRange.inLocation, outLocation: capturedRange.outLocation };
  }
  const inRes = await window.ptsl.getTimeAsType(
    { location: capturedRange.inLocation, time_type: capturedRange.timeTypeName },
    'TLType_Samples'
  );
  const outRes = await window.ptsl.getTimeAsType(
    { location: capturedRange.outLocation, time_type: capturedRange.timeTypeName },
    'TLType_Samples'
  );
  const inLoc = inRes.data?.location ?? capturedRange.inLocation;
  const outLoc = outRes.data?.location ?? capturedRange.outLocation;
  return { inLocation: inLoc, outLocation: outLoc };
}

export async function executeBounceItem(
  item: QueueItem,
  payload: ExportPayload,
  capturedRange: CapturedRange,
  settings: BounceSettings,
  allTrackNames: string[],
  /** When false, do not create a new folder/track — use existing (avoids creating one per bounce). */
  isFirstImportInRun = true
): Promise<void> {
  const { fileType, offlineBounce, audioInfoExport, locationInfo, mixSourceList, wantsCustomImportDest } = payload;

  const { inLocation: inLocStr, outLocation: outLocStr } = await ensureSamplesRange(capturedRange);
  const inLoc = { location: inLocStr, time_type: 'TLType_Samples' };
  const outLoc = { location: outLocStr, time_type: 'TLType_Samples' };

  if (item.type === 'bounce_normal') {
    const res = await window.ptsl.exportMix({
      file_name: item.outputName.replace(/[/\\:*?"<>|]/g, '_'),
      file_type: fileType,
      location_info: locationInfo,
      audio_info: audioInfoExport,
      offline_bounce: offlineBounce,
      mix_source_list: mixSourceList,
      start_time: inLoc,
      end_time: outLoc,
    });
    if (!res.success) throw new Error(classifyBounceError(res.error));

  } else if (item.type === 'batch_stems') {
    const b = item as BatchStemsItem;
    const safeName = b.outputName.replace(/[/\\:*?"<>|]/g, '_');
    await window.ptsl.setTrackSoloState({ track_names: allTrackNames, enabled: false });
    await window.ptsl.setTrackSoloState({ track_names: [b.trackName], enabled: true });
    const res = await window.ptsl.exportMix({
      file_name: safeName,
      file_type: fileType,
      location_info: locationInfo,
      audio_info: audioInfoExport,
      offline_bounce: offlineBounce,
      mix_source_list: mixSourceList,
      start_time: inLoc,
      end_time: outLoc,
    });
    await window.ptsl.setTrackSoloState({ track_names: allTrackNames, enabled: false });
    if (!res.success) throw new Error(classifyBounceError(res.error));

  } else if (item.type === 'bounce_soloed') {
    const b = item as BounceSoloedItem;
    await window.ptsl.setTrackSoloState({ track_names: allTrackNames, enabled: false });
    await window.ptsl.setTrackSoloState({ track_names: b.trackNames, enabled: true });
    const res = await window.ptsl.exportMix({
      file_name: b.outputName,
      file_type: fileType,
      location_info: locationInfo,
      audio_info: audioInfoExport,
      offline_bounce: offlineBounce,
      mix_source_list: mixSourceList,
      start_time: inLoc,
      end_time: outLoc,
    });
    await window.ptsl.setTrackSoloState({ track_names: allTrackNames, enabled: false });
    if (!res.success) throw new Error(classifyBounceError(res.error));

  } else {
    // bounce_muted, bounce_range
    const res = await window.ptsl.exportMix({
      file_name: item.outputName,
      file_type: fileType,
      location_info: locationInfo,
      audio_info: audioInfoExport,
      offline_bounce: offlineBounce,
      mix_source_list: mixSourceList,
      start_time: inLoc,
      end_time: outLoc,
    });
    if (!res.success) throw new Error(classifyBounceError(res.error));
  }

  // Add MP3: bounce MP3 alongside primary format when enabled and primary is not MP3
  if (settings.addMP3 && settings.fileType !== 3) {
    const outputName =
      item.type === 'batch_stems'
        ? (item as BatchStemsItem).outputName
        : item.type === 'bounce_soloed'
        ? (item as BounceSoloedItem).outputName
        : item.outputName;
    const baseName = outputName.replace(/[/\\:*?"<>|]/g, '_');
    const mp3Name = baseName.replace(/\.[^.]+$/, '') || baseName;
    const mp3Payload = {
      file_name: `${mp3Name}.mp3`,
      file_type: 'EMFType_MP3',
      location_info: locationInfo,
      audio_info: audioInfoExport,
      offline_bounce: offlineBounce,
      mix_source_list: mixSourceList,
      start_time: inLoc,
      end_time: outLoc,
      audio_encoding_options: {}, // use Pro Tools defaults
    };
    const mp3Res = await window.ptsl.exportMix(mp3Payload);
    if (!mp3Res.success) throw new Error(classifyBounceError(mp3Res.error));
  }

  // Optional: import bounced file(s) back into session
  if (wantsCustomImportDest && window.ptsl?.importAudioBack && settings.mixSources.length > 0) {
    const pathRes = await window.ptsl.getSessionPath();
    const sessionFilePath = pathRes.data?.sessionFilePath ?? '';
    const sessionFolder = sessionFilePath.replace(/\/[^/]+$/, '');
    const bouncedFolder =
      settings.destination === 'custom' && settings.customPath
        ? settings.customPath
        : `${sessionFolder}/Bounced Files`;
    const ext = fileExtension(settings.fileType);
    const safeName = item.outputName.replace(/[/\\:*?"<>|]/g, '_');
    // Pro Tools FilePerMixSource: one file per output, typically "Basename (1-2).wav"
    const bounceFilePaths =
      settings.mixSources.length === 1
        ? [`${bouncedFolder}/${safeName}${ext}`]
        : settings.mixSources.map(
            (s) => `${bouncedFolder}/${safeName} (${s.name})${ext}`
          );
    const trackOrFolderName =
      settings.importDestType === 'below_track'
        ? settings.importDestTrackName
        : settings.importDestType === 'into_folder'
        ? settings.importDestFolderName
        : '';
    const locationValue =
      settings.importPlacement === 'current_selection' && capturedRange
        ? inLocStr
        : '0';
    const locationTimeType = 'TLType_Samples';
    const dest = {
      type: settings.importDestType,
      trackOrFolderName,
      // Only create new folder/track on first import; subsequent bounces use the existing one
      createNew: settings.importDestCreateNew && isFirstImportInRun,
      placement: settings.importPlacement,
      locationSamples: locationValue,
      locationTimeType,
    };
    const importRes = await window.ptsl.importAudioBack(bounceFilePaths, dest);
    if (importRes.error) {
      throw new Error(`Bounce succeeded but import failed: ${importRes.error}`);
    }
  }
}

import { useState, useCallback, useEffect } from 'react';

export interface MixSourceOption {
  sourceType: number; // EMSType_* numeric value
  sourceTypeName: string; // "EMSType_Renderer" | "EMSType_Output" | "EMSType_Bus"
  name: string; // display name
  description: string;
}

export interface SessionInfo {
  sampleRate: number;   // 0 if unknown; e.g. 44100, 48000
  sampleRateLabel: string; // e.g. "48 kHz"
  bitDepth: number;     // 0 if unknown; e.g. 16, 24, 32
  bitDepthLabel: string; // e.g. "24-bit"
  mixSources: MixSourceOption[];
}

/** Parse PTSL SampleRate enum string to numeric Hz */
function parseSampleRate(raw: string | undefined): { hz: number; label: string } {
  if (!raw) return { hz: 0, label: '' };
  const map: Record<string, { hz: number; label: string }> = {
    SR_44100: { hz: 44100, label: '44.1 kHz' },
    SR_48000: { hz: 48000, label: '48 kHz' },
    SR_88200: { hz: 88200, label: '88.2 kHz' },
    SR_96000: { hz: 96000, label: '96 kHz' },
    SR_176400: { hz: 176400, label: '176.4 kHz' },
    SR_192000: { hz: 192000, label: '192 kHz' },
    SRate_44100: { hz: 44100, label: '44.1 kHz' },
    SRate_48000: { hz: 48000, label: '48 kHz' },
    SRate_88200: { hz: 88200, label: '88.2 kHz' },
    SRate_96000: { hz: 96000, label: '96 kHz' },
    SRate_176400: { hz: 176400, label: '176.4 kHz' },
    SRate_192000: { hz: 192000, label: '192 kHz' },
  };
  return map[raw] ?? { hz: 0, label: raw };
}

/** Parse PTSL BitDepth enum string to numeric bits */
function parseBitDepth(raw: string | undefined): { bits: number; label: string } {
  if (!raw) return { bits: 0, label: '' };
  const map: Record<string, { bits: number; label: string }> = {
    Bit16: { bits: 16, label: '16-bit' },
    Bit24: { bits: 24, label: '24-bit' },
    Bit32Float: { bits: 32, label: '32-bit float' },
    BDepth_16: { bits: 16, label: '16-bit' },
    BDepth_24: { bits: 24, label: '24-bit' },
    BDepth_32Float: { bits: 32, label: '32-bit float' },
  };
  return map[raw] ?? { bits: 0, label: raw };
}

const EMPTY: SessionInfo = {
  sampleRate: 0,
  sampleRateLabel: '',
  bitDepth: 0,
  bitDepthLabel: '',
  mixSources: [],
};

export function useSessionInfo(
  connected: boolean,
  onScanned?: (ptxPath: string, data: SessionInfo) => void
) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>(EMPTY);

  const load = useCallback(async () => {
    if (!connected || !window.ptsl) {
      setSessionInfo(EMPTY);
      return;
    }

    const [srRes, bdRes, outputRes, busRes] = await Promise.allSettled([
      window.ptsl.getSessionSampleRate(),
      window.ptsl.getSessionBitDepth(),
      window.ptsl.getExportMixSourceList('EMSType_Output'),
      window.ptsl.getExportMixSourceList('EMSType_Bus'),
    ]);

    const srData = srRes.status === 'fulfilled' ? srRes.value?.data : null;
    const bdData = bdRes.status === 'fulfilled' ? bdRes.value?.data : null;
    const outputData = outputRes.status === 'fulfilled' ? outputRes.value?.data : null;
    const busData = busRes.status === 'fulfilled' ? busRes.value?.data : null;

    const { hz: sampleRate, label: sampleRateLabel } = parseSampleRate(srData?.sample_rate);
    const { bits: bitDepth, label: bitDepthLabel } = parseBitDepth(bdData?.bit_depth);

    const sources: MixSourceOption[] = [
      {
        sourceType: 4,
        sourceTypeName: 'EMSType_Renderer',
        name: 'Renderer',
        description: 'Atmos renderer / main monitoring path',
      },
    ];

    (outputData?.source_list ?? []).forEach((name) => {
      sources.push({
        sourceType: 3,
        sourceTypeName: 'EMSType_Output',
        name,
        description: 'Output bus',
      });
    });

    (busData?.source_list ?? []).forEach((name) => {
      sources.push({
        sourceType: 2,
        sourceTypeName: 'EMSType_Bus',
        name,
        description: 'Internal bus',
      });
    });

    const info = { sampleRate, sampleRateLabel, bitDepth, bitDepthLabel, mixSources: sources };
    setSessionInfo(info);

    if (onScanned) {
      const pathRes = await window.ptsl.getSessionPath();
      const ptxPath = pathRes.data?.sessionFilePath ?? '';
      if (ptxPath) onScanned(ptxPath, info);
    }
  }, [connected, onScanned]);

  useEffect(() => {
    if (!connected) {
      setSessionInfo(EMPTY);
      return;
    }
    void load();
    // Poll session info when connected so we pick up outputs/range when user opens a session after connecting
    const interval = setInterval(() => void load(), 5000);
    return () => clearInterval(interval);
  }, [connected, load]);

  return { sessionInfo, reloadSessionInfo: load };
}

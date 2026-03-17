import type { QueueItem } from '../hooks/useQueue';
import type { BounceSettings, CapturedRange } from '../hooks/useBounceSettings';
import type { SessionInfo } from '../hooks/useSessionInfo';
import type { TrackInfo } from '../hooks/useProToolsData';

export const DEMO_PTX_PATH = '/demo/Demo Session.ptx';
export const DEMO_SESSION_NAME = 'Demo Session';

const STEM_SUFFIX = ' - STEM - MIX 3 - Demo Session - D#Maj 120bpm';
const MIX_SUFFIX = ' - MIX 3 - Demo Session - D#Maj 120bpm';

export const DEMO_QUEUE: QueueItem[] = [
  { id: 'demo-q-1', type: 'bounce_normal', outputName: `Main Mix${MIX_SUFFIX}` },
  { id: 'demo-q-2', type: 'bounce_normal', outputName: `Clean Mix${MIX_SUFFIX}` },
  { id: 'demo-q-3', type: 'bounce_muted', outputName: `TV MIX${STEM_SUFFIX}`, trackNames: ['LEAD VOX'] },
  { id: 'demo-q-4', type: 'bounce_soloed', outputName: `Instrumental${STEM_SUFFIX}`, trackNames: ['Kick', 'Snare', 'Bass', 'Synth', 'GTR'] },
  { id: 'demo-q-5', type: 'bounce_soloed', outputName: `ACA${STEM_SUFFIX}`, trackNames: ['LEAD VOX', 'BGV'] },
  { id: 'demo-q-6', type: 'batch_stems', outputName: `KICK${STEM_SUFFIX}`, trackId: 't1', trackName: 'Kick' },
  { id: 'demo-q-7', type: 'batch_stems', outputName: `SNARE${STEM_SUFFIX}`, trackId: 't2', trackName: 'Snare' },
  { id: 'demo-q-8', type: 'batch_stems', outputName: `BASS${STEM_SUFFIX}`, trackId: 't3', trackName: 'Bass' },
  { id: 'demo-q-9', type: 'batch_stems', outputName: `SYNTH${STEM_SUFFIX}`, trackId: 't4', trackName: 'Synth' },
  { id: 'demo-q-10', type: 'batch_stems', outputName: `GTR${STEM_SUFFIX}`, trackId: 't5', trackName: 'GTR' },
  { id: 'demo-q-11', type: 'batch_stems', outputName: `LEAD VOX${STEM_SUFFIX}`, trackId: 't6', trackName: 'LEAD VOX' },
  { id: 'demo-q-12', type: 'batch_stems', outputName: `BGV${STEM_SUFFIX}`, trackId: 't7', trackName: 'BGV' },
];

export const DEMO_CAPTURED_RANGE: CapturedRange = {
  inLocation: '1|1|0',
  outLocation: '9|1|0',
  timeTypeName: 'TLType_BarsBeats',
  source: 'timeline',
};

export const DEMO_MIX_SOURCES = [
  { sourceType: 2, name: 'Stereo Out' },
  { sourceType: 2, name: 'Bus 1' },
];

export const DEMO_SETTINGS: BounceSettings = {
  fileType: 1,
  sampleRate: 48000,
  bitDepth: 24,
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
  mixSources: DEMO_MIX_SOURCES.map((s) => ({ sourceType: s.sourceType, name: s.name })),
  rangeFormat: 'TLType_BarsBeats',
  capturedRange: DEMO_CAPTURED_RANGE,
  addMP3: false,
};

export const DEMO_SESSION_INFO: SessionInfo = {
  sampleRate: 48000,
  sampleRateLabel: '48 kHz',
  bitDepth: 24,
  bitDepthLabel: '24-bit',
  mixSources: [
    { sourceType: 2, sourceTypeName: 'EMSType_Output', name: 'Stereo Out', description: 'Main output' },
    { sourceType: 3, sourceTypeName: 'EMSType_Bus', name: 'Bus 1', description: 'Aux bus' },
  ],
};

export const DEMO_TRACKS: TrackInfo[] = [
  { id: 't1', name: 'Kick', type: 2 },
  { id: 't2', name: 'Snare', type: 2 },
  { id: 't3', name: 'Bass', type: 2 },
  { id: 't4', name: 'Synth', type: 2 },
  { id: 't5', name: 'GTR', type: 2 },
  { id: 't6', name: 'LEAD VOX', type: 2 },
  { id: 't7', name: 'BGV', type: 2 },
  { id: 't8', name: 'Mix Bus', type: 2 },
];

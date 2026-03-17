/**
 * PTSL command IDs (from Pro Tools Scripting SDK PTSL.proto).
 * Only the commands we use are listed.
 */
/** Pro Tools track types: TT_Audio=2, TT_BasicFolder=14, TT_RoutingFolder=15 */
export const TrackType = {
  TT_Audio: 2,
  TT_BasicFolder: 14,
  TT_RoutingFolder: 15,
} as const;

/** TrackInsertionPoint: TIPoint_After=3, TIPoint_First=4, TIPoint_Last=5 */
export const TrackInsertionPoint = {
  TIPoint_After: 3,
  TIPoint_First: 4,
  TIPoint_Last: 5,
} as const;

/** AudioOperations: AOperations_CopyAudio = 1 */
export const AudioOperations = {
  AOperations_CopyAudio: 1,
} as const;

export const CommandId = {
  CreateSession: 0,
  OpenSession: 1,
  GetTrackList: 3,
  Import: 2,
  CloseSession: 17,
  SaveSession: 18,
  SaveSessionAs: 19,
  ExportMix: 28,
  GetSessionSampleRate: 35,
  GetSessionBitDepth: 36,
  GetSessionName: 42,
  GetSessionPath: 43,
  GetMemoryLocations: 69,
  RegisterConnection: 70,
  GetTimelineSelection: 82,
  SelectMemoryLocation: 84,
  SetTrackMuteState: 85,
  SetTrackSoloState: 86,
  CreateNewTracks: 72,
  ImportAudioToClipList: 123,
  SpotClipsByID: 124,
  GetExportMixSourceList: 128,
  GetTimeAsType: 118,
  BounceTrack: 134,
} as const;

export const PTSL_VERSION = 2025;
export const PTSL_VERSION_MINOR = 10;
export const PTSL_VERSION_REVISION = 0;

/** Task status from ResponseHeader.status */
export const TaskStatus = {
  Queued: 0,
  Pending: 1,
  InProgress: 2,
  Completed: 3,
  Failed: 4,
  WaitingForUserInput: 5,
  CompletedWithBadResponse: 6,
  FailedWithBadErrorResponse: 7,
} as const;

// --- Request body builders (JSON sent in request_body_json) ---

export interface RegisterConnectionBody {
  company_name: string;
  application_name: string;
}

export interface GetTrackListBody {
  track_filter_list?: Array<{ filter?: number; invert?: boolean }>;
}

export interface GetTimelineSelectionBody {
  location_type?: number; // TimelineLocationType
}

export interface GetMemoryLocationsBody {
  pagination_request?: { limit?: number; offset?: number };
}

export interface SelectMemoryLocationBody {
  number: number;
}

export interface SetTrackSoloStateBody {
  track_names: string[];
  enabled: boolean;
}

export interface SetTrackMuteStateBody {
  track_names: string[];
  enabled: boolean;
}

export interface TimelineLocation {
  location: string;
  time_type: number; // TLType_Samples = 1, TLType_TimeCode = 5, etc.
}

export interface EM_SourceInfo {
  source_type: number; // EMSType_PhysicalOut=1, Bus=2, Output=3, Renderer=4
  name?: string;
}

export interface ExportMixBody {
  preset_path?: string;
  file_name: string;
  file_type?: number; // EMFType_WAV etc.
  audio_info?: Record<string, unknown>;
  video_info?: Record<string, unknown>;
  location_info?: {
    file_destination?: number;
    output_path?: string;
  };
  offline_bounce?: number; // TripleBool: 2=default, 3=true
  mix_source_list?: EM_SourceInfo[];
  start_time?: TimelineLocation;
  end_time?: TimelineLocation;
}

export interface BounceTrackBody {
  preset_path?: string;
  file_name_prefix: string;
  file_type?: number;
  audio_info?: Record<string, unknown>;
  location_info?: { file_destination?: number; output_path?: string };
  offline_bounce?: number;
  src_track_id: string;
  in_location: TimelineLocation;
  out_location: TimelineLocation;
}

export interface GetExportMixSourceListBody {
  type: string; // "EMSType_Output" | "EMSType_Bus" | "EMSType_PhysicalOut" | "EMSType_Renderer"
}

export interface ImportAudioToClipListBody {
  file_list: string[];
  destination_path?: string;
  audio_operations?: number;
}

export interface CreateNewTracksBody {
  number_of_tracks: number;
  track_type?: string;
  track_format?: string;
  track_name?: string;
  insertion_point_position?: number;
  insertion_point_track_name?: string;
}

export interface OpenSessionBody {
  session_path: string;
  /** Empty object = suppress all blocking dialogs (missing plugins, session notes, etc.) — Pro Tools 2025.06+ */
  behavior_options?: Record<string, never>;
}

export interface CloseSessionBody {
  save_on_close: boolean;
}

export interface SaveSessionAsBody {
  session_name: string;
  session_location: string;
}

export interface SpotClipsByIDBody {
  src_clips: string[];
  dst_track_id: string;
  dst_location_data?: {
    location_type?: string;
    location?: { time_type?: string; location?: string };
  };
}

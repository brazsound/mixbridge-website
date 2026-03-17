/// <reference types="vite/client" />

interface Window {
  ptsl: {
    connect: (company: string, appName: string) => Promise<{ sessionId?: string; error?: string }>;
    disconnect: () => Promise<{ ok: boolean }>;
    sessionId: () => Promise<string | null>;
    send: (command: number, body: Record<string, unknown> | null) => Promise<{ success: boolean; body: unknown; error: unknown }>;
    getTrackList: (body?: Record<string, unknown>) => Promise<{ data?: unknown; error?: string }>;
    getTimelineSelection: (body?: Record<string, unknown>) => Promise<{ data?: unknown; error?: string }>;
    getMemoryLocations: (body?: Record<string, unknown>) => Promise<{ data?: unknown; error?: string }>;
    selectMemoryLocation: (body: { number: number }) => Promise<{ success: boolean; error?: string }>;
    setTrackSoloState: (body: { track_names: string[]; enabled: boolean }) => Promise<{ success: boolean; error?: string }>;
    setTrackMuteState: (body: { track_names: string[]; enabled: boolean }) => Promise<{ success: boolean; error?: string }>;
    exportMix: (body: Record<string, unknown>) => Promise<{ success: boolean; error?: string; body?: unknown }>;
    bounceTrack: (body: Record<string, unknown>) => Promise<{ success: boolean; error?: string; body?: unknown }>;
  };
}

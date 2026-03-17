# Stem Bounce

Desktop app that automates stem creation and bounces in **Pro Tools** using the Pro Tools Scripting SDK (PTSL). Built with Electron + React + TypeScript for Mac (Windows-ready).

---

## Table of Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [User Guide](#user-guide)
- [Architecture](#architecture)
- [Data Flow & How Everything Connects](#data-flow--how-everything-connects)
- [Project Structure](#project-structure)
- [Building & Packaging](#building--packaging)

---

## Overview

Stem Bounce connects to Pro Tools via PTSL (gRPC) and automates:

- **Single-session mode**: Build a queue of bounce jobs (full mix, batch stems, soloed tracks, muted tracks, timeline selection, markers) and run them on the currently open session.
- **Session batch mode**: Queue multiple Pro Tools sessions and run them unattended. The app opens each session, executes its bounce queue, saves, and closes before moving to the next.

Settings (routing, format, range, import destination) are stored **per session**, so each session in the batch can have different outputs, mix sources, and bounce ranges.

---

## Requirements

- **Pro Tools 2025.6+** (tested with 2025.12) with PTSL server running (default: `localhost:31416`)
- **Node.js 18+** to build and run

---

## Quick Start

```bash
npm install
npm run dev
```

1. Open Pro Tools with a session loaded.
2. The app auto-connects on launch and retries every 5 seconds if Pro Tools wasn't ready.
3. The open session is automatically added to the session list.
4. Use **Refresh** to sync tracks and selection, then add bounce jobs and run.

---

## User Guide

### Connection Bar (Top)

- **Status pill**: Shows connection state (Not connected / Connecting… / Could not connect) or the current session name when connected.
- **Settings (gear icon)**: Opens naming template settings.

### Sessions Sidebar (Left)

- **Sessions list**: Each entry is a Pro Tools session (.ptx) with its own queue and bounce settings.
- **Document icon (Load current)**: Loads the session currently open in Pro Tools into the list. If you removed it by mistake, a tooltip appears: "Session removed, click to add back."
- **+ button**: Opens a file picker to select one or more .ptx files to add.
- **Click a session**: Selects it for editing. The center and right panels show that session's queue and settings.
- **Run button**: Runs all pending sessions in the batch (opens each, bounces, saves, closes).

### Center Panel (Queue)

- **Refresh**: Syncs tracks, timeline selection, and memory locations from Pro Tools.
- **Add buttons**:
  - **Mix**: Full mix bounce, no track state changes.
  - **Batch stems**: One file per selected track.
  - **Bounce soloed**: Bounce currently soloed tracks (solo state applied per item when running).
  - **Bounce muted**: Bounce mix excluding muted tracks.
  - **Bounce timeline selection**: Use current In/Out.
  - **Markers**: Bounce range from a memory location (IN/OUT markers).
- **Queue items**: Edit output names, reorder, remove. Undo/redo supported.
- **Run queue**: Runs the queue for the selected session (or current session if none selected).

### Right Panel (Bounce Setup)

- **Presets (1–5)**: Click to recall, Shift+click to save. Matches Pro Tools' Bounce Mix preset slots.
- **Range**: Set bounce In/Out via timeline capture or markers. Format: Bars/Beats, Samples, or Timecode.
- **Mix Sources**: Select which outputs/buses to bounce (e.g. Stereo Out, Bus 1-2). Requires session to be open or previously scanned.
- **Audio**: File type (WAV/AIFF), format (interleaved/non-interleaved), bit depth, sample rate.
- **Import After Bounce**: Re-import bounced files into the session (clip list, below track, or into folder).
- **Destination**: Session folder or custom path.

Settings are **per session**. When you select a different session, the panel shows that session's settings. If the session isn't open, cached data (from a previous scan) is used where available.

### Naming Settings

- Default template for new queue items: `{name}` and `{date}` placeholders.
- Stored globally (not per session).

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Electron |
| Main process | Node.js, TypeScript |
| Renderer (UI) | React 18, TypeScript, Vite |
| Styling | TailwindCSS |
| Pro Tools bridge | PTSL over gRPC (`localhost:31416`) |

### Process Model

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron Main Process (main/)                                   │
│  - Window creation                                               │
│  - PTSL gRPC client (ptsl-client.ts)                             │
│  - IPC handlers for ptsl, presets, session batch, scan cache    │
│  - File dialogs, persistence (JSON files in userData)            │
└───────────────────────────┬─────────────────────────────────────┘
                             │ IPC (contextBridge)
┌────────────────────────────▼────────────────────────────────────┐
│  Renderer Process (src-renderer/)                                │
│  - React app (App.tsx)                                           │
│  - Hooks: useConnection, useQueue, useBounceSettings, etc.        │
│  - Components: ConnectionBar, SessionsSidebar, StemList,         │
│    TechnicalPanel, RunQueueRunner, SessionBatchRunner             │
└─────────────────────────────────────────────────────────────────┘
```

### PTSL Communication

The main process loads a minimal gRPC proto (`ptsl-proto/ptsl_minimal.proto`) and uses `SendGrpcRequest` to send JSON commands to Pro Tools. Commands are defined in `main/ptsl-commands.ts` (e.g. `GetTrackList`, `ExportMix`, `OpenSession`). The `PTSLClientWrapper` in `main/ptsl-client.ts` manages the connection and request/response handling.

---

## Data Flow & How Everything Connects

### 1. Connection & Session Detection

```
useConnection (hook)
    │
    ├── Auto-connect on mount
    ├── Auto-retry every 5s when disconnected with error
    └── Poll session name every 3s when connected
    │
    ▼
App.tsx: When sessionName changes and session not in batch
    │
    └── Auto-add session to batch (getSessionPath → addBatchEntry)
```

### 2. Session Batch & Selection

```
useSessionBatch (hook)
    │
    ├── Loads from stem-bounce-session-batch.json on mount
    ├── Each entry: { id, ptxPath, sessionName, queue, settings, status }
    └── Persists on add/remove/reorder/update
    │
    ▼
App.tsx: selectedSessionId
    │
    ├── When user clicks a session: loadQueue + loadSettings for that entry
    ├── When user switches: saveCurrentToEntry (persist queue + settings to previous)
    └── Center/right panels show data for selected session
```

### 3. Per-Session Settings & Scan Cache

```
useSessionScanCache (hook)
    │
    ├── Caches per ptxPath: mixSources, tracks, memoryLocations, sessionInfo
    ├── Populated when: user refreshes (session open) OR batch run opens session
    └── Persisted to stem-bounce-session-scan-cache.json
    │
    ▼
App.tsx: Panel data selection
    │
    ├── If selected session is open in Pro Tools → use live data (useSessionInfo, useProToolsData)
    ├── Else → use cached data for that ptxPath
    └── TechnicalPanel receives: panelSessionInfo, panelTracks, panelMemoryLocations
```

### 4. Bounce Execution

**Single session (RunQueueRunner):**

```
User clicks "Run queue"
    │
    ▼
bounceExecutor.executeBounceItem (per queue item)
    │
    ├── Build ExportMix payload from settings
    ├── Set solo/mute if needed (bounce_soloed, bounce_muted)
    ├── Select memory location if bounce_range from marker
    ├── window.ptsl.exportMix(payload)
    └── If importAfterBounce: window.ptsl.importAudioBack(...)
```

**Session batch (SessionBatchRunner):**

```
User clicks "Run N sessions"
    │
    ▼
For each pending entry:
    │
    ├── window.ptsl.openSession(entry.ptxPath)
    ├── waitForSessionOpen (poll GetSessionName)
    ├── onCacheSessionScan (cache mix sources, tracks, markers for later editing)
    ├── For each queue item: executeBounceItem (same as single-session)
    └── window.ptsl.closeSession(true)
```

### 5. Presets

```
usePresets (hook)
    │
    ├── 5 slots, loaded from stem-bounce-presets.json
    ├── Load: apply preset settings to useBounceSettings
    ├── Save: Shift+click stores current settings (excluding capturedRange, track names)
    └── Export/Import: JSON file for backup or sharing
```

### 6. IPC Bridge (preload.ts)

The renderer never touches Node or gRPC directly. All communication goes through `contextBridge`:

| API | Purpose |
|-----|---------|
| `window.ptsl` | PTSL commands (connect, getTrackList, exportMix, openSession, etc.) |
| `window.ptslPresets` | Load/save/export/import bounce presets |
| `window.ptslSessionBatch` | Load/save session batch, pick .ptx files |
| `window.ptslSessionScanCache` | Load/save per-session scan cache |

---

## Project Structure

```
STEM APP/
├── main/                    # Electron main process
│   ├── index.ts             # Window, IPC handlers, persistence
│   ├── preload.ts           # contextBridge API for renderer
│   ├── ptsl-client.ts       # gRPC client wrapper
│   └── ptsl-commands.ts     # Command IDs and body types
│
├── src-renderer/            # React UI
│   ├── App.tsx              # Root layout, state orchestration
│   ├── components/
│   │   ├── ConnectionBar.tsx
│   │   ├── SessionsSidebar.tsx
│   │   ├── StemList.tsx     # Queue list, add buttons
│   │   ├── StemRow.tsx      # Single queue item
│   │   ├── TechnicalPanel.tsx # Bounce Setup (range, mix sources, audio, import)
│   │   ├── MixSourcesModal.tsx
│   │   ├── RunQueueRunner.tsx  # Run queue for current session
│   │   ├── SessionBatchRunner.tsx # Run batch across sessions
│   │   ├── QueueBuilder.tsx
│   │   ├── SettingsNaming.tsx
│   │   ├── ImportBackPanel.tsx
│   │   └── Stepper.tsx
│   ├── hooks/
│   │   ├── useConnection.ts
│   │   ├── useQueue.ts
│   │   ├── useBounceSettings.ts
│   │   ├── useProToolsData.ts    # Tracks, timeline, memory locations
│   │   ├── useSessionInfo.ts     # Sample rate, bit depth, mix sources
│   │   ├── useSessionScanCache.ts
│   │   ├── useSessionBatch.ts
│   │   ├── usePresets.ts
│   │   └── useSettings.ts
│   └── utils/
│       └── bounceExecutor.ts     # buildExportPayload, executeBounceItem
│
├── ptsl-proto/
│   └── ptsl_minimal.proto   # Minimal proto for SendGrpcRequest
│
├── dist-main/               # Compiled main process (tsc output)
├── dist-renderer/           # Built renderer (vite output)
└── package.json
```

### Persistence Files (userData)

| File | Content |
|------|---------|
| `stem-bounce-session-batch.json` | Session batch entries (ptxPath, queue, settings) |
| `stem-bounce-session-scan-cache.json` | Per-session cached scan data |
| `stem-bounce-presets.json` | 5 preset slots + last active |

---

## Building & Packaging

```bash
npm run build
# Then run: electron .
# Or package with electron-builder for Mac/Windows.
```

- `npm run build`: Compiles main process (tsc) and renderer (vite).
- `npm run dev`: Builds main, starts Vite dev server, launches Electron with hot reload for the renderer.

---

## Notes

- The app never assumes a timeline range: if a bounce needs In/Out and none is set, you get a clear message.
- Multiple "Bounce soloed" items can each use different solo sets; the app changes solo state before each bounce.
- When the selected session isn't open in Pro Tools, capture and refresh are disabled; you can still edit other settings using cached data.
- Output folder defaults to the session folder; custom path is available in Bounce Setup.

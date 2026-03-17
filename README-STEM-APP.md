# Stem Bounce

Desktop app that automates stem creation and bounces in **Pro Tools** using the Pro Tools Scripting SDK (PTSL). Built with Electron + React + TypeScript for Mac (Windows-ready).

## Requirements

- **Pro Tools 2025.6+** (tested with 2025.12) with PTSL server running (default: `localhost:31416`)
- **Node.js 18+** to build and run

## Quick start

```bash
npm install
npm run dev
```

- **Connect**: Open Pro Tools with a session loaded. The app auto-connects on launch and retries if Pro Tools wasn’t ready yet.
- **Queue**: Use **Refresh** to sync tracks and selection, then add:
  - **Batch stems** – one file per selected track
  - **Bounce soloed** – bounce currently soloed tracks (solo state is applied per queue item when you run)
  - **Bounce muted** – bounce current mix (excluding muted tracks)
  - **Bounce timeline selection** – use current In/Out
  - **Markers** – bounce range from a memory location
- **Naming**: Edit each queue item’s output name before running. Set default template in **Settings**.
- **Run**: Set **timeline selection (In/Out)** in Pro Tools, then click **Run queue**. If there’s no selection when the queue needs a range, the app will tell you instead of assuming.

## Project layout

- `main/` – Electron main process and PTSL gRPC client
- `src-renderer/` – React UI (Queue, Settings)
- `ptsl-proto/` – minimal proto for PTSL `SendGrpcRequest`

## Building for production

```bash
npm run build
# Then run: electron .
# Or package with electron-builder for Mac/Windows.
```

## Notes

- The app never assumes a timeline range: if a bounce needs In/Out and none is set, you get a clear message.
- Multiple “Bounce soloed” items in the queue can each use different solo sets; the app changes solo state before each bounce.
- Output folder is currently session folder; custom path can be added via Settings later.

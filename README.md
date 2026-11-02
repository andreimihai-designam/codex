# Guitar Composer Studio

A local-first guitar harmony workspace. This first implementation includes a
Romanian-language Harmony Studio, deterministic theory, an interactive fretboard,
synthesized playback and a local project library. No account or API key is needed.

## Open without installing Node.js

Download the repository ZIP from GitHub and extract it completely. In the
`portable` folder, open `Guitar-Composer-Studio.html` in Microsoft Edge or Google
Chrome. This single file includes all application code and styles; it does not
need npm or a local server. Export your projects as backups before moving the
file or switching browsers. The portable edition is a browser application, not
a native Windows installer. To regenerate it from source, run `npm run build:portable`.

## Run

Use Node.js 24 (tested with 24.19.0; minimum 22.12).

```sh
npm ci
npm run dev
```

Use the development address printed by Vite. To check the production/PWA build:

```sh
npm test
npm run build
npm run preview
```

The default preview port is 4173. These commands also work from PowerShell in
`C:\Codex Projects\Projects\Guitar-Composer-Studio` after copying/cloning this project.
The current cloud checkout is `/workspace/codex`. A native Windows installer is
not included yet. Use the existing checkout; do not create a worktree by default.

## Compose

1. Start with the demo Cmaj7–Am7–Dm7–G7 or choose **Proiect nou** for an empty project.
2. Select the key, add chords, edit durations and inversions, and reorder them.
3. Read the contextual analysis; audition scales, substitutions and guitar shapes.
   Scale notes are shown as text; the fretboard overlay shows the selected key.
4. Start playback, optionally enable the metronome/loop, and adjust tempo/volume.
   Playback stops when the application moves to the background.
5. Autosave stores the current project in this browser's IndexedDB. Use
   **Salvează versiune** for a restore point and **Exportă** for a portable backup.
6. Import `.gcs.json` through the upload button. Imports create independent copies.

Browser data can be erased or evicted. Export important work. No automatic
cross-device sync is implemented, and no project content is sent to a server.
The local development server exposes project source to reachable clients; use
it on a trusted development network. Host only the built `dist` assets publicly.

## iPhone / offline

Build and serve `dist` on an HTTPS origin. Open it in Safari and use **Add to Home
Screen**. The service worker caches the application shell after the initial load;
theory and local projects then work offline. Transfer project files manually.
The service worker is production-only, not enabled in the Vite dev server.
An audio playback gesture is required. Safari/iPhone hardware has not yet been
qualified; responsive layout checks in Chromium do not establish iOS compatibility.

## Verification

- `npm test`: existing Vitest suite for chord spelling/inversions, all offered
  root/quality combinations, identification, functional analysis, scale inclusion,
  substitutions, guitar-shape constraints, JSON validation and history isolation.
- `python3 tests/browser_offline.py`: production service-worker registration,
  offline reload, editing and IndexedDB persistence against a running preview
  server at port 4173. Uses the same Playwright/Chromium prerequisites.
- `npm run build`: strict TypeScript checking and production build with PWA cache.
- `python3 tests/browser_smoke.py`: Chromium functional checks against a running
  app at port 5173. Requires Python Playwright and Chromium. Set `CHROMIUM_PATH`
  for another browser location or `GCS_BASE_URL` for a preview server at port 4173.
  Checks edit/reorder/invert/duplicate/delete, persistence across reload, transport
  scheduling, import/export, invalid-file handling, library deletion, restore and
  page overflow at 390/768/1024/1440px. Outputs are ignored under `artifacts/`.

Audio scheduling checks verify oscillator events, not audible quality or hardware
latency. No native recording, Windows driver or actual iPhone tests are claimed.

## Project documentation

- [Approved brief and scope](PROJECT_BRIEF.md)
- [Decision log](DECISIONS.md)
- [Architecture, limits and next milestones](docs/ARCHITECTURE.md)
- [Central collaboration rules](AGENTS.md)

Multitrack recording, solo/melody editing, AI, backing tracks, SQLite/Tauri desktop
integration and automatic sync are subsequent milestones, not working features
in this version. The sidebar identifies later modules explicitly.

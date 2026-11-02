# Guitar Composer Studio

A local-first guitar harmony workspace. Version 0.3 includes a
Romanian-language Harmony Studio, deterministic theory, an interactive fretboard,
a piano-roll melody editor, synthesized backing tracks, a four-part mixer,
MIDI/WAV export, browser audio recording/editing, an Ollama AI assistant and a
local project library. No account or API key is needed.

## Open without installing Node.js

Download the repository ZIP from GitHub and extract it completely. In the
`portable` folder, open `Guitar-Composer-Studio.html` in Microsoft Edge or Google
Chrome. Opening the root `index.html` from disk also forwards to that portable
file. This single file includes all application code and styles; it does not
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

## Solo, backing and export

- **Solo & Melody**: click a grid cell to add a note. Select an existing note to
  edit pitch, duration, position and velocity, or delete it. Each measure contains
  16 steps. Change the register and use the measure arrows to navigate.
- **Generează schiță**: a reproducible, seeded rule-based sketch, with chord tones
  on beats and scale tones between. Replacing/clearing a melody saves the previous
  arrangement to history. This is not an AI service.
- **Backing & Export**: enable synthesized bass/drums, select Rock/Ballad/Shuffle,
  then set the four parts' levels, mute and solo. Settings apply at the next play
  and to exports. Mute takes priority; any active solo excludes non-solo parts.
- **Exportă MIDI**: Standard MIDI File type 1, 480 PPQ, tempo/4-4 conductor track
  plus harmony, melody, bass and percussion. Overlapping same-pitch notes are
  merged within each melodic track to avoid premature MIDI note-off.
- **Exportă WAV**: one pass of the mix, stereo 16-bit PCM / 44.1kHz, no metronome.
  Limited to 3 minutes to bound browser memory. The mix includes synthesized instruments and any recorded
  Audio Studio clips. The master volume and mix settings affect the WAV.
- Melody-only projects can play without any harmony chords. Imported v1 projects
  receive an empty melody and disabled backing; v3 adds an empty audio session
  for both v1/v2 projects and preserves all composition state in history. Import limit: 8MB, 512 melody notes, 128 chords, 30 snapshots.
  v3 files require the updated application; older app versions cannot read them. Export a backup before
  replacing the HTML file or browser data.

## Audio Studio

Import WAV/MP3/Ogg/WebM audio supported by your browser, or detect inputs and
record from a Windows-exposed audio device. Microphone permission is requested
only on your click. Choose input/channel and use direct monitoring on your
Scarlett or explicitly opt into software monitoring with headphones.

Select tracks/clips to edit start position, trim, gain, volume/pan/mute/solo,
split at the cursor, duplicate or delete. Transport starts at the Audio Studio
cursor, with recorded and synthesized parts on the same Web Audio clock. There
is no automatic recording-latency compensation or time-stretching. Source limit:
64MB / 3 minutes per file; up to 16 tracks and 128 clips; WAV mix limit 3 minutes.

Export a **.gcsbundle** backup to include sources, history and conversation.
The top Export button selects this format when needed. Import uses a new project
identity, validates sizes and SHA-256, and restores the real source WAV bytes.
Regular .gcs.json remains available for music-only projects. See
[studio storage and capture details](docs/STUDIO_FORMAT.md).

## Asistent AI — Ollama local

1. Install [Ollama for Windows](https://ollama.com/download/windows).
2. Quit the Ollama tray app if running. Open `portable/START-AI.cmd` and leave it
   running. In another window open `portable/INSTALL-AI-MODEL.cmd` to download
   `qwen2.5:3b` once. Manual PowerShell commands are in [AI setup](docs/AI_SETUP.md).
3. Open **Asistent AI**, verify/list models, choose the installed model and send
   a question. After the initial download, local inference needs no Internet.
4. Review proposed changes before applying. The previous arrangement is saved
   in History. Model proposals are structurally validated, not automatically trusted.

The HTML does not include Ollama or model weights. The Windows helper scripts
have not been executed in this Linux environment. A local server/model must be
installed/running to obtain real responses. Without it, AI shows a connection
error; it never fabricates a response. Local mode requires no key or subscription.
Optional HTTPS OpenAI-compatible cloud APIs require the user's in-memory key and
provider CORS support. A per-session request budget and output-token cap are
provided; monetary billing depends on the provider. Audio bytes are never sent
to AI. See [configuration, privacy and validation boundaries](docs/AI_SETUP.md).

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
- `python3 tests/browser_composer.py`: actual IndexedDB v1 migration, melody
  editing/persistence, seeded sketches/history, mix controls, transport, MIDI
  downloads, nonzero stereo WAV rendering, restore and mobile layouts. Uses the
  production preview at port 4173 by default.
- `python3 tests/browser_audio_ai.py`: fake-device capture, waveform/editing,
  pan-correct mix, full backup/source restoration, corruption rejection and
  explicitly mocked AI request/preview/budget/cancel/key-isolation flows.
- `npm run build`: strict TypeScript checking and production build with PWA cache.
- `python3 tests/browser_smoke.py`: Chromium functional checks against a running
  app at port 5173. Requires Python Playwright and Chromium. Set `CHROMIUM_PATH`
  for another browser location or `GCS_BASE_URL` for a preview server at port 4173.
  Checks edit/reorder/invert/duplicate/delete, persistence across reload, transport
  scheduling, import/export, invalid-file handling, library deletion, restore and
  page overflow at 390/768/1024/1440px. Outputs are ignored under `artifacts/`.

Browser audio tests verify fake-device MediaRecorder capture, restored source
bytes and a real nonzero/pan-correct stereo mix. They do not verify a real
Scarlett interface or native driver/latency. AI HTTP tests are explicitly mocked;
real model inference remains to be verified on the user PC. Actual iPhone and
Windows helper execution are not claimed.

## Project documentation

- [Approved brief and scope](PROJECT_BRIEF.md)
- [Decision log](DECISIONS.md)
- [Architecture, limits and next milestones](docs/ARCHITECTURE.md)
- [Windows 11 / Scarlett 4i4 audio milestone](docs/WINDOWS_AUDIO.md)
- [Verification record and limits](docs/VERIFICATION.md)
- [Central collaboration rules](AGENTS.md)

Native ASIO/WASAPI integration, SQLite/Tauri desktop packaging and automatic
sync remain later milestones. Browser recording/editing and a real Ollama/API
client are implemented, with the validation limits above. The sidebar identifies later modules explicitly.

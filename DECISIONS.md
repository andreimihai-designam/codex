# Decision log

## 2026-11-02 — Approval and first increment

The user explicitly approved the architecture and feature plan. The approval
supersedes the planning-only gate for the agreed scope; material scope changes
still require approval. No application files were created before this approval.

## 2026-11-02 — Shared web foundation first

React, TypeScript and Vite provide a functional, testable interface shared by
a future Tauri shell and PWA. Native Windows packaging remains a separate
milestone because this cloud machine has no Rust toolchain or Windows drivers.
No claim of native recording readiness is made.

## 2026-11-02 — Theory and guitar domain separation

Tonal.js is isolated in the deterministic theory module. Guitar search operates
on pitch classes and MIDI independently of React. The UI cannot change formulas
or substitute an AI result for a calculation. Rule-based harmonic analysis is
explicitly contextual, not a unique musicological truth.

## 2026-11-02 — Browser audio adapter

Use Web Audio directly for the initial chord synthesizer; Tone.js is unnecessary
for this transport's current size. Schedule audio ahead against AudioContext time,
not UI timeout timing. Stop on tab backgrounding or missed scheduler deadlines.
Tauri IPC and Rust are not part of a real-time callback. WASAPI/ASIO support must
be measured before selecting the native audio backend.

## 2026-11-02 — IndexedDB and file interchange

Use asynchronous IndexedDB for the browser/PWA, preserving a versioned JSON
model that can later be adapted to SQLite. Imported projects receive a new ID
to avoid overwriting existing work. Manual snapshots retain at most 30 revisions.
There is no cloud sync or authentication. Export remains available on storage
failure; autosave is not a backup against browser-data deletion.

## 2026-11-02 — Scope of voice leading

Search standard tuning, frets 0–12, all chord pitch classes, requested bass,
at most four distinct fretted positions, and a maximum three-fret difference
between positive frets. Rank by per-string movement, register, stretch and muted
strings. This is geometric guidance, not verified physical fingering. Previous
chord comparison uses that chord's first suggested shape; manually auditioned
alternate shapes are currently not saved per chord.

## 2026-11-02 — Offline and deployment

Generate a service worker for the production build; all runtime assets are local.
A published HTTPS origin is needed for iPhone installation. Do not add paid
hosting or publish automatically. Windows and iPhone must be tested on actual
devices before compatibility is claimed.

## 2026-11-02 — Portable delivery after launch difficulties

The user reported that the workspace download link and npm launch instructions
did not work. Add a reproducible single-file browser distribution under
`portable/` so downloaded projects can be opened directly in Edge/Chrome without
Node.js. The portable build embeds the same UI/core and disables service-worker
registration. The normal HTTPS PWA remains separate. Local storage behavior is
browser/file-origin dependent; export backups before moving the HTML file.
Prepare a separate GitHub delivery branch to make the project accessible outside
the cloud workspace; do not overwrite the main branch.

## 2026-11-02 — Source index offline launcher

The user's actual blank-page address was the root source `index.html` opened
with `file://`, rather than the bundled application. Add an early local-file
redirect and visible fallback link. Mark the generated portable document so
it never redirects recursively. Hosted/dev pages retain the normal entry point.
Regression tests cover the reported D: drive path, encoded spaces, and the
no-redirect cases. This identifies the reported source-entry failure; it does
not establish a browser bug in the portable build.

## 2026-11-02 — Continued implementation: composition modules

The user requested continuing the remaining stages and the same exact Windows
file address at handoff. Deliver Solo & Melody, basic backing/mix and MIDI/WAV
in the portable edition. This continues the approved composition workflow;
no native recording or cloud/AI provider is silently substituted.

Introduce schema v2 with explicit v1 migration for both current state and history.
Use quarter-beat melody timing, max 512 notes and 8MB validated interchange. Live
playback, MIDI and offline WAV consume one deterministic event plan. Melody
sketching is seeded and explained as rule-based, not AI. Replacing a sketch
preserves a history checkpoint. Exported MIDI has four instrument tracks plus
conductor; overlapping same-pitch notes are merged per track. WAV is one pass,
44.1kHz stereo PCM and limited to 180 seconds before allocating audio buffers.
Mix levels are settings indicators, not fake real-time meters. Mute has priority
over solo; inactive backing channels cannot solo away the harmony.

The user confirmed Windows 11 with a Focusrite Scarlett 4i4. Generation and driver
are unknown. Native packaging, ASIO/WASAPI I/O, actual latency and multitrack
recording remain pending Windows/interface validation; see docs/WINDOWS_AUDIO.md.

## 2026-11-02 — Portable artifact regression caught before v0.2 delivery

The resource-blocked portable browser test found a bundle-only parse failure:
String.replace interpreted dollar replacement tokens inside minified JavaScript.
Use replacement callbacks when injecting the bundle/styles so their bytes remain
literal. Add a regression test that parses every script in the shipped HTML and
checks document structure and resource independence. Validate the actual rebuilt
artifact in Chromium in addition to the normal web/PWA build.

## 2026-11-02 — Audio Studio and AI implementation approved

The user explicitly requested the remaining Audio Studio and AI stages, aiming
for a fully usable app. Continue the portable/browser workflow; do not describe
it as a native ASIO DAW or claim real hardware/model validation from cloud mocks.
The user chose Ollama and confirmed it is not installed. Provide official setup,
process-scoped Origin-null launch/model helper scripts and in-app diagnostics.

Schema v3 adds audio metadata with explicit v1/v2 migration in current state and
history. Separate IndexedDB stores retain WAV Blobs and conversations. Live and
offline rendering share clip/synth plans, mute/solo and panning. Capture is explicit,
monitoring defaults off, and recorder input/context resources are closed on stop,
error and cancel. Stop invalidates asynchronous asset-loading playback requests.
Position/trim remain manual because browser recording latency is not measured.

A bounded GCSB backup includes current/history sources and chat, validates lengths,
source references, WAV signatures and SHA-256 before storing under a new project
namespace. Normal music-only JSON remains supported. No credentials enter exports.
Ollama requests use bounded JSON/schema output and are checked by the deterministic
core before preview/apply; optional cloud keys are in memory only, HTTPS-bound,
with redirects disabled. No request is made automatically. Budgets are per-session
request/output-token controls, not a fabricated monetary billing guarantee.

Actual cloud model download was blocked by registry.ollama.ai HTTP 403 at the
proxy. Do not bypass network policy or present mocked responses as inference.
Windows/Scarlett capture/latency, Windows command helpers and the user's installed
model remain external validation steps. The core browser/audio/backup pipeline
is exercised with fake WebRTC input and actual decoded/rendered PCM.

## 2026-11-03 — Autonomous portfolio edition approved

The user wants access on any laptop/iPhone without ChatGPT or a mandatory Ollama
installation. They selected an autonomous demo with optional external AI, and
confirmed they can enable GitHub Pages from repository settings.

Make a transparent rule-based local advisor the default and put the existing
actual model client behind an explicit optional mode. Never call the local rules
LLM inference. Add an original locally synthesized demo spanning harmony, melody,
backing and an audio clip, with no microphone/server/model request. Preserve user
projects before loading the example. Device data remains browser-local; transfer
uses project bundles, not implied synchronization.

Build two reproducible ZIPs: an immediately openable standalone index and a full
HTTPS web distribution with its own downloadable offline ZIP. Use relative asset,
manifest and scope paths for Pages subfolders; include PNG/Apple icons. Publish
only generated assets to gh-pages via the existing Git proxy, preserving source
state and refusing to overwrite an unrelated existing site. No repository
visibility, account, login, key or paid model is changed automatically.

GitHub API access was denied by the cloud proxy and the unauthenticated repository
HTML returned 404. Those observations do not establish repository visibility or
Pages readiness. The user must enable Pages for gh-pages/root; verify the public
site before presenting a guessed address as a live link.

## 2026-11-03 — Progression editing and chord-tone melody guidance

User requested direct access to chord types beyond major/minor and melody guidance
for every progression chord. Add a quick root/quality editor under the progression,
with 28 supported qualities and no key-membership restriction. Preserve the advanced
inversion editor and current schema 3; saved projects remain compatible.

Use a pure progression timeline guide, independent of the key scale. Chord choices
show spelled notes, focus the piano keys and navigate to the relevant measure. Each
grid column highlights its actual chord tones, including multiple changes within a
measure. Neutral piano keys replace incidental black-key highlighting. All notes
remain editable for passing tones and chromatic composition. External AI is unchanged.

Validation covers extended/altered spelling, inversion/enharmonic pitch membership,
timeline boundaries, project round-trip, interactive selection/editing/persistence
and responsive layouts. Publish rebuilt standalone ZIP and Pages assets together.

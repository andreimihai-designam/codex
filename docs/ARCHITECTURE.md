# Architecture and remaining milestones

## Boundaries

- `src/core/theory.ts`: Tonal adapter, chord construction/detection, explicit-key
  Roman numeral analysis, scales and explained substitutions. No browser APIs.
- `src/core/guitar.ts`: MIDI tuning, complete-tone/bass-constrained shape search
  and deterministic movement ranking. No audio or persistence dependencies.
- `src/core/composition.ts`: pure timeline planning, seeded melody generation,
  groove events and channel mix/solo policy shared by live and export paths.
- `src/core/midi.ts`: binary SMF writer, tempo/4-4 conductor plus four instrument
  tracks. Merges overlapping same-pitch notes within a track.
- `src/components/`: separate melody and backing/export views.
- `src/core/project.ts`: versioned interchange model, bounds validation, history.
- `src/services/storage.ts`: IndexedDB transactions, project CRUD.
- `src/services/audio.ts`: browser-only audio playback. Oscillator envelopes and
  future transport events use AudioContext time. A 25ms scheduler feeds a 150ms
  lookahead using absolute composition beats; loop boundaries use the same audio
  clock. OfflineAudioContext reuses the same synthesized event renderer for WAV,
  with a 180-second pre-allocation limit. No real-time guarantee is claimed under
  browser/device throttling.
- `src/App.tsx`: responsive Harmony Studio and project library. Domain results
  are derived, not persisted as competing sources of truth.
- `vite.config.ts`: offline production shell with a generated Workbox worker.

Project schema version 3 stores ID, name, explicit key/mode, tempo, progression
entries, updated time and up to 30 full arrangement snapshots. Each entry stores
root, quality, inversion, beat count, section and stable ID. Melody entries store
MIDI pitch, start/duration in beats, velocity and stable ID. Backing stores groove,
enable state, and four volume/mute/solo channels. Projects are capped at 128
chords, 512 notes, 30 revisions and an 8MB import size. v1/v2 are migrated explicitly
v1 receives melody/backing defaults, v2 retains its composition, and both gain an
empty audio session in every snapshot. Import reconstructs known fields rather
than merging arbitrary properties. No executable code is accepted from files.

## Known musical limits

- Equal temperament, standard six-string tuning, no microtonality/capo editor.
- Major/natural minor key context. Chromatic and secondary-dominant analyses are
  candidates; pivot modulation and full modal-mixture inference are not modeled.
- No unique interpretation is claimed for enharmonic chords or ambiguous sets.
- Scale ranking checks complete chord-tone inclusion and key overlap. It does
  not claim a scale will fit every chord in a progression or every musical style.
- Guitar output does not solve finger assignments, barre constraints, timbre,
  string bendability or individual hand comfort. Muted strings are marked ×.
- Web Audio produces synthesized harmony, lead, bass and deterministic-noise
  percussion; recorded/imported WAV sources are mixed through Audio Studio. These
  synths are not sampled guitar instruments. WAV is bounded to 3
  minutes; live/MIDI retain the full validated arrangement. The piano roll uses
  a quarter-beat grid and supports simultaneous notes, not notation/tab engraving.
- Sections are labels; changing labels does not alter playback ordering.

## Audio Studio and assistant (v0.3)

- `src/core/studio.ts`: source/clip/track validation, timing and nondestructive split.
- `src/services/recording.ts`: explicit browser capture and local audio decoding.
- `src/services/mediaStore.ts`: source WAVs and chat in a separate IndexedDB.
- `src/services/projectBundle.ts`: bounded source-inclusive GCSB archives with SHA-256.
- `src/core/assistant.ts`: bounded model proposal parsing, music/project validation,
  prompt context redaction and explicit application of selected changes.
- `src/services/assistant.ts`: actual Ollama/OpenAI-compatible HTTP clients, bounded
  responses, loopback-only local endpoint, HTTPS cloud and no credential persistence.
- Separate AudioStudio/AiAssistant views keep capture/conversation lifecycles local.

See [studio data/capture](STUDIO_FORMAT.md) and [AI configuration](AI_SETUP.md).

## Windows desktop milestone

Validate Tauri 2 integration on Windows with WebView2, Rust stable, Visual Studio
C++ build tools and Windows SDK. Keep the same domain/UI modules. Introduce a
storage interface and SQLite adapter with migrations before replacing IndexedDB.
Provide data migration rather than silently discarding browser projects. Confirm
install/update/signing requirements and disk layout. Do not claim a Windows
installer has been built until a Windows build and smoke run succeed.

## Native audio decision gate

Before native recording work, confirm interface generation, installed driver and
monitoring requirements. Compare CPAL/WASAPI and ASIO feasibility, distribution
terms, JUCE alternative, channel layouts and device changes. Measure actual
round-trip latency, underruns, long-run recording alignment, resampling and
clock drift at intended sample rates/buffer sizes. A device opening successfully
is insufficient. Keep callback allocations, blocking locks and disk writes out
of the audio callback. Capture/write audio through bounded buffers and worker
threads; design crash recovery and latency compensation before timeline editing.

## Later modules

- Solo/melody and basic backing are delivered in v0.2. Further work may include
  tablature, legato/articulations, phrase tools and richer sound assets, subject
  to their specific scope.
- AI adapter and browser multitrack editing are delivered in v0.3. Real model
  inference and Scarlett hardware qualification need the user setup. Native
  callback-based audio, measured compensation and richer editing remain later work.
- Sync: explicit product decision; current transfer is manual and has no backend.

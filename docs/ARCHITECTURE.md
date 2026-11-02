# Architecture and remaining milestones

## Boundaries

- `src/core/theory.ts`: Tonal adapter, chord construction/detection, explicit-key
  Roman numeral analysis, scales and explained substitutions. No browser APIs.
- `src/core/guitar.ts`: MIDI tuning, complete-tone/bass-constrained shape search
  and deterministic movement ranking. No audio or persistence dependencies.
- `src/core/project.ts`: versioned interchange model, bounds validation, history.
- `src/services/storage.ts`: IndexedDB transactions, project CRUD.
- `src/services/audio.ts`: browser-only audio playback. Oscillator envelopes and
  future transport events use AudioContext time. A 25ms scheduler feeds a 150ms
  lookahead; no real-time guarantee is claimed under browser/device throttling.
- `src/App.tsx`: responsive Harmony Studio and project library. Domain results
  are derived, not persisted as competing sources of truth.
- `vite.config.ts`: offline production shell with a generated Workbox worker.

Project schema version 1 stores ID, name, explicit key/mode, tempo, progression
entries, updated time and up to 30 full arrangement snapshots. Each entry stores
root, quality, inversion, beat count, section and stable ID. Projects are capped
at 128 entries and import files at 2MB. Import reconstructs known fields rather
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
- Web Audio produces a plucked triangle synthesizer, not a sampled electric guitar.
- Sections are labels; changing labels does not alter playback ordering.

## Windows desktop milestone

Validate Tauri 2 integration on Windows with WebView2, Rust stable, Visual Studio
C++ build tools and Windows SDK. Keep the same domain/UI modules. Introduce a
storage interface and SQLite adapter with migrations before replacing IndexedDB.
Provide data migration rather than silently discarding browser projects. Confirm
install/update/signing requirements and disk layout. Do not claim a Windows
installer has been built until a Windows build and smoke run succeed.

## Native audio decision gate

Before recording features, obtain interface model, Windows version, driver and
monitoring requirements. Compare CPAL/WASAPI and ASIO feasibility, distribution
terms, JUCE alternative, channel layouts and device changes. Measure actual
round-trip latency, underruns, long-run recording alignment, resampling and
clock drift at intended sample rates/buffer sizes. A device opening successfully
is insufficient. Keep callback allocations, blocking locks and disk writes out
of the audio callback. Capture/write audio through bounded buffers and worker
threads; design crash recovery and latency compensation before timeline editing.

## Later modules

- Solo/melody editor: shared note/scale model, rhythmic event schema and playback.
- Backing tracks: deterministic generation plus licensed/local sound assets.
- AI: optional local Ollama or budget-limited cloud adapter; validate proposed
  operations through the core. Never make core features depend on AI availability.
- Audio studio: multitrack transport, waveform cache, non-destructive edit model,
  file lifecycle, offline rendering and measured synchronization.
- Sync: explicit product decision; current transfer is manual and has no backend.

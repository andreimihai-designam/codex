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

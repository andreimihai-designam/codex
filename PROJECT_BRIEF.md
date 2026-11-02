# Guitar Composer Studio

Status: plan approved by the user on 2026-11-02; implementation in progress.

## Goal

A personal-use, local-first guitar composition workspace. Windows is the primary
long-term platform; an iPhone PWA is the companion. Harmony Studio is the first
priority. No mandatory accounts, cloud services, AI subscription, or recurring cost.

## Approved MVP scope

- Deterministic, independently tested chord construction and identification.
- Progression editing: add, reorder, duplicate, delete, duration, sections.
- Explicit-key harmonic analysis with alternative/contextual explanations.
- Scale suggestions, rule-based substitutions, chord inversions.
- Interactive standard-tuned six-string fretboard and heuristic voice leading.
- Synthesized chord playback, tempo, looping, metronome and volume.
- Local project library, manual history, validated JSON import/export.
- Responsive, offline-capable web companion with manual file transfer.

## Initial assumptions, stated to the user

Romanian UI, international C–D–E notation, standard EADGBE tuning, 4/4,
manual project transfer between devices. No device or driver has been specified.
These defaults do not establish requirements for professional recording.

## Delivery stages

1. Theory core and project schema.
2. Functional Harmony Studio web application.
3. Guitar tools and responsive/offline companion.
4. MVP stabilization and Windows desktop packaging.
5. Windows audio-engine feasibility prototype with actual audio interface.
6. Separately scoped solo/melody, backing tracks, optional AI and multitrack.

## Current boundaries

This increment delivers a browser-based implementation of the core workflow.
Native Tauri packaging, desktop SQLite, real iPhone qualification, recording,
audio timeline editing, audio export and automatic synchronization are pending.
The audio engine is a browser synthesizer, not a recording or guitar amp engine.
Acceptance and verification details are in README.md and docs/ARCHITECTURE.md.

## Working location

Current cloud checkout: /workspace/codex.
Proposed Windows location: C:\Codex Projects\Projects\Guitar-Composer-Studio.
Use the existing isolated task checkout. Do not create additional worktrees
unless the user explicitly asks. Preserve the central AGENTS.md rules.

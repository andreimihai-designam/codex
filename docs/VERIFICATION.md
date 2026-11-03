# v0.3 verification record — 2026-11-02

| Check                                              | Result                     | Evidence boundary                                                                                                             |
| -------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript + Vite production build          | Passed                     | Web/PWA build, not Windows installer                                                                                          |
| Portable single HTML generation and script parsing | Passed                     | Self-contained scripts/styles; redirect regression covered                                                                    |
| Vitest                                             | 53 tests passed in 8 files | Theory, guitar, project migrations, composition/MIDI/WAV, studio edits/cancellation, bundle integrity, AI protocol            |
| Harmony browser smoke                              | Passed                     | Reorder/inversions, persistence/history, interchange, playback, 390–1440px overflow checks                                    |
| Composer browser smoke                             | Passed                     | Melody, backing/mix, MIDI and nonzero WAV downloads, loop/one-shot completion                                                 |
| Audio/AI browser suite                             | Passed                     | Actual decoder/render/MediaRecorder pipeline with fake WebRTC input; AI HTTP responses explicitly mocked                      |
| Complete audio backup                              | Passed                     | Source bytes restored under new project ID; mix identical after restoration; corrupt SHA-256 rejected before write            |
| AI controls                                        | Passed with mocked HTTP    | Preview/apply, invalid suggestions, history/chat, request budget, cancellation, key header scope and no key in backup/storage |
| PWA offline smoke                                  | Passed                     | Service-worker ready, offline reload/edit/save                                                                                |
| Formatting and Git whitespace                      | Passed                     | Windows command CRLF preserved explicitly                                                                                     |
| Real Focusrite Scarlett 4i4 capture/latency        | Not run                    | Hardware is on user's Windows 11 PC                                                                                           |
| Actual Ollama model inference                      | Not run                    | User has not installed Ollama/model; cloud model registry request was denied by outbound proxy (HTTP 403)                     |
| Windows helper command execution                   | Not run                    | Linux execution environment; manual PowerShell instructions also provided                                                     |
| Actual iPhone qualification                        | Not run                    | Chromium responsive checks do not establish iOS device compatibility                                                          |

The portable application was served over local HTTP with additional resource
requests blocked. Cloud browser policy blocks direct file navigation; this does
not establish a Windows file-launch result. Native ASIO, measured latency and
universal model accuracy are not implied by passing browser/contract tests.

## v0.4 portfolio checks — 2026-11-03

- 59 unit tests passed, including local-advisor behavior and both ZIP layouts.
- Portfolio browser test passed under a Pages-style `/codex/` mount: generated
  complete example, local recommendations, preview/apply, downloadable standalone
  ZIP, relative manifest/icons, offline reload and 390/768px layouts.
- The default demo made zero external requests and zero microphone requests.
  Audio playback used original locally generated content, not an AI model or
  private recording. External AI remains an explicitly selected optional mode.
- Static publication dry-run lists only built assets, PWA resources and the ZIP.
  Public Pages activation/readiness must be recorded separately; a build or branch
  push alone is not evidence of a live public address.

## v0.5 chord guidance checks — 2026-11-03

- Production web/PWA, portable HTML and both ZIP releases rebuilt successfully.
- 62 unit tests passed in 10 files. Added deterministic coverage for progression
  boundaries, chromatic/enharmonic pitch classes, inversions and saved extended chords.
  Existing root/quality/inversion tests exercise all 28 offered chord types.
- `python3 tests/browser_chord_guidance.py` passed in Chromium: all four progression
  chords, chromatic Db7b9 editing, separate guides within one measure, non-chord note
  creation, save/reload, Harmony selection handoff and 390/768/1440px overflow checks.
- `python3 tests/browser_portfolio.py` passed: Pages-style subpath, demo playback,
  local advisor, ZIP download, PWA offline reload and responsive checks. No external
  requests, microphone requests or browser errors occurred in that test.
- Responsive Chromium testing does not replace qualification on a physical iPhone.
  GitHub Pages activation and the public deployment are separate from these checks.

## v0.6 note lanes and key regeneration — 2026-11-03

- Production web/PWA, portable HTML and both ZIP releases rebuilt successfully.
- 67 unit tests passed in 11 files. Generator tests cover every offered root in
  major and natural minor, diatonic membership, deterministic output, preserved
  slot metadata, previous-arrangement history, empty progressions and project
  validation. Enharmonic note labels cover B#/Cb octave boundaries.
- Chord-guidance Chromium regression covers absence of piano keys, selected-chord
  note lanes, retained existing non-chord notes, every progression chord, changes
  within a measure, automatic major/minor regeneration, history and persistence,
  enharmonic roots/labels and 390/768/1440px layouts.
- Composer Chromium regression passed for migration, create/edit/move/delete,
  melody generation/history, transport, MIDI and nonzero stereo WAV export.
- Portfolio regression passed for Pages-style subpath, demo playback, local
  recommendations, downloadable standalone ZIP and offline PWA reload; no external
  requests or microphone requests occurred.
- Physical iPhone testing remains outside this Linux/Chromium environment. Branch
  publication alone does not establish the state of the public Pages deployment.

## v0.6.1 release activation and full-progression repair — 2026-11-03

- 68 unit tests passed in 11 files; production/PWA, portable HTML and both ZIPs built.
- Chord-guidance and offline portfolio Chromium regressions passed.
- `python3 tests/browser_update_migration.py` passed using the real v0.5 Web ZIP
  (source commit 62ac9ac) as the initial /codex/ deployment. It reproduced the
  mixed Gm11–Am7–Dm7–G7 progression in D minor, retained the saved project through
  service-worker replacement without clearing browser data, and verified no
  stranded waiting worker remained.
- Same-key regeneration produced Dm7–Bbmaj7–Gm7–Am7. Subsequent root and mode changes
  replaced all four chord slots, with upgraded offline reload retaining the result.
- A second real worker update displayed the reload action; it was disabled during
  playback and enabled after stop with the project saved. No automatic reload
  interrupted the current-version session.
- These are local Chromium deployment tests; they do not verify the public Pages
  rollout or establish the cache state of the user's browser from a screenshot.

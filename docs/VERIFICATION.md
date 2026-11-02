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

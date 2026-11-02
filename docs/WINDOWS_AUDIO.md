# Windows audio milestone — user hardware profile

## Confirmed by the user

- Windows 11.
- Focusrite Scarlett 4i4.
- Interface generation, firmware, installed driver version, preferred sample
  rate/buffer size and direct-monitoring setup are not yet known.

## Current delivered behavior

v0.2 is an offline browser composer, with four synthesized parts, local mix
controls and stereo WAV/MIDI export. The Scarlett can play the browser's audio
through the Windows-selected output device. The application does not open ASIO,
record the guitar input, select an interface's native channels or claim low-
latency monitoring. No actual Windows/Scarlett measurements were made in cloud.

## Next native prototype

1. Confirm the generation and installed Focusrite driver. Use Focusrite's
   official downloads for the matching generation; do not bundle guessed drivers.
2. Validate a Tauri 2 shell on Windows/WebView2 with the existing shared UI.
3. Prototype WASAPI access via CPAL and evaluate ASIO separately. Check backend
   availability and SDK/distribution terms before committing to an ASIO build.
4. Enumerate actual input/output channels and supported sample rates. Confirm
   whether shared or exclusive operation is appropriate for the user's workflow.
5. Measure underruns, round-trip latency and alignment using the real Scarlett
   at intended buffer sizes and 44.1/48 kHz. Record conditions with each result.
6. Compare software monitoring to the interface's direct-monitoring path. Do not
   enable both automatically or claim a target latency from buffer size alone.
7. Validate long recordings, device disconnect/reconnect, disk throughput,
   resampling and clock drift before non-destructive multitrack editing.

## Implementation constraints for the prototype

Audio callbacks must not run React, Tauri IPC, disk writes, blocking locks or
unbounded allocations. Use bounded buffers and worker threads; plan recording
recovery and measured latency compensation. Store large audio files separately
from SQLite metadata. Introduce migrations and import existing v1/v2 projects
before replacing the browser storage adapter.

This milestone requires a Windows build runner and actual interface access.
It is pending; the browser mixer and WAV rendering do not validate native I/O.

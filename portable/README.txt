GUITAR COMPOSER STUDIO v0.3 - PORTABLE BROWSER EDITION

OPEN THE APP
1. Extract the ZIP completely.
2. Open Guitar-Composer-Studio.html in Edge or Chrome. Node/npm is not required.
3. Click playback to enable sound. Audio capture requests microphone permission.

AUDIO STUDIO
Import audio or choose a Windows-exposed input and record. Select tracks/clips
for position, trim, split, duplicate, gain, pan, mute and solo. Audio/synth parts
share transport and WAV mix. Capture/source/WAV limits are 3 minutes; imports
are limited to 64MB. This is browser recording, not direct ASIO or measured
professional low-latency monitoring. Use headphones for software monitoring.

SAVE YOUR WORK
Project metadata, source WAVs and chats are stored locally in this browser.
Export .gcsbundle to include audio sources, all history sources and chat. SHA-256
is checked on import; imported projects get a new identity. Music-only projects
can export .gcs.json. Moving the HTML or changing browsers can change storage
context. Export backups first. Browser-data removal can erase local recordings.

LOCAL AI - ONE-TIME SETUP
1. Install Ollama from https://ollama.com/download/windows
2. Quit its existing tray app, if running. Open START-AI.cmd and keep it open.
3. In a second window open INSTALL-AI-MODEL.cmd. Internet/disk space is needed
   once to download qwen2.5:3b. The model is not bundled with this HTML.
4. In Asistent AI, verify models and send your question. No paid account/key is
   required for Ollama. After model installation, it can run without Internet.
5. Preview proposed changes before applying. Previous state is saved in History.

The scripts do not change global settings or disable browser security. The
server allows Origin null for local HTML. If port 11434 is busy, quit the old
Ollama tray instance and try START-AI.cmd again. Manual PowerShell instructions
and smaller model options are in docs/AI_SETUP.md in the source project.

VERIFICATION LIMITS
Automated Chromium tests use a fake audio input and mocked AI HTTP responses.
They test real recording/decoding, backup bytes and rendered WAV, not a real
Scarlett driver or model inference. Direct file navigation is blocked in the
cloud browser; the portable file is tested over HTTP with extra resources
blocked. Actual Windows helpers, hardware latency and iPhone require local tests.

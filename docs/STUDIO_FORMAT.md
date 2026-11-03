# Studio data, audio storage and backups

## Project schema v3

v1 and v2 project JSON is migrated explicitly, including history, with an empty
audio session. v1 still gains the v2 melody/mix defaults. v3 adds `audio.assets`
and `audio.tracks`. Each source has a stable ID, name, duration, sample rate,
channel count and bounded rounded waveform peaks. Each clip references a source
and stores start beats, trim-in/out seconds and gain. Tracks store name,
volume, pan, mute/solo and clips. Edits never rewrite the original source WAV.
Maximums: 16 tracks, 128 clips and 128 current source descriptors. Audio and
synthetic solo decisions are shared by playback/export. Tempo changes move
beat-based starts but do not time-stretch recordings.

Metadata remains in the existing project database. Source WAV Blobs and project
conversations use a separate versioned `guitar-composer-media` IndexedDB. Sources
are keyed by project ID plus source ID. Imported projects get a new identity,
preventing a backup import from overwriting another project's source bytes.

Audio import/capture normalizes supported browser-decodable formats to PCM WAV.
Input files are limited to 64MB and 180 seconds; captures auto-stop at 3 minutes.
Playback decodes required sources before scheduling, with a bounded decoded
cache. WAV mixes are limited to 3 minutes before allocation. No source fetches,
codec services or external sound libraries are required after installation.

## .gcsbundle binary layout

- Bytes 0–3: ASCII `GCSB`.
- Bytes 4–7: unsigned little-endian UTF-8 manifest byte count (maximum 8MB).
- Manifest: `{format:"GCSB",version:1,project,files:[{id,bytes,sha256}],chat}`.
- Remaining bytes: uncompressed source WAV Blobs, in `files` order.

Source payload budget is 256MB total, 64MB per source. Entry lengths, exact total
length, referenced source IDs, WAV signatures and SHA-256 hashes are validated
before any persistent write. There is no executable script, external path or
URL in the archive format. SHA-256 detects corruption; this is not an encrypted
or authenticated/signature format. There is no ZIP decompression bomb exposure.

Exports include the union of current and history sources so restoration of an
older clip still works. Unused sources are not eagerly deleted while history
may reference them. Clearing History removes those snapshot references; deleting
a project cleans its media namespace. If media cleanup fails after metadata
removal, the UI reports that some local media could not be cleaned. Browser data
removal/eviction can still erase recordings; export portable backups regularly.

Projects without media/chat can still export as `.gcs.json`. The top export
button chooses the full bundle if source references or conversation exist. A
JSON with audio references but no bytes is rejected with instructions to import
the full bundle. A plain JSON emergency export remains possible for musical
metadata when conversation storage is unavailable.

## Capture and synchronization

Capture uses explicit microphone permission, a selected Windows-exposed input,
requested disabled speech processing, and MediaRecorder. Mono selection is
routed to both output channels; stereo uses browser channels 1/2. Monitor output
is off by default and opt-in for headphones. All input tracks/contexts are closed
after stop/error/cancel. Browser control/codec latency is not measured or
automatically compensated. Overdubs can be aligned with position and trim.

The shared Web Audio clock schedules recorded buffers and synthesized events.
Seeking into a clip adjusts its source offset. Stopping while sources are still
loading invalidates the pending playback. Looping repeats from the selected
Audio Studio cursor to arrangement end; other workspaces start at beat zero.
The UI playhead is approximate; event timing uses audio-clock time.

This is a browser multitrack editor, not a native ASIO engine. No real Scarlett
latency, multi-input channel map or Windows driver compatibility is inferred
from the automated fake-device capture tests.

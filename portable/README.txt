GUITAR COMPOSER STUDIO - PORTABLE BROWSER EDITION

No Node.js or npm is needed for this edition.

1. Extract the ZIP completely (do not open from inside the ZIP).
2. Open Guitar-Composer-Studio.html in Microsoft Edge or Google Chrome.
3. Click the Play button to enable audio.

Projects are saved in this browser's local IndexedDB. Export important projects
as .gcs.json files. Moving the HTML file or changing browsers can change the
storage context; keep exported backups. If storage is unavailable, export your
project before closing the window.

This is the harmony/fretboard application, not a native Windows audio recorder.
The companion PWA requires the normal HTTPS build; this portable file does not
register a service worker.

Rebuild from the source project using: npm ci, then npm run build:portable.

Validation: Chromium functional checks passed over HTTP with additional resource
requests blocked. Direct file navigation is blocked by the cloud browser policy;
actual Windows file launch has not been tested here.

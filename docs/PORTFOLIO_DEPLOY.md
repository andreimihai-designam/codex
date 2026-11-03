# Portfolio edition (v0.4)

## Visitor experience

The browser application is independent of ChatGPT. No account, Ollama, API key,
Node.js, terminal or local model is required for the default workflow. The local
advisor uses named music-theory rules; it is not described as a language model.
Generative AI is an explicit optional mode using the visitor's provider setup.

**Demo complet** creates an original synthetic example locally: progression,
melody, backing and a real generated WAV clip. It does not request microphone
permission, download samples or contact an AI server. Existing projects are saved
before switching. The default editable melody remains audible; a quiet generated
clip demonstrates the audio timeline. No user recordings are shipped publicly.

Each browser keeps its own projects in IndexedDB. Accessing the application on
another device does not synchronize personal projects. Export/import a .gcsbundle
to transfer them. There is no backend database or sign-in service.

## Release archives

Run `npm ci`, then `npm run build:release`.

- `release/Guitar-Composer-Studio.zip`: extract and open **index.html** directly.
  That index is the complete bundled app, not the development entry point.
- `release/Guitar-Composer-Studio-Web.zip`: extract and upload the entire contents
  to static HTTPS hosting; preserve assets, service worker, icons and download/.
- The hosted site includes `/download/Guitar-Composer-Studio.zip` for visitors.

The release builder uses deterministic ZIP timestamps. The offline app does not
need the external-AI Windows helper scripts. Those remain available in the source
repository for advanced users who explicitly choose local model integration.

## GitHub Pages — owner setup

The user chose GitHub Pages and can activate it from the repository settings.
Public settings/API access is unavailable to the agent; no new key or login is
created. The deployment script pushes only built public assets, not source
instructions, project recordings, API keys or browser databases.

1. Build and validate the release.
2. Run `npm run publish:pages` with existing Git repository authentication. It
   pushes a generated commit to `gh-pages`, preserving branch history and leaving
   the source branch/index unchanged. `--dry-run` lists files without publishing.
   An unrecognized existing site is not overwritten; an existing CNAME for this
   application is retained.
3. Open the repository **Settings → Pages**:
   https://github.com/andreimihai-designam/codex/settings/pages
4. Set **Source: Deploy from a branch**. Select **gh-pages**, folder **/ (root)**,
   then Save. GitHub account/repository eligibility for Pages is required.
5. Wait for the deployment shown by GitHub. The expected address is:
   https://andreimihai-designam.github.io/codex/
6. Verify that address in a browser signed out of GitHub before sharing it.

Pushing the branch does not enable Pages or establish public availability. Do
not claim the expected address is live until the deployment/visitor check passes.
The source repository visibility is not changed by the publisher. If the account
cannot enable Pages for this repository, upload the Web ZIP to an eligible static
host or explicitly create a separate public portfolio repository; do not expose
an existing private repository automatically.

## iPhone

Open the published HTTPS address in Safari. Use Share → Add to Home Screen for
standalone mode. After the first successful load, the service worker caches the
application shell; local theory/projects continue offline. Audio playback needs
a user gesture. Capture APIs depend on iOS/browser support and permission. Real
iPhone recording is not established by Chromium mobile-layout tests.

## Deployment details

Vite uses a relative base; icons, manifest start_url/scope and downloads resolve
under `/codex/` as well as a host root. PNG and Apple touch icons are included.
The ZIP download is not precached; it requires connectivity, while the app can
work offline after its shell has loaded. There is no dependency on the originating
Codex cloud task, a running development server or an active ChatGPT session.

The GitHub workflow validates/builds and uploads release artifacts. It does not
change repository visibility or enable Pages. Future source edits need a rebuilt
and republished `gh-pages` branch.

# AI setup — local Ollama by default

The user chose Ollama and confirmed it is not installed on their Windows PC.
The application contains a real HTTP client, not a bundled language model or a
rule engine disguised as AI. Core harmony/audio remains usable without Ollama.

## Windows portable workflow

1. Install Ollama from https://ollama.com/download/windows (official source).
2. Quit the Ollama tray application if it is already running. In the extracted
   `portable` directory, run `START-AI.cmd`. Keep that window open. It sets
   `OLLAMA_ORIGINS=null` for that process and starts `ollama serve` on loopback.
3. Run `INSTALL-AI-MODEL.cmd` in another window. It runs
   `ollama pull qwen2.5:3b`. Internet and disk space are needed for this initial
   download. The model is not inside the GitHub ZIP or the HTML application.
4. Open the portable HTML, select **Asistent AI**, then **Verifică și listează
   modelele**. Select `qwen2.5:3b`, enter a question and send it.
5. Preview any generated chords/notes. **Aplică propunerea** saves the previous
   arrangement in History before applying only the selected parts.

After model installation, disconnecting from the Internet does not stop local
inference. The Ollama process still needs to be running. CPU-only operation is
supported by Ollama; performance depends on available RAM and hardware. For a
smaller model, run `ollama pull qwen2.5:0.5b` and select it in the application;
quality may be lower. No GPU, paid account or API key is required for local mode.
RAM has not been supplied by the user, so no performance guarantee is made.

Equivalent manual PowerShell commands (start the server before pulling a model
from a second terminal):

```powershell
$env:OLLAMA_ORIGINS='null'
ollama serve
```

```powershell
ollama pull qwen2.5:3b
```

The helper scripts do not install drivers, change global environment variables,
kill existing processes or disable browser/OS security. They locate the normal
Ollama installation or ask the user to install it. They have not been executed
on Windows in this Linux cloud environment; the manual commands are included.

## Origin and connection troubleshooting

The portable file uses Origin `null`. Development/PWA pages use their HTTP(S)
origin; the UI displays the relevant value. Ollama's official AllowedOrigins
configuration accepts additional `OLLAMA_ORIGINS` values (verified against the
upstream source). Use the specific displayed origin rather than disabling CORS
or browser security. Modern browsers may ask permission for local-network access.
If port 11434 is busy, quit the existing tray instance before running START-AI.
If there are no models, keep the server running and install one with `ollama pull`.

## Behavior and limits

- Read-only model listing, explicit user-triggered chat calls, abort support and
  a 180-second chat timeout. Errors never create invented assistant responses.
- 128–2048 requested output tokens; UI offers 256/512/1024/2048. Local context is
  bounded at 8192 tokens; history is limited to six short messages for requests.
- A 20-request default per-page session budget, adjustable/reset only by the user.
  Failed attempts count conservatively. This is not a monetary billing guarantee.
- Only key/tempo, bounded chord/melody summaries and recent messages are sent.
  Audio bytes, waveform/source names and project titles are excluded.
- Model-generated proposals are parsed as bounded JSON and run through the
  existing project/theory validators. Structural correctness does not establish
  musical quality. There is no execution of model code, tools or HTML.
- A proposal becomes stale when the project changes; ask again before applying.
- Conversations are stored per project in IndexedDB, included in complete studio
  backups, and can be cleared. API keys are not saved to IndexedDB/localStorage,
  project exports, conversation history or source files.

## Optional cloud adapter

An explicitly selected HTTPS OpenAI-compatible chat-completions endpoint, model
and key may be used. The browser sends credentials only to that chosen origin,
with redirect following disabled. The key lives only in the current panel's
memory. Provider CORS support is required. Requests/token limits bound use but
cannot promise a fixed currency cost; prices and access are provider-dependent.

## Verification boundaries

Cloud automated tests use explicitly mocked Ollama/cloud HTTP responses to test
request schemas, credentials, budgets, cancellation, proposal validation and
history. They are not LLM inference tests. Actual model download in this cloud
was blocked by the outbound policy: registry.ollama.ai returned HTTP 403 at the
proxy. No bypass or substitute hosted model was used. Real inference must be
verified after the user installs Ollama/model on Windows. No claim of universal
musical accuracy or a fully validated Scarlett/Windows stack is made.

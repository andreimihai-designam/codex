import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Send, Settings2, Sparkles, Square, Trash2 } from 'lucide-react';
import type { Project } from '../core/project';
import { buildChord } from '../core/theory';
import type { AssistantReply } from '../core/assistant';
import { askAi, endpointUrl, listAiModels, type AiConfig } from '../services/assistant';
import { loadChat, saveChat, type ChatEntry } from '../services/mediaStore';
const DEFAULT: AiConfig = {
  provider: 'ollama',
  endpoint: 'http://127.0.0.1:11434',
  model: 'qwen2.5:3b',
  maxTokens: 1024,
};
let sessionRequests = 0;
function savedConfig(): AiConfig {
  try {
    const value = JSON.parse(localStorage.getItem('gcs-ai-settings') ?? 'null');
    if (value) {
      endpointUrl(value);
      return value;
    }
  } catch {
    /* Keep safe local defaults. */
  }
  return DEFAULT;
}
export default function AiAssistant({
  project,
  disabled,
  onApply,
  onError,
}: {
  project: Project;
  disabled: boolean;
  onApply: (reply: AssistantReply, parts: { chords: boolean; melody: boolean }) => void;
  onError: (text: string) => void;
}) {
  const [config, setConfig] = useState<AiConfig>(savedConfig),
    [key, setKey] = useState(''),
    [models, setModels] = useState<string[]>([]),
    [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [question, setQuestion] = useState(''),
    [reply, setReply] = useState<AssistantReply | null>(null),
    [signature, setSignature] = useState('');
  const [applyChords, setApplyChords] = useState(true),
    [applyMelody, setApplyMelody] = useState(true),
    [requests, setRequests] = useState(sessionRequests),
    [budget, setBudget] = useState(20),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null),
    mounted = useRef(true),
    conversation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mounted.current = true;
    loadChat(project.id)
      .then((chat) => {
        if (mounted.current) setMessages(chat);
      })
      .catch(() => {
        if (mounted.current) setError('Istoricul AI nu este disponibil în stocarea locală.');
      })
      .finally(() => {
        if (mounted.current) setLoaded(true);
      });
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, [project.id]);
  useEffect(() => {
    conversation.current?.scrollTo({ top: conversation.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);
  function changeConfig(patch: Partial<AiConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
    setConnected(false);
    setModels([]);
  }
  function persistConfig() {
    try {
      endpointUrl(config);
      localStorage.setItem('gcs-ai-settings', JSON.stringify(config));
    } catch {
      /* Settings are nonessential; never store the key. */
    }
  }
  async function connect() {
    setError('');
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const values = await listAiModels(config, key, abort.signal);
      if (!mounted.current) return;
      setModels(values);
      setConnected(true);
      if (values.length && !values.includes(config.model))
        setConfig((c) => ({ ...c, model: values[0] }));
      persistConfig();
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      clearTimeout(timeout);
      if (mounted.current) setBusy(false);
    }
  }
  function errorMessage(error: unknown): string {
    if (error instanceof DOMException && error.name === 'AbortError')
      return 'Cerere anulată sau timpul de așteptare a expirat.';
    if (error instanceof TypeError)
      return config.provider === 'ollama'
        ? 'Nu pot contacta Ollama. Verifică serverul local, modelul instalat și OLLAMA_ORIGINS conform instrucțiunilor. Browserul poate solicita permisiunea de acces la rețeaua locală.'
        : 'Conexiunea cloud a eșuat. Verifică HTTPS, CORS și disponibilitatea furnizorului; nu dezactiva securitatea browserului.';
    return error instanceof Error ? error.message : 'Cererea AI a eșuat.';
  }
  async function send() {
    if (busy || disabled || !loaded) return;
    if (sessionRequests >= budget) {
      setError(
        'Bugetul de cereri al sesiunii a fost atins. Resetează explicit contorul pentru a continua.',
      );
      return;
    }
    const prompt = question.trim();
    if (!prompt) return;
    setError('');
    setBusy(true);
    setReply(null);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 180000);
    try {
      endpointUrl(config);
      persistConfig();
      const next = [...messages, { role: 'user' as const, content: prompt }].slice(-20);
      await saveChat(project.id, next);
      if (!mounted.current) return;
      setMessages(next);
      setQuestion('');
      sessionRequests++;
      setRequests(sessionRequests);
      const result = await askAi(project, messages, prompt, config, key, abort.signal);
      if (!mounted.current) return;
      const complete = [...next, { role: 'assistant' as const, content: result.answer }].slice(-20);
      await saveChat(project.id, complete);
      if (mounted.current) {
        setMessages(complete);
        setReply(result);
        setSignature(project.updatedAt);
        setApplyChords(true);
        setApplyMelody(true);
      }
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      clearTimeout(timeout);
      if (mounted.current) setBusy(false);
    }
  }
  const stale = signature !== project.updatedAt;
  return (
    <div className="assistant-layout">
      <section className="panel assistant-chat">
        <div className="panel-header">
          <div className="section-title">
            <Sparkles size={18} />
            <h2>Asistent AI de compoziție</h2>
          </div>
          <span className="subtle-badge">
            {config.provider === 'ollama' ? 'Ollama local' : 'Cloud opțional'}
          </span>
        </div>
        <div className="composer-intro">
          <h3>Discută ideea. Verifică propunerea. Alege.</h3>
          <p>
            Modelul primește doar rezumatul muzical și ultimele mesaje, nu fișierele audio sau
            cheile. Modificările sunt validate și se aplică numai la cererea ta.
          </p>
        </div>
        <div
          className="chat-messages"
          ref={conversation}
          role="log"
          aria-label="Conversație AI"
          aria-live="polite"
        >
          {!messages.length && (
            <div className="chat-empty">
              <Sparkles size={28} />
              <h3>Cu ce începem?</h3>
              <p>
                Poți cere o explicație armonică, o progresie pentru un anumit stil sau o melodie
                peste acordurile proiectului.
              </p>
              {[
                'Explică funcțiile acordurilor din proiect.',
                'Propune o progresie de 4 acorduri pentru un solo blues-rock.',
                'Propune 8 note melodice peste progresia curentă.',
              ].map((q) => (
                <button key={q} disabled={busy} onClick={() => setQuestion(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <article key={i} className={`chat-message ${m.role}`}>
              <span>{m.role === 'user' ? 'TU' : 'ASISTENT AI'}</span>
              <p>{m.content}</p>
            </article>
          ))}
          {busy && (
            <div className="chat-working">
              <LoaderCircle size={16} className="spin" />
              Aștept răspunsul modelului…
            </div>
          )}
        </div>
        {error && (
          <div className="ai-error" role="alert">
            {error}
          </div>
        )}
        {reply && (reply.progression || reply.melody) && (
          <section className="proposal-preview">
            <h3>Propunere verificată structural</h3>
            <p>
              Verificarea confirmă acordurile, notele și limitele de timp; nu garantează valoarea
              muzicală a răspunsului.
            </p>
            {reply.progression && (
              <label>
                <input
                  type="checkbox"
                  checked={applyChords}
                  disabled={disabled || stale}
                  onChange={(e) => setApplyChords(e.target.checked)}
                />
                Înlocuiește progresia:{' '}
                {reply.progression.length
                  ? reply.progression.map((c) => buildChord(c).symbol).join(' → ')
                  : '(progresie goală)'}
              </label>
            )}
            {reply.melody && (
              <label>
                <input
                  type="checkbox"
                  checked={applyMelody}
                  disabled={disabled || stale}
                  onChange={(e) => setApplyMelody(e.target.checked)}
                />
                Înlocuiește melodia cu {reply.melody.length} note
              </label>
            )}
            {stale && (
              <p>Proiectul s-a modificat după cerere. Cere o propunere nouă înainte de aplicare.</p>
            )}
            <button
              className="button dark"
              disabled={
                disabled ||
                busy ||
                stale ||
                !((applyChords && reply.progression) || (applyMelody && reply.melody))
              }
              onClick={() => {
                try {
                  onApply(reply, { chords: applyChords, melody: applyMelody });
                  setReply(null);
                } catch (e) {
                  onError(errorMessage(e));
                }
              }}
            >
              <Check size={16} />
              Aplică propunerea
            </button>
            <small>
              Starea anterioară este salvată în Istoric. Înregistrările audio nu sunt înlocuite.
            </small>
          </section>
        )}
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="ai-question">Întrebarea ta</label>
          <textarea
            id="ai-question"
            aria-label="Mesaj pentru AI"
            maxLength={2000}
            rows={3}
            value={question}
            disabled={busy || disabled || !loaded}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Descrie stilul, tonalitatea sau ideea pe care vrei să o explorezi…"
          />
          <div>
            <span>
              {requests}/{budget} cereri · max. {config.maxTokens} tokeni/răspuns
            </span>
            {busy ? (
              <button type="button" className="button" onClick={() => controller.current?.abort()}>
                <Square size={14} />
                Anulează cererea
              </button>
            ) : (
              <button
                className="button dark"
                disabled={disabled || !loaded || !question.trim() || requests >= budget}
              >
                <Send size={15} />
                Trimite către AI
              </button>
            )}
          </div>
        </form>
      </section>
      <aside className="composer-side">
        <section className="panel">
          <div className="panel-header">
            <div className="section-title">
              <Settings2 size={17} />
              <h2>Conectare model</h2>
            </div>
          </div>
          <div className="note-properties">
            <label>
              Furnizor
              <select
                aria-label="Furnizor AI"
                disabled={busy}
                value={config.provider}
                onChange={(e) => {
                  const provider = e.target.value as AiConfig['provider'];
                  changeConfig({
                    provider,
                    endpoint:
                      provider === 'ollama' ? DEFAULT.endpoint : 'https://api.openai.com/v1',
                    model: provider === 'ollama' ? DEFAULT.model : '',
                  });
                  setKey('');
                }}
              >
                <option value="ollama">Ollama · pe PC-ul meu</option>
                <option value="cloud">Cloud · API compatibil OpenAI</option>
              </select>
            </label>
            <label>
              Adresă server
              <input
                aria-label="Adresă server AI"
                type="url"
                disabled={busy}
                value={config.endpoint}
                onChange={(e) => changeConfig({ endpoint: e.target.value })}
              />
            </label>
            {config.provider === 'cloud' && (
              <>
                <label>
                  Cheie API · doar în memorie
                  <input
                    aria-label="Cheie API cloud"
                    type="password"
                    autoComplete="off"
                    disabled={busy}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                  />
                </label>
                <p>
                  Furnizorul cloud poate taxa cererile. Limitele de mai jos controlează
                  cererile/tokenii, nu un cost monetar garantat. Solicitările merg direct către
                  furnizorul ales.
                </p>
              </>
            )}
            <label>
              Model
              <input
                aria-label="Model AI"
                list="ai-models"
                disabled={busy}
                value={config.model}
                onChange={(e) => changeConfig({ model: e.target.value })}
              />
              <datalist id="ai-models">
                {models.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </label>
            <button className="button" disabled={busy} onClick={connect}>
              {connected ? 'Actualizează modelele' : 'Verifică și listează modelele'}
            </button>
            {connected && (
              <p role="status">
                Server conectat · {models.length} modele disponibile
                {models.length ? '' : '. Instalează un model înainte de a trimite o cerere.'}
              </p>
            )}
            <label>
              Tokeni maximi pe răspuns
              <select
                aria-label="Limită tokeni AI"
                disabled={busy}
                value={config.maxTokens}
                onChange={(e) => changeConfig({ maxTokens: Number(e.target.value) })}
              >
                {[256, 512, 1024, 2048].map((n) => (
                  <option value={n} key={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cereri maxime în sesiune
              <input
                aria-label="Buget cereri AI"
                type="number"
                min="1"
                max="100"
                value={budget}
                disabled={busy}
                onChange={(e) => setBudget(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              />
            </label>
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                sessionRequests = 0;
                setRequests(0);
                setError('');
              }}
            >
              Resetează contorul
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Ștergi conversația AI a acestui proiect?')) return;
                try {
                  await saveChat(project.id, []);
                  setMessages([]);
                  setReply(null);
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              <Trash2 size={14} />
              Șterge conversația
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Ollama offline pe Windows</h2>
          </div>
          <div className="note-properties">
            <p>
              Instalează Ollama de pe site-ul oficial, apoi descarcă un model o singură dată. Nu
              este inclus un model în fișierul HTML.
            </p>
            <a
              className="button"
              href="https://ollama.com/download/windows"
              target="_blank"
              rel="noreferrer"
            >
              Descarcă Ollama pentru Windows
            </a>
            <pre>ollama pull qwen2.5:3b</pre>
            <p>
              Pentru fișierul portabil, închide Ollama din tray și pornește-l din PowerShell cu
              originea permisă:
            </p>
            <pre>{`$env:OLLAMA_ORIGINS='${window.location.origin}'\nollama serve`}</pre>
            <small>
              Permite doar originea afișată, nu dezactiva securitatea browserului. După instalarea
              modelului, inferența locală nu necesită internet. Modelul potrivit depinde de memoria
              PC-ului.
            </small>
          </div>
        </section>
      </aside>
    </div>
  );
}
